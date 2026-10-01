package app.senseheaven.child.engine

import kotlin.math.min
import kotlin.random.Random

/**
 * Exponential backoff with jitter, capped at 5 min (File 01 §E5): retry after
 * base * 2^attempt + jitter, up to the cap. Deterministic seed for tests.
 */
class Backoff(
    private val baseMs: Long = 1_000L,
    private val capMs: Long = 5 * 60_000L,
    private val jitterMs: Long = 500L,
    private val random: Random = Random.Default,
) {
    /** [attempt] is zero-based; consecutive failures increase it. */
    fun delayFor(attempt: Int): Long {
        val exponential = baseMs * (1L shl min(attempt, 30))
        val capped = min(exponential, capMs)
        val jitter = if (jitterMs > 0) random.nextLong(0, jitterMs) else 0L
        return min(capped + jitter, capMs)
    }
}
