package app.senseheaven.child.ui

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.senseheaven.child.SenseHeavenApp
import app.senseheaven.child.design.Tokens
import app.senseheaven.child.services.GuardService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Single-activity flow (File 02 §4): Welcome/consent → Pair → Setup wizard → Home.
 * The lock overlay lives in LockActivity (shown by GuardService whenever locked).
 */
class MainActivity : ComponentActivity() {

    private var cameraGranted by mutableStateOf(false)
    private var notificationsGranted by mutableStateOf(false)
    private var usageGranted by mutableStateOf(false)
    private var overlayGranted by mutableStateOf(false)

    private val cameraLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { cameraGranted = it }

    private val notificationsLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { notificationsGranted = it }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DuskTheme {
                SenseHeavenFlow(
                    cameraGranted = cameraGranted,
                    notificationsGranted = notificationsGranted,
                    usageGranted = usageGranted,
                    overlayGranted = overlayGranted,
                    onRequestCamera = { cameraLauncher.launch(Manifest.permission.CAMERA) },
                    onRequestNotifications = {
                        if (android.os.Build.VERSION.SDK_INT >= 33) {
                            notificationsLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    },
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissions()
    }

    private fun refreshPermissions() {
        cameraGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        notificationsGranted = if (android.os.Build.VERSION.SDK_INT >= 33) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            packageName,
        )
        usageGranted = mode == AppOpsManager.MODE_ALLOWED
        overlayGranted = Settings.canDrawOverlays(this)
    }
}

private enum class Step { CONSENT, PAIR, SETUP, HOME }

@Composable
fun SenseHeavenFlow(
    cameraGranted: Boolean,
    notificationsGranted: Boolean,
    usageGranted: Boolean,
    overlayGranted: Boolean,
    onRequestCamera: () -> Unit,
    onRequestNotifications: () -> Unit,
) {
    val app = LocalContext.current.applicationContext as SenseHeavenApp
    val ui by app.session.ui.collectAsState()
    val context = LocalContext.current
    var step by remember { mutableStateOf<Step?>(null) }
    var pairing by remember { mutableStateOf(false) }
    var pairError by remember { mutableStateOf<String?>(null) }
    var code by remember { mutableStateOf("") }

    val effectiveStep = when {
        step != null -> step!!
        ui.paired -> Step.SETUP
        else -> Step.CONSENT
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when (effectiveStep) {
            Step.CONSENT -> ConsentScreenBody(onUnderstood = { step = Step.PAIR })

            Step.PAIR -> {
                Text("Enter the 6-digit code", fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFF2F3FF))
                Text("Ask your parent for the code on their dashboard.", fontSize = 14.sp, color = Color(0xFFB9C2F0))
                Spacer(Modifier.height(20.dp))
                CodeDots(code)
                Spacer(Modifier.height(16.dp))
                Keypad(onDigit = { digit ->
                    if (code.length < 6) code += digit
                    if (code.length == 6 && !pairing) {
                        pairing = true
                        pairError = null
                        CoroutineScope(Dispatchers.Main).launch {
                            val (ok, error) = app.session.pair(code)
                            pairing = false
                            if (ok) {
                                step = Step.SETUP
                            } else {
                                pairError = error ?: "That code isn't right."
                                code = ""
                            }
                        }
                    }
                }, onBackspace = { if (code.isNotEmpty()) code = code.dropLast(1) })
                if (pairing) {
                    Spacer(Modifier.height(12.dp))
                    Text("Waking things up…", fontSize = 14.sp, color = Color(0xFFB9C2F0))
                }
                pairError?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, fontSize = 13.sp, color = Color(0xFFF5A28A))
                }
            }

            Step.SETUP -> SetupWizard(
                cameraGranted = cameraGranted,
                notificationsGranted = notificationsGranted,
                usageGranted = usageGranted,
                overlayGranted = overlayGranted,
                onRequestCamera = onRequestCamera,
                onRequestNotifications = onRequestNotifications,
                onRequestUsageAccess = {
                    context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
                },
                onRequestOverlay = {
                    context.startActivity(
                        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:" + context.packageName)),
                    )
                },
                onAllGranted = {
                    // tap-to-start (D-11): camera FGS begins from this visible screen
                    GuardService.start(context)
                    step = Step.HOME
                },
            )

            Step.HOME -> HomeScreen(
                onStartCounting = { GuardService.start(context) },
                onOpenLock = { context.startActivity(Intent(context, LockActivity::class.java)) },
            )
        }
    }
}

@Composable
fun CodeDots(code: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(6) { index ->
            val char = code.getOrNull(index)
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = if (char != null) Color(0xFF3D4FA8) else Color(0xFF2A3568)),
            ) {
                Text(
                    text = if (char != null) "•" else " ",
                    fontSize = 20.sp,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    color = Color(0xFFF2F3FF),
                )
            }
        }
    }
}

