package app.senseheaven.child

import app.senseheaven.child.engine.EmotionModel
import app.senseheaven.child.engine.Quality
import java.nio.file.Paths
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Model parity + quality boundaries (gate-5). Parity vectors come from Phase 3
 * (contracts/classifier_vectors.json); while H3 (FER2013) is outstanding the parity part is
 * skipped and the gate records BLOCKED_ON_H3 — mirroring gate-3.
 */
class EmotionModelTest {

    private val repoRoot = Paths.get("").toAbsolutePath().resolve("../..").normalize()

    // ---- quality boundaries (mirror ml tests) ----

    @Test
    fun qualityBoundaries() {
        assertEquals(0f, Quality.sizeScore(0.04f, 1f), 1e-6f)
        assertEquals(1f, Quality.sizeScore(0.12f, 1f), 1e-6f)
        assertEquals(0.5f, Quality.sizeScore(0.08f, 1f), 1e-6f)
        assertEquals(0f, Quality.sizeScore(0.5f, 0f), 1e-6f)
        assertEquals(0.3f, Quality.lightScore(39.9f), 1e-6f)
        assertEquals(1f, Quality.lightScore(40f), 1e-6f)
        assertEquals(1f, Quality.lightScore(220f), 1e-6f)
        assertEquals(0.3f, Quality.lightScore(220.1f), 1e-6f)
        assertEquals(0.3f, Quality.quality(0.08f, 1f, 10f), 1e-6f)
        assertTrue(Quality.isValid(0.5f))
        assertTrue(!Quality.isValid(0.49f))
    }

    // ---- model loading + maths (self-contained; no Phase-3 artifacts needed) ----

    @Test
    fun modelValidatesShapesAndRejectsBadInput() {
        val modelJson = """
            {"schema_version":1,"tier":"heuristic","feature_names":["a","b"],
             "mean":[0.0,0.0],"std":[1.0,1.0],"weights":[1.0,-1.0],"bias":0.0,
             "calm_index":{"anchor":75,"slope":120,"default_baseline":0.2,"baseline_clamp":0.25}}
        """.trimIndent()
        val model = EmotionModel.fromJson(modelJson)
        assertEquals(listOf("a", "b"), model.featureNames)
        // p(1,0) = sigmoid(1) ≈ 0.731
        assertEquals(0.7310586f, model.probability(floatArrayOf(1f, 0f)), 1e-5f)
        // clamping: inputs outside [0,1] behave like the clamped values
        assertEquals(
            model.probability(floatArrayOf(1f, 0f)),
            model.probability(floatArrayOf(9f, -9f)),
            1e-6f,
        )
        val thrown = runCatching { model.probability(floatArrayOf(1f)) }
        assertTrue(thrown.isFailure && thrown.exceptionOrNull()!!.message!!.contains("wrong length"))
    }

    @Test
    fun calmIndexFormulaMatchesReference() {
        val modelJson = """
            {"schema_version":1,"tier":"heuristic","feature_names":["a"],
             "mean":[0.0],"std":[1.0],"weights":[1.0],"bias":0.0,
             "calm_index":{"anchor":75,"slope":120,"default_baseline":0.2,"baseline_clamp":0.25}}
        """.trimIndent()
        val model = EmotionModel.fromJson(modelJson)
        // floor(x + 0.5) rounding — never banker's rounding
        assertEquals(39, model.calmIndex(0.5f, 0.2f))   // 75 - 120*0.3 + 0.5 = 39.5 -> 39
        assertEquals(75, model.calmIndex(0.2f, 0.2f))   // exactly on baseline
    }

    @Test
    fun baselineClampStaysWithinDefaultQuarter() {
        val modelJson = """
            {"schema_version":1,"tier":"heuristic","feature_names":["a"],
             "mean":[0.0],"std":[1.0],"weights":[0.0],"bias":0.0,
             "calm_index":{"anchor":75,"slope":120,"default_baseline":0.5,"baseline_clamp":0.25}}
        """.trimIndent()
        val model = EmotionModel.fromJson(modelJson)
        assertEquals(0.25f, model.clampBaseline(0.0f), 1e-6f)
        assertEquals(0.75f, model.clampBaseline(1.0f), 1e-6f)
        assertEquals(0.5f, model.clampBaseline(null), 1e-6f)
        assertEquals(0.6f, model.clampBaseline(0.6f), 1e-6f)
    }

    @Test
    fun vectorFromMapsScoresByNameIntoModelOrder() {
        val modelJson = """
            {"schema_version":1,"tier":"heuristic","feature_names":["browDownLeft","mouthSmileRight"],
             "mean":[0.0,0.0],"std":[1.0,1.0],"weights":[1.0,-1.0],"bias":0.0,
             "calm_index":{"anchor":75,"slope":120,"default_baseline":0.2,"baseline_clamp":0.25}}
        """.trimIndent()
        val model = EmotionModel.fromJson(modelJson)
        val vector = model.vectorFrom(mapOf("mouthSmileRight" to 0.8f, "browDownLeft" to 0.4f))
        assertEquals(0.4f, vector[0], 1e-6f)
        assertEquals(0.8f, vector[1], 1e-6f)
        // a shuffled/missing feature map still lands in the right slots (missing = 0)
        val partial = model.vectorFrom(mapOf("mouthSmileRight" to 2f))
        assertEquals(0f, partial[0], 1e-6f)
        assertEquals(1f, partial[1], 1e-6f) // clamped to [0,1]
    }

    // ---- parity against Phase-3 vectors (BLOCKED_ON_H3 until the model is trained) ----

    @Test
    fun parityWithClassifierVectors() {
        val vectorsPath = repoRoot.resolve("contracts/classifier_vectors.json").toFile()
        val modelPath = repoRoot.resolve("ml/artifacts/emotion_model.json").toFile()
        assumeTrue(
            "Phase 3 artifacts absent (H3): contracts/classifier_vectors.json + emotion_model.json",
            vectorsPath.exists() && modelPath.exists(),
        )
        val model = EmotionModel.fromJson(modelPath.readText())
        val payload = Json.parseToJsonElement(vectorsPath.readText()).jsonObject
        val tolerance = payload["tolerance_p"]!!.jsonPrimitive.content.toDouble()
        var checked = 0
        for (vector in payload["vectors"]!!.jsonArray) {
            val obj = vector.jsonObject
            val features = obj["features"]!!.jsonArray.map { it.jsonPrimitive.content.toFloat() }.toFloatArray()
            val baseline = obj["baseline"]!!.jsonPrimitive.content.toFloat()
            val expectedP = obj["expected_p"]!!.jsonPrimitive.content.toDouble()
            val expectedCi = obj["expected_ci"]!!.jsonPrimitive.content.toInt()
            val p = model.probability(features).toDouble()
            assertTrue("p drifted: $p vs $expectedP", kotlin.math.abs(p - expectedP) <= tolerance)
            assertEquals("ci must match exactly", expectedCi, model.calmIndex(p.toFloat(), baseline))
            checked += 1
        }
        assertTrue("expected >= 60 vectors, got $checked", checked >= 60)
    }
}
