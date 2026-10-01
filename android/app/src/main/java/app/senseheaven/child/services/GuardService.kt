package app.senseheaven.child.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import app.senseheaven.child.R
import app.senseheaven.child.engine.CalmSample
import app.senseheaven.child.network.HeartbeatPermissions
import app.senseheaven.child.ui.LockActivity
import app.senseheaven.child.ui.MainActivity
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.Executors
import kotlin.coroutines.resume

/**
 * GuardService (5a + 5c + 5e): the 1 Hz tick loop (monotonic deltas), the sync loop with
 * backoff, camera analysis at 1 frame/s -> Calm Index, and the usage-stats poller.
 * Camera starts ONLY from a visible activity (tap-to-start, File 01 D-11) via [startCamera].
 */
class GuardService : LifecycleService() {

    companion object {
        const val CHANNEL_ID = "senseheaven_guard"
        const val NOTIFICATION_ID = 42
        const val ACTION_START_COUNTING = "app.senseheaven.child.START_COUNTING"
        const val ACTION_STOP = "app.senseheaven.child.STOP"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, GuardService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, GuardService::class.java))
        }
    }

    private lateinit var session: SessionManager
    private val handler = Handler(Looper.getMainLooper())
    private var lastElapsedMs = 0L
    private var counting = false
    private val cameraExecutor = Executors.newSingleThreadExecutor()

    private val tickRunnable = object : Runnable {
        override fun run() {
            android.util.Log.i("SH_DEBUG", "tick-run")
            val now = SystemClock.elapsedRealtime()
            val delta = now - lastElapsedMs
            lastElapsedMs = now
            val frame = cameraEngine?.latestSample()
            lifecycleScope.launch {
                session.onTick(delta, frame)
                enforceLock()
            }
            handler.postDelayed(this, 1000L)
        }
    }

    private val syncRunnable: Runnable = object : Runnable {
        override fun run() {
            val self = this
            lifecycleScope.launch {
                session.syncOnce()
                handler.postDelayed(self, session.nextSyncDelayMs())
            }
        }
    }

    private var cameraEngine: CameraEngine? = null
    private var usagePoller: UsagePoller? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        android.util.Log.i("SH_DEBUG", "service-oncreate")
        session = (application as app.senseheaven.child.SenseHeavenApp).session
        createChannel()
        startForegroundNotification()
        lifecycleScope.launch { session.restore() }
        usagePoller = UsagePoller(this) { pkg, interactive ->
            session.foregroundPackage = pkg
            session.screenInteractive = interactive
        }
        usagePoller?.start(handler)
        // cooldown/lock must progress with the screen off — hold a partial wake lock
        // (DECISIONS.md D-20; battery trade-off documented there)
        val power = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "senseheaven:guard").apply {
            setReferenceCounted(false)
            acquire(6 * 60 * 60 * 1000L)  // hard cap: 6 h
        }
        handler.post(tickRunnable)      // tick loop, 1 Hz
        handler.post(syncRunnable)      // sync loop
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START_COUNTING -> startCamera()
            ACTION_STOP -> {
                stopSelf()
                return android.app.Service.START_NOT_STICKY
            }
        }
        return android.app.Service.START_STICKY
    }

    /** Tap-to-start (D-11): called only while MainActivity is visible. */
    fun startCamera() {
        counting = true
        if (cameraEngine == null) {
            cameraEngine = CameraEngine(this, lifecycleScope, cameraExecutor) { sample ->
                session.enqueueEmotion(sample.calmIndex, labelFor(sample), sample.quality, sample.facePresent)
            }
            cameraEngine?.start()
        }
    }

    private fun labelFor(sample: CalmSample): String = when {
        sample.calmIndex >= session.config.calmThreshold -> "calm"
        sample.calmIndex < session.config.stressThreshold -> "stressed"
        else -> "neutral"
    }

    /** When no live session, bring LockActivity to front (best-effort, E6-1). */
    private fun enforceLock() {
        // cooldown brings up LockActivity in its breathing-break mode (File 02 §4 screen 5)
        val active = session.engineState.status in setOf(
            app.senseheaven.child.engine.SessionStatus.ACTIVE,
            app.senseheaven.child.engine.SessionStatus.PENDING,
        )
        if (!active && !LockActivity.isShowing) {
            val intent = Intent(this, LockActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        }
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel),
            NotificationManager.IMPORTANCE_LOW,
        )
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun startForegroundNotification() {
        val contentIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .build()
        // camera type (D-11): starts only from the visible tap-to-start path or right
        // after a visible-activity launch; the OS enforces eligibility
        @android.annotation.SuppressLint("InlinedApi")
        val typed = NOTIFICATION_ID to notification
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            startForeground(typed.first, typed.second, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
        } else {
            startForeground(typed.first, typed.second)
        }
    }

    override fun onDestroy() {
        wakeLock?.release()
        handler.removeCallbacksAndMessages(null)
        cameraEngine?.stop()
        usagePoller?.stop()
        cameraExecutor.shutdown()
        super.onDestroy()
    }
}

