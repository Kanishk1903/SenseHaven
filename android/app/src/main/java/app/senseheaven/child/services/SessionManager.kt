package app.senseheaven.child.services

import android.content.Context
import app.senseheaven.child.engine.EngineState
import app.senseheaven.child.engine.EventQueue
import app.senseheaven.child.engine.LedgerEventOut
import app.senseheaven.child.engine.PinVerifier
import app.senseheaven.child.engine.PinVerifierEngine
import app.senseheaven.child.engine.QueuedEvent
import app.senseheaven.child.engine.RulesConfig
import app.senseheaven.child.engine.RulesEngine
import app.senseheaven.child.engine.ScreenState
import app.senseheaven.child.engine.CalmSample
import app.senseheaven.child.network.CommandDto
import app.senseheaven.child.BuildConfig
import app.senseheaven.child.network.DeviceApi
import app.senseheaven.child.network.DeviceStore
import app.senseheaven.child.network.EmotionEventDto
import app.senseheaven.child.network.EventsBatch
import app.senseheaven.child.network.HeartbeatDto
import app.senseheaven.child.network.HeartbeatPermissions
import app.senseheaven.child.network.PairRequest
import app.senseheaven.child.network.PinVerifierDto
import app.senseheaven.child.network.LedgerEventDto
import app.senseheaven.child.network.SessionSnapshotDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

/** UI-facing snapshot of the whole child-app state (Home renders from this). */
data class SessionUiState(
    val paired: Boolean = false,
    val status: String = "none",
    val remainingS: Int = 0,
    val grantedS: Int = 0,
    val bonusS: Int = 0,
    val penaltyS: Int = 0,
    val calmIndex: Int? = null,
    val label: String = "neutral",
    val cameraOk: Boolean = true,
    val monitoringEnabled: Boolean = true,
    val showMoodToChild: Boolean = false,
    val lastSyncAtMs: Long = 0,
    val lockedOutUntilMs: Long = 0,
    val childName: String? = null,
)

/**
 * Owns the engine, the event queue and the sync loop (5d + 5e). One instance per process
 * (SenseHeavenApp). The GuardService drives [onTick] every second; the sync coroutine posts
 * batches. Persisted state survives restarts (E6-4).
 */
