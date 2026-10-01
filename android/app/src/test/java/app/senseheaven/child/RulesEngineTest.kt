package app.senseheaven.child.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Hand-written rules tests (LEAN §1.2: >= 15 pure-Kotlin tests replace golden vectors).
 */
class RulesEngineTest {

    private val config = RulesConfig()
    private fun active(granted: Int = 3600) = RulesEngine.start(EngineState(grantedS = granted), granted)

    private fun sample(ci: Int, quality: Float = 0.9f) = CalmSample(ci, true, quality)

    private fun runSeconds(
        state: EngineState,
        seconds: Int,
        config: RulesConfig = this.config,
        screen: ScreenState = ScreenState.ON_COUNTED,
        clockStart: Long = 0,
        sampleAt: (Int) -> CalmSample?,
    ): Pair<EngineState, List<LedgerEventOut>> {
        var s = state
        val events = mutableListOf<LedgerEventOut>()
        for (second in 0 until seconds) {
            val (next, emitted) = RulesEngine.tick(
                s, 1000L, screen, sampleAt(second), config, clockStart + second,
            )
            s = next
            events += emitted
        }
        return s to events
    }

    // 1 — sustained stress triggers penalty + cooldown
    @Test
    fun sustainedStressTriggersPenaltyAndCooldown() {
        val (state, events) = runSeconds(active(), 305) { sample(20) }
        assertEquals(SessionStatus.COOLDOWN, state.status)
        assertTrue(events.any { it.kind == "stress_alert" })
        assertTrue(events.any { it.kind == "penalty" && it.seconds == 300 })
        assertTrue(events.any { it.kind == "cooldown_start" })
        assertEquals(300, state.penaltyS)
    }

    // 2 — cooldown does not consume time (full 5-minute breather, then back to active)
    @Test
    fun cooldownDoesNotConsumeTime() {
        val (afterStress, _) = runSeconds(active(), 305) { sample(20) }
        assertEquals(SessionStatus.COOLDOWN, afterStress.status)
        val usedAtCooldownStart = afterStress.usedS
        // the breathing screen blocks apps, so the screen is off during the window
        val (state, events) = runSeconds(afterStress, 305, screen = ScreenState.OFF) { null }
        assertEquals(SessionStatus.ACTIVE, state.status)
        assertTrue(events.any { it.kind == "cooldown_end" })
        // 305 s of wall time in cooldown -> zero time consumed (E4 rule 2)
        assertEquals(usedAtCooldownStart, state.usedS)
    }

    // 3 — sustained calm earns a bonus
    @Test
    fun sustainedCalmEarnsBonus() {
        val (state, events) = runSeconds(active(), 905) { sample(85) }
        assertEquals(600, state.bonusS)
        assertTrue(events.any { it.kind == "bonus" && it.seconds == 600 })
    }

    // 4 — bonus cap per session
    @Test
    fun bonusIsCappedPerSession() {
        var state = active(granted = 3600)
        repeat(3) { cycle ->
            val (next, events) = runSeconds(state, 905) { sample(85) }
            state = next
            if (cycle < 2) assertTrue("bonus on cycle $cycle", events.any { it.kind == "bonus" })
        }
        // E4 rule 3: bonus_total + good_bonus <= cap -> 3 x 10 min bonuses = 30 min exactly
        assertEquals(1800, state.bonusS)
    }

    // 5 — penalty lockout window is respected
    @Test
    fun penaltyLockoutPreventsRepeat() {
        var state = active(granted = 24 * 3600)
        val (afterFirst, firstEvents) = runSeconds(state, 305) { sample(20) }
        assertEquals(1, firstEvents.count { it.kind == "penalty" })
        // cooldown ends (~300 s later), stress resumes — inside the 15-min lockout: no penalty
        var s = afterFirst
        var clock = 305L
        repeat(700) {
            val (next, events) = RulesEngine.tick(s, 1000L, ScreenState.ON_COUNTED, sample(20), config, clock)
            s = next
            clock += 1
            if (events.any { it.kind == "penalty" }) error("penalty inside lockout")
        }
        assertEquals(SessionStatus.ACTIVE, s.status)
    }

    // 6 — no face freezes the runs
    @Test
    fun noFaceFreezesRuns() {
        var state = active()
        state = runSeconds(state, 100) { sample(20) }.first
        // EMA starts at 75 and needs ~6 s to fall below 35, so the run lags by 5 s
        assertEquals(95, state.stressRunS)
        state = runSeconds(state, 30) { null }.first
        assertEquals(95, state.stressRunS)
    }

    // 7 — a long no-signal gap resets both runs
    @Test
    fun longNoSignalResetsRuns() {
        var state = active()
        state = runSeconds(state, 100) { sample(20) }.first
        state = runSeconds(state, 125) { null }.first
        assertEquals(0, state.stressRunS) // > 120 s gap resets both runs
    }