/** 1 Hz usage-stats poll (5b): current foreground package via UsageStatsManager. */
class UsagePoller(
    private val context: Context,
    private val onForeground: (String?, Boolean) -> Unit,
) {
    private var handler: Handler? = null
    private val ignore = setOf(
        "app.senseheaven.child",
        "com.android.systemui",
        "com.android.launcher3", "com.google.android.apps.nexuslauncher",
        "com.android.dialer", "com.google.android.dialer", "com.android.emergency",
    )

    private val runnable = object : Runnable {
        override fun run() {
            poll()
            handler?.postDelayed(this, 1000L)
        }
    }

    fun start(handler: Handler) {
        this.handler = handler
        handler.post(runnable)
    }

    fun stop() {
        handler?.removeCallbacks(runnable)
        handler = null
    }

    fun poll() {
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? android.app.usage.UsageStatsManager
        if (manager == null) {
            onForeground(null, false)
            return
        }
        val now = System.currentTimeMillis()
        val events = manager.queryEvents(now - 5_000, now)
        var current: String? = null
        var interactive = false
        val event = android.app.usage.UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            when (event.eventType) {
                android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED,
                android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND,
                -> current = event.packageName
                android.app.usage.UsageEvents.Event.SCREEN_INTERACTIVE -> interactive = true
                android.app.usage.UsageEvents.Event.SCREEN_NON_INTERACTIVE -> interactive = false
            }
        }
        if (current in ignore) current = null
        onForeground(current, interactive)
    }
}