private data class SetupItem(
    val title: String,
    val why: String,
    val granted: Boolean,
    val onAsk: () -> Unit,
)

@Composable
fun SetupWizard(
    cameraGranted: Boolean,
    notificationsGranted: Boolean,
    usageGranted: Boolean,
    overlayGranted: Boolean,
    onRequestCamera: () -> Unit,
    onRequestNotifications: () -> Unit,
    onRequestUsageAccess: () -> Unit,
    onRequestOverlay: () -> Unit,
    onAllGranted: () -> Unit,
) {
    val items = listOf(
        SetupItem("Camera", "Needed to estimate your wellbeing score on this phone. No photos are saved or sent.", cameraGranted, onRequestCamera),
        SetupItem("Notifications", "So SenseHeaven can show your countdown and gentle reminders.", notificationsGranted, onRequestNotifications),
        SetupItem("Usage access", "Lets SenseHeaven pause time in always-allowed apps and block apps your parent chose.", usageGranted, onRequestUsageAccess),
        SetupItem("Display over other apps", "Needed to show the lock screen when your time is up.", overlayGranted, onRequestOverlay),
    )
    val allGranted = items.all { it.granted }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Almost there — allow these", fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFF2F3FF))
        Spacer(Modifier.height(16.dp))
        items.forEach { item ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF2A3568)),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(item.title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFF2F3FF))
                        Text(item.why, fontSize = 12.sp, color = Color(0xFFB9C2F0))
                    }
                    Spacer(Modifier.size(8.dp))
                    if (item.granted) {
                        Text("Granted", fontSize = 13.sp, color = Tokens.Calm)
                    } else {
                        Button(
                            onClick = item.onAsk,
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3D4FA8)),
                        ) {
                            Text("Allow", color = Color(0xFFF2F3FF))
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
        }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onAllGranted,
            enabled = allGranted,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Tokens.Calm),
        ) {
            Text(
                if (allGranted) "Open SenseHeaven" else "Allow the ${items.count { !it.granted }} remaining item(s)",
                fontSize = 17.sp,
                color = Color(0xFF10231C),
            )
        }
        if (!allGranted) {
            Spacer(Modifier.height(6.dp))
            Text("Every card above needs to be green — tap Allow on each.", fontSize = 12.sp, color = Color(0xFF8F9ACD))
        }
    }
}

@Composable
fun HomeScreen(onStartCounting: () -> Unit, onOpenLock: () -> Unit) {
    val app = LocalContext.current.applicationContext as SenseHeavenApp
    val ui by app.session.ui.collectAsState()
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        val active = ui.status == "active" || ui.status == "cooldown"
        val statusText = when (ui.status) {
            "active" -> "Screen time active"
            "cooldown" -> "Breathing break"
            "pending" -> "Your parent set up time — tap to begin"
            "ended", "expired" -> "Screen time is paused"
            else -> "Waiting for your parent…"
        }
        Text(statusText, fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFF2F3FF))
        Spacer(Modifier.height(12.dp))
        Text(
            text = formatRemaining(maxOf(0, ui.remainingS)),
            fontSize = 56.sp,
            fontWeight = FontWeight.ExtraBold,
            color = Color(0xFFF2F3FF),
        )
        ui.calmIndex?.let { index ->
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Today's wellbeing: $index",
                fontSize = 14.sp,
                color = if (ui.showMoodToChild) Color(0xFF7FDDBB) else Color(0xFF8F9ACD),
            )
        }
        Spacer(Modifier.height(24.dp))
        if (!active && ui.status != "ended" && ui.status != "expired") {
            Button(
                onClick = onStartCounting,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(24.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Tokens.Calm),
            ) {
                Text("Tap to begin", fontSize = 18.sp, color = Color(0xFF10231C))
            }
        }
        Spacer(Modifier.height(10.dp))
        Button(
            onClick = onOpenLock,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2A3568)),
        ) {
            Text("Parent menu (PIN)", color = Color(0xFFF2F3FF))
        }
        if (ui.bonusS > 0) {
            Spacer(Modifier.height(10.dp))
            Text("+${ui.bonusS / 60} min earned for staying calm", fontSize = 14.sp, color = Tokens.Calm)
        }
        if (ui.penaltyS > 0) {
            Spacer(Modifier.height(4.dp))
            Text("${ui.penaltyS / 60} min paused for a breather", fontSize = 14.sp, color = Color(0xFFF5A28A))
        }
    }
}

private fun formatRemaining(totalSeconds: Int): String {
    val minutes = totalSeconds / 60
    val hours = minutes / 60
    val rest = minutes % 60
    return if (hours > 0) "$hours:${rest.toString().padStart(2, '0')} m" else "${rest} m"
}
