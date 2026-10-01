package app.senseheaven.child.engine

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** One calm-index sample per tick (1 Hz); facePresent + quality gate the label update. */
data class CalmSample(val calmIndex: Int, val facePresent: Boolean, val quality: Float)

enum class SessionStatus { PENDING, ACTIVE, COOLDOWN, ENDED, EXPIRED }

enum class Label { CALM, NEUTRAL, STRESSED }

enum class ScreenState { OFF, ON_ALLOWED, ON_COUNTED }

/** A ledger event the engine emits; the sync layer uploads it with a fresh client uuid. */
data class LedgerEventOut(val kind: String, val seconds: Int = 0, val reason: String? = null)

/** Tunable child config synced from the server (subset of children.settings). */
data class RulesConfig(
    val goodBonusMin: Int = 10,
    val stressPenaltyMin: Int = 5,
    val cooldownMin: Int = 5,
    val maxBonusPerSessionMin: Int = 30,
    val calmThreshold: Int = 70,
    val stressThreshold: Int = 35,
    val sustainedStressS: Int = 300,
    val sustainedCalmS: Int = 900,
    val penaltyLockoutS: Int = 900,
    val allowedPackages: Set<String> = emptySet(),
)

@Serializable
data class EngineState(
    val status: SessionStatus = SessionStatus.PENDING,
    val grantedS: Int = 0,
    val bonusS: Int = 0,
    val penaltyS: Int = 0,
    val usedS: Int = 0,
    val ema: Float = 75f,
    val label: Label = Label.NEUTRAL,
    val stressRunS: Int = 0,
    val calmRunS: Int = 0,
    val notInStressS: Int = 0,
    val notInCalmS: Int = 0,
    val noSignalS: Int = 0,
    val lastPenaltyClockS: Long = -1_000_000L,
    val bonusTotalS: Int = 0,
    val lowTime300Fired: Boolean = false,
    val lowTime60Fired: Boolean = false,
    val cooldownRemainingS: Int = 0,
    val appliedCommandIds: Set<Long> = emptySet(),
    val endReason: String? = null,
) {
    val remainingS: Int get() = grantedS + bonusS - penaltyS - usedS
}

/**
 * Device-authoritative rules engine (File 01 §E4, minus nudge & bedtime per LEAN §1.2).
 * Pure Kotlin — no Android imports — so behaviour is fully unit-testable.
 *
 * Tick is driven by monotonic millisecond deltas from the caller; wall clock never matters
 * (edge case E6-3: changing the system clock has no effect).
 */
object RulesEngine {

    const val MAX_TICK_DELTA_S = 5
    const val RUN_RESET_AFTER_S = 10
    const val NO_SIGNAL_RESET_S = 120
    private const val EMA_ALPHA = 0.2f
    private const val HYSTERESIS = 5

    private val json = Json { ignoreUnknownKeys = true }

    fun serialize(state: EngineState): String = json.encodeToString(state)

    fun deserialize(raw: String): EngineState = json.decodeFromString(raw)

    fun start(state: EngineState, grantedS: Int): EngineState =
        state.copy(status = SessionStatus.ACTIVE, grantedS = grantedS, usedS = 0, bonusS = 0,
            penaltyS = 0, bonusTotalS = 0, lowTime300Fired = false, lowTime60Fired = false,
            stressRunS = 0, calmRunS = 0, endReason = null)

