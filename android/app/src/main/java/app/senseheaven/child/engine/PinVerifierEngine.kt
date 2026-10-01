package app.senseheaven.child.engine

import java.security.MessageDigest
import java.util.Base64
import javax.crypto.spec.PBEKeySpec
import javax.crypto.SecretKeyFactory

/** Verifier bundle delivered at pairing (File 03 binding: PIN verifier). */
data class PinVerifier(
    val iterations: Int,
    val saltB64: String,
    val hashB64: String,
)

/**
 * Local device-PIN verification (File 02 §4): PBKDF2-HMAC-SHA256 with the server's
 * iteration count, constant-time compare, never logged. Pure JVM — unit-testable.
 */
object PinVerifierEngine {

    fun verify(pin: String, verifier: PinVerifier): Boolean {
        if (!pin.matches(Regex("^\\d{6}$"))) return false
        val salt = Base64.getDecoder().decode(verifier.saltB64)
        val expected = Base64.getDecoder().decode(verifier.hashB64)
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val key = factory.generateSecret(PBEKeySpec(pin.toCharArray(), salt, verifier.iterations, 256)).encoded
        return MessageDigest.isEqual(key, expected)
    }
}