/** CameraX front camera + MediaPipe Face Landmarker at 1 frame/s (5c). */
class CameraEngine(
    private val context: Context,
    private val scope: kotlinx.coroutines.CoroutineScope,
    private val executor: java.util.concurrent.Executor,
    private val onSample: (CalmSample) -> Unit,
) {
    private var landmarker: com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker? = null
    private var latest: CalmSample? = null
    private var lastFrameAtMs = 0L

    fun latestSample(): CalmSample? = latest

    fun start() {
        val options = com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker.FaceLandmarkerOptions.builder()
            .setBaseOptions(
                com.google.mediapipe.tasks.core.BaseOptions.builder()
                    .setModelAssetPath("face_landmarker.task")
                    .build(),
            )
            .setRunningMode(com.google.mediapipe.tasks.vision.core.RunningMode.IMAGE)
            .setNumFaces(1)
            .setOutputFaceBlendshapes(true)
            .setMinFaceDetectionConfidence(0.3f)
            .setMinFacePresenceConfidence(0.3f)
            .build()
        landmarker = com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker.createFromOptions(context, options)
        startCameraX()
    }

    private fun startCameraX() {
        val providerFuture = androidx.camera.lifecycle.ProcessCameraProvider.getInstance(context)
        providerFuture.addListener({
            val provider = providerFuture.get()
            val preview = androidx.camera.core.Preview.Builder().build()
            val analysis = androidx.camera.core.ImageAnalysis.Builder()
                .setBackpressureStrategy(androidx.camera.core.ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(executor) { proxy ->
                try {
                    val now = SystemClock.elapsedRealtime()
                    if (now - lastFrameAtMs >= 1000) { // 1 frame/s (LEAN §1.1)
                        lastFrameAtMs = now
                        analyse(proxy)
                    }
                } finally {
                    proxy.close()
                }
            }
            val selector = androidx.camera.core.CameraSelector.DEFAULT_FRONT_CAMERA
            provider.unbindAll()
            provider.bindToLifecycle(context as androidx.lifecycle.LifecycleOwner, selector, preview, analysis)
        }, executor)
    }

    private fun analyse(proxy: androidx.camera.core.ImageProxy) {
        val landmarker = landmarker ?: return
        val bitmap = proxy.toBitmap()
        val rotation = proxy.imageInfo.rotationDegrees
        val matrix = android.graphics.Matrix().apply { postRotate(rotation.toFloat()) }
        val upright = android.graphics.Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        val mpImage = com.google.mediapipe.framework.image.BitmapImageBuilder(upright).build()
        val result = try {
            landmarker.detect(mpImage)
        } catch (error: Exception) {
            null
        } finally {
            upright.recycle()
            bitmap.recycle()
        }
        @Suppress("UNCHECKED_CAST")
        val allFaces = (result?.faceBlendshapes() ?: emptyList<Any?>())
            as List<List<com.google.mediapipe.tasks.components.containers.Category>>
        val blendshapes = if (allFaces.isEmpty()) null else allFaces[0]
        if (blendshapes == null) {
            latest = CalmSample(calmIndex = latest?.calmIndex ?: 75, facePresent = false, quality = 0f)
            return
        }
        val scoreMap = mutableMapOf<String, Float>()
        for (index in blendshapes.indices) {
            val category = blendshapes[index]
            scoreMap[category.categoryName()] = category.score()
        }
        val scores: Map<String, Float> = scoreMap
        val app = context.applicationContext as app.senseheaven.child.SenseHeavenApp
        val model = app.emotionModel
        val vector = model.vectorFrom(scores)
        val p = model.probability(vector)
        val ci = ((75f - 120f * (p - model.defaultBaseline)) + 0.5f).toInt().coerceIn(0, 100)
        // quality: lighting gate on frame luma plus a presence-weighted size proxy
        // (precise landmark-bbox sizing is future polish — see docs/future_work.md)
        val quality = QualityApprox.from(upright, scores)
        val sample = CalmSample(ci, facePresent = true, quality = quality)
        latest = sample
        scope.launch { onSample(sample) }
    }

    fun stop() {
        landmarker?.close()
        landmarker = null
    }
}

private object QualityApprox {
    fun from(bitmap: android.graphics.Bitmap, scores: Map<String, Float>): Float {
        // lean proxy: lighting gate on mean luma + a presence-weighted size proxy from
        // the face-surface blendshape magnitude (full bbox sizing is Phase-6 polish)
        val step = maxOf(1, bitmap.width / 64)
        var total = 0L
        var count = 0
        var y = 0
        while (y < bitmap.height) {
            var x = 0
            while (x < bitmap.width) {
                val pixel = bitmap.getPixel(x, y)
                val r = (pixel shr 16) and 0xFF
                val g = (pixel shr 8) and 0xFF
                val b = pixel and 0xFF
                total += (r + g + b) / 3
                count += 1
                x += step
            }
            y += step
        }
        val luma = if (count == 0) 0f else total.toFloat() / count
        val presence = (scores["faceOvalLeft"] ?: 0f) + (scores["faceOvalRight"] ?: 0f)
        val sizeProxy = ((presence / 2f - 0.2f) / 0.6f).coerceIn(0f, 1f)
        return minOf(sizeProxy, app.senseheaven.child.engine.Quality.lightScore(luma))
    }
}
