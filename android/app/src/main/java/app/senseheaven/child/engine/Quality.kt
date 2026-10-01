package app.senseheaven.child.engine

import kotlin.math.max
import kotlin.math.min

/**
 * Quality gate (LEAN §6.6, mirrors ml/src/quality_ref.py):
 * quality = min(size_score, light_score); a valid sample needs quality >= 0.5.
 */
object Quality {
    fun sizeScore(faceBboxArea: Float, frameArea: Float): Float {
        if (frameArea <= 0f) return 0f
        val ratio = faceBboxArea / frameArea
        if (ratio <= 0.04f) return 0f
        if (ratio >= 0.12f) return 1f
        return ((ratio - 0.04f) / 0.08f).coerceIn(0f, 1f)
    }

    fun lightScore(meanLuma: Float): Float = if (meanLuma in 40f..220f) 1f else 0.3f

    fun quality(faceBboxArea: Float, frameArea: Float, meanLuma: Float): Float =
        min(sizeScore(faceBboxArea, frameArea), lightScore(meanLuma))

    fun isValid(quality: Float): Boolean = quality >= 0.5f
}

/**
 * Wrong-PIN lockout (E6-15): 5 misses → 15 minutes, doubling on each subsequent lockout.
 * Pure logic on an injected clock.
 */
class PinLockout(
    private val maxAttempts: Int = 5,
    private val baseLockoutMs: Long = 15 * 60_000L,
) {
    private var failures = 0
    private var lockoutUntilMs = 0L
    private var lockoutCount = 0

    fun recordFailure(nowMs: Long) {
        failures += 1
        if (failures >= maxAttempts) {
            lockoutCount += 1
            var ms = baseLockoutMs
            repeat(lockoutCount - 1) { ms *= 2 }
            lockoutUntilMs = nowMs + ms
            failures = 0
        }
    }

    fun recordSuccess() {
        failures = 0
        lockoutCount = 0
        lockoutUntilMs = 0L
    }

    fun isLockedOut(nowMs: Long): Boolean = nowMs < lockoutUntilMs

    fun remainingLockoutMs(nowMs: Long): Long = max(0L, lockoutUntilMs - nowMs)
}
