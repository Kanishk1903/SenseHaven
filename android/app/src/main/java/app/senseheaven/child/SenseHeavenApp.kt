package app.senseheaven.child

import android.app.Application
import app.senseheaven.child.engine.EmotionModel
import app.senseheaven.child.services.SessionManager
import java.nio.file.Paths

/** Manual DI (File 01: no Hilt). One SessionManager + one EmotionModel per process. */
class SenseHeavenApp : Application() {

    val session: SessionManager by lazy { SessionManager(this) }

    /** Loaded from assets (Phase 3 export); null only if the asset is missing (parity test covers). */
    val emotionModel: EmotionModel by lazy {
        val raw = assets.open("emotion_model.json").bufferedReader().use { it.readText() }
        EmotionModel.fromJson(raw)
    }

    override fun onCreate() {
        super.onCreate()
    }
}