    /**
     * Advance the session by [dtMs] of real time.
     * [screen] says whether the screen is off, on an always-allowed app, or on a counted app.
     * [sample] is the per-second calm sample, or null when no valid sample arrived this tick.
     */
    fun tick(
        state: EngineState,
        dtMs: Long,
        screen: ScreenState,
        sample: CalmSample?,
        config: RulesConfig,
        clockS: Long,
    ): Pair<EngineState, List<LedgerEventOut>> {
        if (state.status == SessionStatus.ENDED || state.status == SessionStatus.EXPIRED) {
            return state to emptyList()
        }
        var s = state
        val events = mutableListOf<LedgerEventOut>()

        // Per-tick delta is capped at 5 s (File 01 §E4) whatever the caller reports.
        val dtS = (dtMs / 1000L).toInt().coerceIn(0, MAX_TICK_DELTA_S)

        // --- cooldown: time is NOT consumed; when it ends we return to active ---
        if (s.status == SessionStatus.COOLDOWN) {
            val newCooldown = (s.cooldownRemainingS - dtS).coerceAtLeast(0)
            if (newCooldown == 0) {
                s = s.copy(status = SessionStatus.ACTIVE, cooldownRemainingS = 0)
                events += LedgerEventOut("cooldown_end")
            } else {
                return s.copy(cooldownRemainingS = newCooldown) to events
            }
        }

        // --- time accounting ---
        if (s.status == SessionStatus.ACTIVE && screen == ScreenState.ON_COUNTED) {
            s = s.copy(usedS = s.usedS + dtS)
        }

        // --- emotion: EMA + hysteresis labels; runs advance only on valid seconds ---
        val valid = sample != null && sample.facePresent && sample.quality >= 0.5f
        if (valid) {
            val ema = EMA_ALPHA * sample!!.calmIndex + (1f - EMA_ALPHA) * s.ema
            val label = updateLabel(s.label, ema, config)
            s = s.copy(ema = ema, label = label, noSignalS = 0)
            when (label) {
                Label.STRESSED -> {
                    var next = s.copy(stressRunS = s.stressRunS + dtS, notInStressS = 0, notInCalmS = s.notInCalmS + dtS)
                    if (next.notInCalmS >= RUN_RESET_AFTER_S) next = next.copy(calmRunS = 0)
                    s = next
                }
                Label.CALM -> {
                    var next = s.copy(calmRunS = s.calmRunS + dtS, notInCalmS = 0, notInStressS = s.notInStressS + dtS)
                    if (next.notInStressS >= RUN_RESET_AFTER_S) next = next.copy(stressRunS = 0)
                    s = next
                }
                Label.NEUTRAL -> {
                    var next = s.copy(notInStressS = s.notInStressS + dtS, notInCalmS = s.notInCalmS + dtS)
                    if (next.notInStressS >= RUN_RESET_AFTER_S) next = next.copy(stressRunS = 0)
                    if (next.notInCalmS >= RUN_RESET_AFTER_S) next = next.copy(calmRunS = 0)
                    s = next
                }
            }
        } else {
            // No-signal seconds freeze both runs; a long gap resets them.
            val noSignal = s.noSignalS + dtS
            s = if (noSignal > NO_SIGNAL_RESET_S) {
                s.copy(noSignalS = noSignal, stressRunS = 0, calmRunS = 0)
            } else {
                s.copy(noSignalS = noSignal)
            }
        }

        // --- rule: sustained stress -> penalty + cooldown (E4 rule 2) ---
        val lockoutOk = clockS - s.lastPenaltyClockS >= config.penaltyLockoutS
        if (s.status == SessionStatus.ACTIVE &&
            s.stressRunS >= config.sustainedStressS && lockoutOk
        ) {
            val penalty = minOf(config.stressPenaltyMin * 60, s.remainingS.coerceAtLeast(0))
            s = s.copy(
                penaltyS = s.penaltyS + penalty,
                stressRunS = 0,
                lastPenaltyClockS = clockS,
                status = SessionStatus.COOLDOWN,
                cooldownRemainingS = config.cooldownMin * 60,
            )
            events += LedgerEventOut("stress_alert", config.sustainedStressS, "Sustained stress signals")
            events += LedgerEventOut("penalty", penalty, "Stress breather")
            events += LedgerEventOut("cooldown_start", config.cooldownMin * 60)
        }

        // --- rule: sustained calm -> bonus, capped per session (E4 rule 3) ---
        val bonusS = config.goodBonusMin * 60
        if (s.status == SessionStatus.ACTIVE &&
            s.calmRunS >= config.sustainedCalmS &&
            s.bonusTotalS + bonusS <= config.maxBonusPerSessionMin * 60
        ) {
            s = s.copy(bonusS = s.bonusS + bonusS, bonusTotalS = s.bonusTotalS + bonusS, calmRunS = 0)
            events += LedgerEventOut("bonus", bonusS, "Sustained calm")
        }

        // --- rule: low-time notices at 5 min and 1 min, once each (E4 rule 4) ---
        val remaining = s.remainingS
        if (s.status == SessionStatus.ACTIVE) {
            if (!s.lowTime300Fired && remaining <= 300) {
                s = s.copy(lowTime300Fired = true)
                events += LedgerEventOut("low_time", 300)
            }
            if (!s.lowTime60Fired && remaining <= 60) {
                s = s.copy(lowTime60Fired = true)
                events += LedgerEventOut("low_time", 60)
            }
        }

        // --- expiry ---
        if (s.status == SessionStatus.ACTIVE && s.remainingS <= 0) {
            s = s.copy(status = SessionStatus.EXPIRED, endReason = "expired")
            events += LedgerEventOut("locked", 0, "Time is up")
        }
        return s to events
    }