    // 8 — per-tick delta is capped at 5 s
    @Test
    fun tickDeltaIsCapped() {
        val (state, _) = with(RulesEngine) {
            tick(active(), 60_000L, ScreenState.ON_COUNTED, sample(80), config, 0)
        }
        assertEquals(5, state.usedS)
    }

    // 9 — remove_time never takes remaining below zero
    @Test
    fun removeTimeNeverBelowZero() {
        val state = active(granted = 600)
        val (after, events) = RulesEngine.applyCommand(state, 1, "remove_time", 5000, config)
        assertTrue(events.any { it.kind == "manual_remove" })
        assertTrue(after.remainingS >= 0)
        assertEquals(0, after.remainingS)
    }

    // 10 — duplicate commands are ignored (idempotent by id)
    @Test
    fun duplicateCommandIgnored() {
        val state = active(granted = 600)
        val (once, events1) = RulesEngine.applyCommand(state, 7, "add_time", 300, config)
        val (twice, events2) = RulesEngine.applyCommand(once, 7, "add_time", 300, config)
        assertEquals(900, once.grantedS)
        assertEquals(once.grantedS, twice.grantedS)
        assertTrue(events2.isEmpty())
        assertEquals(1, events1.count { it.kind == "manual_add" })
    }

    // 11 — session expires at zero remaining
    @Test
    fun sessionExpiresAtZero() {
        val (state, events) = runSeconds(active(granted = 30), 35) { sample(80) }
        assertEquals(SessionStatus.EXPIRED, state.status)
        assertTrue(events.any { it.kind == "locked" })
    }

    // 12 — low_time fires once per threshold
    @Test
    fun lowTimeFiresOnceEach() {
        val (state, events) = runSeconds(active(granted = 400), 400) { sample(80) }
        assertEquals(1, events.count { it.kind == "low_time" && it.seconds == 300 })
        assertEquals(1, events.count { it.kind == "low_time" && it.seconds == 60 })
        assertTrue(state.lowTime300Fired && state.lowTime60Fired)
    }

    // 13 — persistence round-trip
    @Test
    fun persistenceRoundTrip() {
        val (state, _) = runSeconds(active(), 320) { sample(20) }
        val restored = RulesEngine.deserialize(RulesEngine.serialize(state))
        assertEquals(state, restored)
    }

    // 14 — hysteresis: values oscillating around the threshold don't flap
    @Test
    fun hysteresisDoesNotFlap() {
        var state = active()
        var flaps = 0
        var last: Label = Label.NEUTRAL
        for (second in 0 until 60) {
            // sawtooth around 34: crosses into stressed, hovers near the threshold, never
            // reaches the leave level (40) — so exactly one entry, no flapping
            val ci = if (second % 2 == 0) 30 else 38
            state = RulesEngine.tick(state, 1000L, ScreenState.ON_COUNTED, sample(ci), config, second.toLong()).first
            if (last != Label.STRESSED && state.label == Label.STRESSED) flaps += 1
            last = state.label
        }
        // enters stressed once (first below-threshold sample), never leaves until >= 40
        assertEquals(Label.STRESSED, state.label)
        assertEquals(1, flaps)
    }

    // 15 — wall-clock jumps have no effect (monotonic deltas only)
    @Test
    fun clockJumpHasNoEffect() {
        val a = RulesEngine.tick(active(), 1000L, ScreenState.ON_COUNTED, sample(80), config, 0).first
        // a huge clock value arrives; the same 1 s delta must produce the same accounting
        val b = RulesEngine.tick(active(), 1000L, ScreenState.ON_COUNTED, sample(80), config, 10_000_000L).first
        assertEquals(a.usedS, b.usedS)
        assertEquals(a.ema, b.ema, 1e-6f)
    }

    // 16 — screen off / allowed apps don't consume time
    @Test
    fun screenOffOrAllowedDoesNotConsume() {
        val (off, _) = runSeconds(active(), 10, screen = ScreenState.OFF) { sample(80) }
        assertEquals(0, off.usedS)
        val (allowed, _) = runSeconds(active(), 10, screen = ScreenState.ON_ALLOWED) { sample(80) }
        assertEquals(0, allowed.usedS)
    }

    // 17 — EMA seed and quality gate
    @Test
    fun lowQualitySampleIsTreatedAsNoSignal() {
        var state = active()
        state = runSeconds(state, 50) { sample(20) }.first
        state = runSeconds(state, 10) { CalmSample(85, true, 0.3f) }.first
        // low-quality seconds don't move the EMA or the runs (50 - 5 EMA warm-up = 45)
        assertEquals(45, state.stressRunS)
    }
}
