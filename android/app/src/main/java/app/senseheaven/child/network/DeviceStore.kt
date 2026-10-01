package app.senseheaven.child.network

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.security.SecureRandom

private val Context.dataStore by preferencesDataStore(name = "senseheaven")

/** What the device persists locally (nothing sensitive beyond the encrypted device token). */
data class PairedState(
    val deviceToken: String?,
    val childId: String?,
    val childName: String?,
    val configVersion: Int,
    val configJson: String?,
    val pinVersion: Int,
    val pinVerifierJson: String?,
)

class DeviceStore(private val context: Context) {

    private val tokenKey = stringPreferencesKey("device_token")
    private val childIdKey = stringPreferencesKey("child_id")
    private val childNameKey = stringPreferencesKey("child_name")
    private val configVersionKey = intPreferencesKey("config_version")
    private val configKey = stringPreferencesKey("config_json")
    private val pinVersionKey = intPreferencesKey("pin_version")
    private val pinVerifierKey = stringPreferencesKey("pin_verifier_json")
    private val queueKey = stringPreferencesKey("event_queue_json")
    private val engineKey = stringPreferencesKey("engine_state_json")
    private val blockedKey = stringSetPreferencesKey("blocked_packages")
    private val allowedKey = stringSetPreferencesKey("allowed_packages")
    private val monitoringKey = stringPreferencesKey("monitoring_enabled")

    val paired: Flow<PairedState> = context.dataStore.data.map { prefs ->
        PairedState(
            deviceToken = prefs[tokenKey],
            childId = prefs[childIdKey],
            childName = prefs[childNameKey],
            configVersion = prefs[configVersionKey] ?: 1,
            configJson = prefs[configKey],
            pinVersion = prefs[pinVersionKey] ?: 0,
            pinVerifierJson = prefs[pinVerifierKey],
        )
    }

    suspend fun savePairing(response: PairResponse) {
        context.dataStore.edit { prefs ->
            prefs[tokenKey] = response.deviceToken
            prefs[childIdKey] = response.child.id
            prefs[childNameKey] = response.child.name
            prefs[configVersionKey] = response.configVersion
            prefs[configKey] = response.config.toString()
            prefs[pinVersionKey] = response.pinVersion
            response.pin?.let { pin ->
                prefs[pinVerifierKey] = kotlinx.serialization.json.Json
                    .encodeToString(PinVerifierDto.serializer(), pin)
            }
        }
    }

    suspend fun updateConfig(configVersion: Int, configJson: String) {
        context.dataStore.edit { prefs ->
            prefs[configVersionKey] = configVersion
            prefs[configKey] = configJson
        }
    }

    suspend fun updatePin(pinVersion: Int, verifierJson: String?) {
        context.dataStore.edit { prefs ->
            prefs[pinVersionKey] = pinVersion
            if (verifierJson != null) prefs[pinVerifierKey] = verifierJson
            else prefs.remove(pinVerifierKey)
        }
    }

    suspend fun wipe() {
        context.dataStore.edit { prefs ->
            prefs.remove(tokenKey); prefs.remove(childIdKey); prefs.remove(childNameKey)
            prefs.remove(configVersionKey); prefs.remove(configKey)
            prefs.remove(pinVersionKey); prefs.remove(pinVerifierKey)
            prefs.remove(queueKey); prefs.remove(engineKey)
            prefs.remove(blockedKey); prefs.remove(allowedKey)
        }
    }

    suspend fun saveQueue(raw: String) = context.dataStore.edit { it[queueKey] = raw }
    suspend fun loadQueue(): String? = context.dataStore.data.first()[queueKey]

    suspend fun saveEngineState(raw: String) = context.dataStore.edit { it[engineKey] = raw }
    suspend fun loadEngineState(): String? = context.dataStore.data.first()[engineKey]

    suspend fun saveLists(blocked: Set<String>, allowed: Set<String>) = context.dataStore.edit {
        it[blockedKey] = blocked; it[allowedKey] = allowed
    }
    suspend fun loadBlocked(): Set<String> = context.dataStore.data.first()[blockedKey] ?: emptySet()
    suspend fun loadAllowed(): Set<String> = context.dataStore.data.first()[allowedKey] ?: emptySet()

    suspend fun setMonitoring(enabled: Boolean) = context.dataStore.edit { it[monitoringKey] = if (enabled) "1" else "0" }
    suspend fun monitoringEnabled(): Boolean = (context.dataStore.data.first()[monitoringKey] ?: "1") == "1"
}

/** 32 random bytes urlsafe — mirrors the server's token format. */
object TokenGenerator {
    fun newDeviceToken(): String {
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }
}
