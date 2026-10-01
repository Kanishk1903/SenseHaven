package app.senseheaven.child.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Retrofit DTOs — mirrors the File 03 binding payload shapes exactly. */

@Serializable
data class PairRequest(
    val code: String,
    @SerialName("device_name") val deviceName: String,
    @SerialName("android_version") val androidVersion: String,
    @SerialName("app_version") val appVersion: String,
)

@Serializable
data class PinVerifierDto(
    val algo: String,
    val iterations: Int,
    @SerialName("salt_b64") val saltB64: String,
    @SerialName("hash_b64") val hashB64: String,
)

@Serializable
data class PairResponse(
    @SerialName("device_token") val deviceToken: String,
    val child: ChildInfo,
    @SerialName("config_version") val configVersion: Int,
    val config: Map<String, kotlinx.serialization.json.JsonElement>,
    val pin: PinVerifierDto? = null,
    @SerialName("pin_version") val pinVersion: Int = 0,
)

@Serializable
data class ChildInfo(val id: String, val name: String)

@Serializable
data class CommandDto(
    val id: Long,
    val kind: String,
    val payload: Map<String, kotlinx.serialization.json.JsonElement> = emptyMap(),
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class SessionDto(
    val id: String,
    val status: String,
    @SerialName("granted_s") val grantedS: Int,
    @SerialName("bonus_s") val bonusS: Int,
    @SerialName("penalty_s") val penaltyS: Int,
    @SerialName("used_s") val usedS: Int,
)

@Serializable
data class SyncResponse(
    @SerialName("server_time") val serverTime: String,
    @SerialName("config_version") val configVersion: Int,
    val config: Map<String, kotlinx.serialization.json.JsonElement>? = null,
    val pin: PinVerifierDto? = null,
    @SerialName("pin_version") val pinVersion: Int = 0,
    val session: SessionDto? = null,
    val commands: List<CommandDto> = emptyList(),
)

@Serializable
data class EmotionEventDto(
    @SerialName("client_uuid") val clientUuid: String,
    @SerialName("session_id") val sessionId: String? = null,
    val ts: String,
    @SerialName("calm_index") val calmIndex: Int,
    val label: String,
    @SerialName("face_present") val facePresent: Boolean,
    val quality: Float,
)

@Serializable
data class LedgerEventDto(
    @SerialName("client_uuid") val clientUuid: String,
    @SerialName("session_id") val sessionId: String? = null,
    val ts: String,
    val kind: String,
    val seconds: Int = 0,
    val reason: String? = null,
)

@Serializable
data class AppUsageDto(
    val date: String,
    val `package`: String,
    val label: String,
    val seconds: Int,
)

@Serializable
data class SessionSnapshotDto(
    val id: String,
    val status: String,
    @SerialName("granted_s") val grantedS: Int,
    @SerialName("bonus_s") val bonusS: Int,
    @SerialName("penalty_s") val penaltyS: Int,
    @SerialName("used_s") val usedS: Int,
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("ended_at") val endedAt: String? = null,
    @SerialName("end_reason") val endReason: String? = null,
    val source: String = "parent_web",
)

@Serializable
data class HeartbeatPermissions(
    val camera: Boolean = false,
    val notifications: Boolean = false,
    val usage_access: Boolean = false,
    val overlay: Boolean = false,
)

@Serializable
data class HeartbeatDto(
    @SerialName("used_s") val usedS: Int,
    @SerialName("remaining_s") val remainingS: Int? = null,
    @SerialName("battery_pct") val batteryPct: Int? = null,
    @SerialName("camera_ok") val cameraOk: Boolean = false,
    val permissions: HeartbeatPermissions = HeartbeatPermissions(),
)

@Serializable
data class EventsBatch(
    @SerialName("sent_at") val sentAt: String? = null,
    val emotion: List<EmotionEventDto> = emptyList(),
    val ledger: List<LedgerEventDto> = emptyList(),
    @SerialName("app_usage") val appUsage: List<AppUsageDto> = emptyList(),
    val sessions: List<SessionSnapshotDto> = emptyList(),
    val heartbeat: HeartbeatDto? = null,
)

@Serializable
data class EventsAck(
    val accepted: Map<String, Int>,
    val duplicates: Int,
)

@Serializable
data class ProblemDto(
    val code: String? = null,
    val detail: String? = null,
    @SerialName("request_id") val requestId: String? = null,
)