    /** E4 hysteresis: enter stressed below threshold, leave at threshold+5 (calm mirrored). */
    private fun updateLabel(current: Label, ema: Float, config: RulesConfig): Label = when (current) {
        Label.STRESSED -> if (ema >= config.stressThreshold + HYSTERESIS) {
            if (ema >= config.calmThreshold) Label.CALM else Label.NEUTRAL
        } else {
            Label.STRESSED
        }
        Label.CALM -> if (ema < config.calmThreshold - HYSTERESIS) {
            if (ema < config.stressThreshold) Label.STRESSED else Label.NEUTRAL
        } else {
            Label.CALM
        }
        Label.NEUTRAL -> when {
            ema < config.stressThreshold -> Label.STRESSED
            ema >= config.calmThreshold -> Label.CALM
            else -> Label.NEUTRAL
        }
    }

    /** Commands from the dashboard; idempotent by command id (E4 rule 5). */
    fun applyCommand(
        state: EngineState,
        commandId: Long,
        kind: String,
        deltaS: Int,
        config: RulesConfig,
    ): Pair<EngineState, List<LedgerEventOut>> {
        if (commandId in state.appliedCommandIds || state.status == SessionStatus.ENDED || state.status == SessionStatus.EXPIRED) {
            return state to emptyList()
        }
        var s = state.copy(appliedCommandIds = state.appliedCommandIds + commandId)
        val events = mutableListOf<LedgerEventOut>()
        when (kind) {
            "start_session" -> {
                s = start(s, deltaS)
                events += LedgerEventOut("unlocked", 0, "Session started")
            }
            "add_time" -> {
                s = s.copy(grantedS = s.grantedS + deltaS)
                events += LedgerEventOut("manual_add", deltaS, "Added by parent")
                if (s.status == SessionStatus.EXPIRED && s.remainingS > 0) {
                    s = s.copy(status = SessionStatus.ACTIVE, endReason = null)
                }
            }
            "remove_time" -> {
                // Never below zero: remaining stays >= 0 by flooring the deduction.
                val room = (s.grantedS + s.bonusS - s.penaltyS).coerceAtLeast(0)
                val applied = deltaS.coerceAtMost(room)
                s = s.copy(grantedS = (s.grantedS - applied).coerceAtLeast(0))
                if (applied < deltaS) {
                    // deduction that would go negative eats into bonus instead
                    val fromBonus = (deltaS - applied).coerceAtMost(s.bonusS)
                    s = s.copy(bonusS = s.bonusS - fromBonus)
                }
                events += LedgerEventOut("manual_remove", deltaS, "Removed by parent")
            }
            "end_session" -> {
                s = s.copy(status = SessionStatus.ENDED, endReason = "ended")
                events += LedgerEventOut("locked", 0, "Session ended")
            }
            "lock_now" -> {
                s = s.copy(status = SessionStatus.ENDED, endReason = "locked")
                events += LedgerEventOut("locked", 0, "Locked by parent")
            }
        }
        return s to events
    }
}