class SessionManager(
    private val context: Context,
    private val apiFactory: (String, okhttp3.Interceptor) -> DeviceApi = DeviceApi::create,
) {
    private val store = DeviceStore(context)
    private val queue = EventQueue()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val _ui = MutableStateFlow(SessionUiState())
    val ui: StateFlow<SessionUiState> = _ui

    var baseUrl: String = BuildConfig.BASE_URL
    private var api: DeviceApi? = null
    private var token: String? = null

    // engine inputs
    var config: RulesConfig = RulesConfig()
        private set
    var engineState: EngineState = EngineState()
        private set
    var lastCalmSample: CalmSample? = null
        private set
    var foregroundPackage: String? = null
    var screenInteractive: Boolean = false
    var cameraOk: Boolean = true
    var permissions: HeartbeatPermissions = HeartbeatPermissions()
    var batteryPct: Int? = null
    var monotonicClockS: Long = 0

    // session session_id: server-created (start_session command) or device-generated
    private var sessionId: String? = null
    private var sessionStartedAt: Instant? = null
    private var configVersion = 1
    private var pinVersion = 0
    private var lastSeenEmotionAtMs = 0L

    private val backoff = app.senseheaven.child.engine.Backoff()
    private var cachedVerifier: PinVerifier? = null
    private var syncAttempt = 0
    private val pinLockout = app.senseheaven.child.engine.PinLockout()

    /** Restore persisted engine + queue (E6-4: reboot mid-session restores state). */
    suspend fun restore() = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        restoreIO()
    }

    private suspend fun restoreIO() {
        val paired = store.paired.first()
        token = paired.deviceToken
        _ui.value = _ui.value.copy(paired = paired.deviceToken != null, childName = paired.childName)
        configVersion = paired.configVersion
        pinVersion = paired.pinVersion
        if (paired.deviceToken != null) {
            api = apiFactory(baseUrl) { chain ->
                chain.proceed(chain.request().newBuilder()
                    .header("Authorization", "Bearer ${paired.deviceToken}").build())
            }
        }
        store.loadEngineState()?.let { raw ->
            runCatching { engineState = RulesEngine.deserialize(raw) }
        }
        runCatching {
            val pairedNow = paired
            pairedNow.pinVerifierJson?.let { raw ->
                cachedVerifier = json.decodeFromString(PinVerifier.serializer(), raw)
            }
        }
        store.loadQueue()?.let { raw -> runCatching { queue.deserialize(raw) } }
        config = parseConfig(paired.configJson)
        _ui.value = _ui.value.copy(
            status = engineState.status.name.lowercase(),
            remainingS = max(0, engineState.remainingS),
            grantedS = engineState.grantedS,
            bonusS = engineState.bonusS,
            penaltyS = engineState.penaltyS,
        )
    }

    private fun readShowMood(configJson: String?): Boolean {
        if (configJson.isNullOrBlank()) return false
        return runCatching {
            (json.parseToJsonElement(configJson).jsonObject["show_mood_to_child"] as? JsonPrimitive)
                ?.content?.toBooleanStrictOrNull() ?: false
        }.getOrDefault(false)
    }

    private fun parseConfig(configJson: String?): RulesConfig {
        if (configJson.isNullOrBlank()) return RulesConfig()
        return runCatching {
            val obj = json.parseToJsonElement(configJson).jsonObject
            fun int(key: String, default: Int) =
                (obj[key] as? JsonPrimitive)?.content?.toIntOrNull() ?: default
            val allowed = (obj["allowed_packages"] as? JsonObject)?.let {
                json.decodeFromString<List<String>>(it.toString())
            } ?: emptyList()
            RulesConfig(
                goodBonusMin = int("good_bonus_min", 10),
                stressPenaltyMin = int("stress_penalty_min", 5),
                cooldownMin = int("cooldown_min", 5),
                maxBonusPerSessionMin = int("max_bonus_per_session_min", 30),
                calmThreshold = int("calm_threshold", 70),
                stressThreshold = int("stress_threshold", 35),
                sustainedStressS = int("sustained_stress_s", 300),
                sustainedCalmS = int("sustained_calm_s", 900),
                penaltyLockoutS = int("penalty_lockout_s", 900),
                allowedPackages = allowed.toSet(),
            )
        }.getOrDefault(RulesConfig())
    }

    /** Called every 1 s by GuardService using SystemClock.elapsedRealtime deltas. */
    suspend fun onTick(dtMs: Long, lastFrame: CalmSample?) {
        monotonicClockS += max(1L, dtMs / 1000L)
        lastCalmSample = injectedSample ?: (lastFrame ?: lastCalmSample)
        val screen = when {
            !screenInteractive -> ScreenState.OFF
            foregroundPackage != null && foregroundPackage in config.allowedPackages -> ScreenState.ON_ALLOWED
            else -> ScreenState.ON_COUNTED
        }
        // fast-forward pays the debt as a burst of engine-ticks capped at 5 s each (E4 cap)
        val allEvents = mutableListOf<LedgerEventOut>()
        while (fastForwardDebtS > 0) {
            val step = min(5, fastForwardDebtS).toLong()
            fastForwardDebtS -= step.toInt()
            monotonicClockS += step
            val (next, events) = RulesEngine.tick(
                engineState, step * 1000L, screen, injectedSample, config, monotonicClockS,
            )
            engineState = next
            allEvents += events
            if (engineState.status == app.senseheaven.child.engine.SessionStatus.ENDED ||
                engineState.status == app.senseheaven.child.engine.SessionStatus.EXPIRED
            ) {
                fastForwardDebtS = 0
            }
        }
        val (next, events) = RulesEngine.tick(
            engineState, dtMs, screen, injectedSample ?: lastFrame, config, monotonicClockS,
        )
        engineState = next
        allEvents += events
        enqueueLedger(allEvents)
        persistEngine()
        publish()
    }

    /** Apply one server command; idempotent by id inside the engine. */
    suspend fun applyCommand(command: CommandDto) {
        val payload = command.payload
        fun int(key: String) = (payload[key] as? JsonPrimitive)?.content?.toIntOrNull() ?: 0
        val amount = int(if (command.kind == "start_session") "duration_s" else "delta_s")
        val (next, events) = RulesEngine.applyCommand(
            engineState, command.id, command.kind, amount, config,
        )
        if (command.kind == "start_session") {
            sessionId = (payload["session_id"] as? JsonPrimitive)?.content ?: sessionId ?: UUID.randomUUID().toString()
            sessionStartedAt = Instant.now()
        }
        engineState = next
        enqueueLedger(events)
        persistEngine()
        publish()
    }

    fun enqueueLedger(events: List<LedgerEventOut>) {
        val now = System.currentTimeMillis()
        for (event in events) {
            queue.add(
                QueuedEvent(
                    kind = "ledger",
                    payloadJson = json.encodeToString(
                        LedgerEventDto.serializer(),
                        LedgerEventDto(
                            clientUuid = UUID.randomUUID().toString(),
                            sessionId = sessionId,
                            ts = Instant.ofEpochMilli(now).toString(),
                            kind = event.kind,
                            seconds = event.seconds,
                            reason = event.reason,
                        ),
                    ),
                    clientUuid = null,
                    createdAtMs = now,
                ),
            )
        }
    }

    /** One emotion sample per 10 s (mean of valid CI values since the last upload). */
    fun enqueueEmotion(calmIndex: Int, label: String, quality: Float, facePresent: Boolean) {
        val now = System.currentTimeMillis()
        if (now - lastSeenEmotionAtMs < 9_000L) return
        lastSeenEmotionAtMs = now
        queue.add(
            QueuedEvent(
                kind = "emotion",
                payloadJson = json.encodeToString(
                    EmotionEventDto.serializer(),
                    EmotionEventDto(
                        clientUuid = UUID.randomUUID().toString(),
                        sessionId = sessionId,
                        ts = Instant.ofEpochMilli(now).toString(),
                        calmIndex = calmIndex,
                        label = label,
                        facePresent = facePresent,
                        quality = quality,
                    ),
                ),
                createdAtMs = now,
            ),
        )
    }

    fun enqueueSessionSnapshot() {
        val now = System.currentTimeMillis()
        queue.add(
            QueuedEvent(
                kind = "session",
                payloadJson = json.encodeToString(
                    SessionSnapshotDto.serializer(),
                    SessionSnapshotDto(
                        id = sessionId ?: return,
                        status = engineState.status.name.lowercase(),
                        grantedS = engineState.grantedS,
                        bonusS = engineState.bonusS,
                        penaltyS = engineState.penaltyS,
                        usedS = engineState.usedS,
                        startedAt = sessionStartedAt?.toString(),
                        endedAt = if (engineState.status == app.senseheaven.child.engine.SessionStatus.ENDED ||
                            engineState.status == app.senseheaven.child.engine.SessionStatus.EXPIRED
                        ) Instant.ofEpochMilli(now).toString() else null,
                        endReason = engineState.endReason,
                    ),
                ),
                createdAtMs = now,
            ),
        )
    }

    fun buildHeartbeat(): HeartbeatDto = HeartbeatDto(
        usedS = engineState.usedS,
        remainingS = max(0, engineState.remainingS),
        batteryPct = batteryPct,
        cameraOk = cameraOk,
        permissions = permissions,
    )

    /** One sync round: pull config/commands, push a batch, ack commands. Returns success. */
    suspend fun syncOnce(): Boolean = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        syncOnceIO()
    }

    private suspend fun syncOnceIO(): Boolean {
        val api = this.api ?: return false
        return try {
            val response = api.sync(configVersion, pinVersion)
            syncAttempt = 0
            response.config?.let { configElement ->
                val raw = configElement.toString()
                config = parseConfig(raw)
                configVersion = response.configVersion
                store.updateConfig(response.configVersion, raw)
                _ui.value = _ui.value.copy(showMoodToChild = readShowMood(raw))
            }
            response.pin?.let { pinDto ->
                pinVersion = response.pinVersion
                cachedVerifier = PinVerifier(pinDto.iterations, pinDto.saltB64, pinDto.hashB64)
                store.updatePin(response.pinVersion, json.encodeToString(PinVerifierDto.serializer(), pinDto))
            }
            for (command in response.commands) {
                applyCommand(command)
                runCatching { api.ackCommand(command.id) }
            }
            enqueueSessionSnapshot()
            // the batch always carries the heartbeat, even when the queue is empty
            val batch = queue.batch(200)
            val dto = json.decodeFromString(EventsBatch.serializer(), serializeBatch(batch))
            api.events(dto)
            queue.remove(batch)
            store.saveQueue(queue.serialize())
            _ui.value = _ui.value.copy(lastSyncAtMs = System.currentTimeMillis())
            true
        } catch (error: Exception) {
            syncAttempt += 1
            false
        }
    }

    fun nextSyncDelayMs(): Long = when {
        syncAttempt == 0 -> if (engineState.status == app.senseheaven.child.engine.SessionStatus.ACTIVE) 10_000L else 15_000L
        else -> backoff.delayFor(syncAttempt - 1)
    }

    private fun serializeBatch(batch: List<QueuedEvent>): String {
        val emotion = mutableListOf<EmotionEventDto>()
        val ledger = mutableListOf<LedgerEventDto>()
        val sessions = mutableListOf<SessionSnapshotDto>()
        for (item in batch) {
            when (item.kind) {
                "emotion" -> emotion += json.decodeFromString(EmotionEventDto.serializer(), item.payloadJson)
                "ledger" -> ledger += json.decodeFromString(LedgerEventDto.serializer(), item.payloadJson)
                "session" -> sessions += json.decodeFromString(SessionSnapshotDto.serializer(), item.payloadJson)
            }
        }
        return json.encodeToString(
            EventsBatch.serializer(),
            EventsBatch(
                sentAt = Instant.now().toString(),
                emotion = emotion,
                ledger = ledger,
                sessions = sessions,
                heartbeat = buildHeartbeat(),
            ),
        )
    }

    suspend fun persistEngine() {
        store.saveEngineState(RulesEngine.serialize(engineState))
        store.saveQueue(queue.serialize())
    }

    private fun publish() {
        _ui.value = _ui.value.copy(
            status = engineState.status.name.lowercase(),
            remainingS = max(0, engineState.remainingS),
            grantedS = engineState.grantedS,
            bonusS = engineState.bonusS,
            penaltyS = engineState.penaltyS,
            calmIndex = lastCalmSample?.calmIndex,
        )
    }

    // ---- pairing + PIN ----

    suspend fun pair(code: String): Pair<Boolean, String?> {
        val api = apiFactory(baseUrl) { chain -> chain.proceed(chain.request()) }
        return try {
            val response = api.pair(
                PairRequest(
                    code = code,
                    deviceName = android.os.Build.MODEL ?: "Android phone",
                    androidVersion = "Android ${android.os.Build.VERSION.RELEASE}",
                    appVersion = BuildConfig.VERSION_NAME,
                ),
            )
            token = response.deviceToken
            // new pairing = fresh engine: a previous child's ended session must not leak
            engineState = EngineState()
            sessionId = null
            sessionStartedAt = null
            queue.let { /* queue cleared below via wipe+save */ }
            store.wipe()          // clears token/queue/engine keys...
            store.savePairing(response)  // ...then the new pairing is written
            store.saveQueue(queue.serialize())
            this.api = apiFactory(baseUrl) { chain ->
                chain.proceed(chain.request().newBuilder()
                    .header("Authorization", "Bearer ${response.deviceToken}").build())
            }
            fastForwardDebtS = 0
            injectedSample = null
            config = parseConfig(response.config.toString())
            configVersion = response.configVersion
            pinVersion = response.pinVersion
            _ui.value = _ui.value.copy(paired = true, childName = response.child.name)
            true to null
        } catch (error: Exception) {
            false to error.message
        }
    }

    /** Local PIN check against the server verifier (never logs the PIN). */
    fun verifyPin(pin: String): Boolean {
        val verifier = cachedVerifier ?: return false
        val ok = PinVerifierEngine.verify(pin, verifier)
        if (ok) pinLockout.recordSuccess() else pinLockout.recordFailure(System.currentTimeMillis())
        _ui.value = _ui.value.copy(
            lockedOutUntilMs = System.currentTimeMillis() + pinLockout.remainingLockoutMs(System.currentTimeMillis()),
        )
        return ok
    }

    suspend fun pinLockedOutNow(): Boolean = pinLockout.isLockedOut(System.currentTimeMillis())

    fun isPinLockedOut(): Boolean = pinLockout.isLockedOut(System.currentTimeMillis())

    suspend fun unpair() {
        store.wipe()
        api = null
        token = null
        engineState = EngineState()
        sessionId = null
        _ui.value = SessionUiState(paired = false)
    }

    fun timezone(): ZoneId = ZoneId.systemDefault()

    // ---- demo tools (5e, LEAN-mandatory): inject / fast-forward / dump ----

    private var injectedSample: app.senseheaven.child.engine.CalmSample? = null
    private var fastForwardDebtS = 0

    /** Bypasses the model entirely so rules can be tested without a face. */
    fun injectCalmIndex(ci: Int) {
        injectedSample = app.senseheaven.child.engine.CalmSample(ci.coerceIn(0, 100), true, 1f)
    }

    fun fastForward(seconds: Int) {
        fastForwardDebtS += seconds
    }

    fun takeInjection(): app.senseheaven.child.engine.CalmSample? {
        val injected = injectedSample
        if (injected != null && fastForwardDebtS > 0) {
            fastForwardDebtS -= 1
        }
        return injected
    }

    fun dumpState(): String {
        val state = engineState
        val payload = mapOf(
            "status" to state.status.name.lowercase(),
            "remaining_s" to state.remainingS.toString(),
            "used_s" to state.usedS.toString(),
            "bonus_s" to state.bonusS.toString(),
            "penalty_s" to state.penaltyS.toString(),
            "session_id" to (sessionId ?: ""),
        )
        return json.encodeToString(
            kotlinx.serialization.serializer<Map<String, String>>(),
            payload,
        )
    }
}
