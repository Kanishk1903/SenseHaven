package app.senseheaven.child

import app.senseheaven.child.engine.Backoff
import app.senseheaven.child.engine.EventQueue
import app.senseheaven.child.engine.PinLockout
import app.senseheaven.child.engine.PinVerifier
import app.senseheaven.child.engine.PinVerifierEngine
import app.senseheaven.child.engine.QueuedEvent
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.spec.PBEKeySpec
import javax.crypto.SecretKeyFactory
import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SupportingEnginesTest {

    // ---- PIN verifier: PBKDF2 round-trip + constant-time rejects ----

    private fun makeVerifier(pin: String, iterations: Int = 1000): PinVerifier {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(PBEKeySpec(pin.toCharArray(), salt, iterations, 256)).encoded
        return PinVerifier(iterations, Base64.getEncoder().encodeToString(salt), Base64.getEncoder().encodeToString(key))
    }

    @Test
    fun pinVerifierAcceptsCorrectPin() {
        val verifier = makeVerifier("123456")
        assertTrue(PinVerifierEngine.verify("123456", verifier))
    }

    @Test
    fun pinVerifierRejectsWrongAndMalformed() {
        val verifier = makeVerifier("123456")
        assertFalse(PinVerifierEngine.verify("654321", verifier))
        assertFalse(PinVerifierEngine.verify("12345", verifier))  // malformed
        assertFalse(PinVerifierEngine.verify("12345a", verifier)) // non-digit
    }

    // ---- PIN lockout: 5 misses -> 15 min, doubling ----

    @Test
    fun fiveMissesLockFor15MinutesThenDouble() {
        val lockout = PinLockout()
        val now = 1_000_000L
        repeat(4) { lockout.recordFailure(now) }
        assertFalse(lockout.isLockedOut(now))
        lockout.recordFailure(now) // 5th miss
        assertTrue(lockout.isLockedOut(now))
        assertEquals(15 * 60_000L, lockout.remainingLockoutMs(now))
        val afterFirst = now + 15 * 60_000L
        assertFalse(lockout.isLockedOut(afterFirst))
        // next lockout doubles
        repeat(5) { lockout.recordFailure(afterFirst) }
        assertEquals(30 * 60_000L, lockout.remainingLockoutMs(afterFirst))
    }

    @Test
    fun successResetsLockout() {
        val lockout = PinLockout()
        repeat(5) { lockout.recordFailure(0L) }
        lockout.recordSuccess()
        assertFalse(lockout.isLockedOut(0L))
    }

    // ---- backoff: exponential with cap, jitter never exceeds cap ----

    @Test
    fun backoffGrowsExponentiallyAndCaps() {
        val backoff = Backoff(baseMs = 1000, capMs = 300_000, jitterMs = 0, random = Random(1))
        assertEquals(1000L, backoff.delayFor(0))
        assertEquals(2000L, backoff.delayFor(1))
        assertEquals(16_000L, backoff.delayFor(4))
        assertEquals(300_000L, backoff.delayFor(20))
    }

    @Test
    fun backoffJitterNeverExceedsCap() {
        val backoff = Backoff(baseMs = 1000, capMs = 5000, jitterMs = 5000, random = Random(42))
        repeat(50) { attempt ->
            assertTrue(backoff.delayFor(attempt) in 1000..5000)
        }
    }

    // ---- event queue: cap drops oldest emotion first, batch/remove, round-trip ----

    @Test
    fun queueCapsAt2000DroppingOldestEmotionFirst() {
        val queue = EventQueue(cap = 5)
        val ledger = QueuedEvent("ledger", "{}", "l1")
        queue.add(ledger)
        repeat(6) { index -> queue.add(QueuedEvent("emotion", "{}", "e$index")) }
        assertEquals(5, queue.size)
        // ledger survives; the oldest emotions were dropped
        assertTrue(queue.batch(10).any { it.kind == "ledger" })
        val uuids = queue.batch(10).mapNotNull { it.clientUuid }
        assertFalse(uuids.contains("e0"))
        assertFalse(uuids.contains("e1"))
    }

    @Test
    fun queueBatchAndRemoveAfterAck() {
        val queue = EventQueue()
        repeat(250) { index -> queue.add(QueuedEvent("emotion", "{}", "e$index")) }
        val batch = queue.batch(200)
        assertEquals(200, batch.size)
        assertEquals("e0", batch.first().clientUuid)
        queue.remove(batch)
        assertEquals(50, queue.size)
    }

    @Test
    fun queueRoundTripKeepsOrder() {
        val queue = EventQueue()
        queue.add(QueuedEvent("ledger", "{}", "a"))
        queue.add(QueuedEvent("emotion", "{}", "b"))
        val raw = queue.serialize()
        val restored = EventQueue()
        restored.deserialize(raw)
        assertEquals(listOf("a", "b"), restored.batch(10).mapNotNull { it.clientUuid })
    }
}
