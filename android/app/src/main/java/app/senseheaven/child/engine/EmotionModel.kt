package app.senseheaven.child.engine

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * The on-device emotion model (D-5): JSON weights + this tiny forward pass, exactly
 * mirroring ml/src/forward_ref.py (float32 maths, floor(x+0.5) rounding).
 *
 *   p  = sigmoid((clamp01(x) - mean)/max(std,1e-3) · w + b)
 *   ci = clamp(floor(anchor - slope*(p - baseline) + 0.5), 0, 100)
 */
@Serializable
data class EmotionModelJson(
    @SerialName("schema_version") val schemaVersion: Int,
    @SerialName("model_id") val modelId: String = "",
    val tier: String,
    @SerialName("feature_names") val featureNames: List<String>,
    val mean: List<Float>,
    val std: List<Float>,
    val weights: List<Float>,
    val bias: Float,
    @SerialName("calm_index") val calmIndex: CalmIndexConfig,
) {
    @Serializable
    data class CalmIndexConfig(
        val anchor: Int,
        val slope: Int,
        @SerialName("default_baseline") val defaultBaseline: Float,
        @SerialName("baseline_clamp") val baselineClamp: Float = 0.25f,
    )
}

class EmotionModel private constructor(private val model: EmotionModelJson) {

    companion object {
        fun fromJson(raw: String): EmotionModel {
            val parsed = Json { ignoreUnknownKeys = true }.decodeFromString(EmotionModelJson.serializer(), raw)
            val n = parsed.featureNames.size
            require(parsed.mean.size == n && parsed.std.size == n && parsed.weights.size == n) {
                "model arrays must match feature_names length $n"
            }
            parsed.mean.forEach { require(it.isFinite()) { "non-finite mean" } }
            parsed.std.forEach { require(it.isFinite()) { "non-finite std" } }
            parsed.weights.forEach { require(it.isFinite()) { "non-finite weight" } }
            return EmotionModel(parsed)
        }
    }

    val featureNames: List<String> get() = model.featureNames
    val anchor: Int get() = model.calmIndex.anchor
    val slope: Int get() = model.calmIndex.slope
    val defaultBaseline: Float get() = model.calmIndex.defaultBaseline

    /** Blendshape scores by name → ordered vector (clamp [0,1]). */
    fun vectorFrom(scores: Map<String, Float>): FloatArray =
        FloatArray(model.featureNames.size) { index ->
            (scores[model.featureNames[index]] ?: 0f).coerceIn(0f, 1f)
        }

    /** Baseline clamp from the calibration step (LEAN §6.6): default ± 0.25, >=15 frames. */
    fun clampBaseline(medianP: Float?): Float {
        if (medianP == null) return model.calmIndex.defaultBaseline
        val clamp = model.calmIndex.baselineClamp
        return medianP.coerceIn(
            model.calmIndex.defaultBaseline - clamp,
            model.calmIndex.defaultBaseline + clamp,
        )
    }

    /** p = P(distress); forward pass in float32, exactly as forward_ref.py. */
    fun probability(features: FloatArray): Float {
        require(features.size == model.weights.size) {
            "feature vector has wrong length: expected ${model.weights.size}, got ${features.size}"
        }
        var logit = model.bias
        for (index in features.indices) {
            val z = (features[index].coerceIn(0f, 1f) - model.mean[index]) / max(model.std[index], 1e-3f)
            logit += z * model.weights[index]
        }
        return stableSigmoid(logit)
    }

    fun calmIndex(p: Float, baseline: Float): Int {
        val raw = anchor - slope * (p - baseline) + 0.5
        return max(0, min(100, floor(raw).toInt()))
    }

    private fun stableSigmoid(logit: Float): Float = if (logit >= 0f) {
        (1.0 / (1.0 + exp(-logit.toDouble()))).toFloat()
    } else {
        val e = exp(logit.toDouble())
        (e / (1.0 + e)).toFloat()
    }
}
