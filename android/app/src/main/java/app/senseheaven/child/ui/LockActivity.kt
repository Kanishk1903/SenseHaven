package app.senseheaven.child.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.senseheaven.child.design.Tokens
import app.senseheaven.child.engine.SessionStatus

/** Lock overlay (5a): shown whenever there is no live session. PIN unlocks via verifier. */
class LockActivity : ComponentActivity() {

    companion object {
        var isShowing = false
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LockScreen()
        }
    }

    override fun onStart() {
        super.onStart()
        isShowing = true
    }

    override fun onStop() {
        super.onStop()
        isShowing = false
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // back is disabled on the lock screen (File 02 §4 screen 6)
    }
}

@Composable
fun LockScreen() {
    val app = LocalContext.current.applicationContext as app.senseheaven.child.SenseHeavenApp
    val activity = LocalContext.current as? ComponentActivity
    val ui by app.session.ui.collectAsState()
    var pin by androidx.compose.runtime.remember { mutableStateOf("") }
    var error by androidx.compose.runtime.remember { mutableStateOf<String?>(null) }

    val lockedOut = app.session.isPinLockedOut()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF1B2350), Color(0xFF3D4FA8))))
            .safeDrawingPadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth().padding(24.dp),
        ) {
            Text("Screen time is paused", fontSize = 26.sp, color = Color(0xFFF2F3FF), textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text(
                text = when (ui.status) {
                    "cooldown" -> "Let's take a calm moment. Your time is safe while we pause."
                    else -> "Ask a parent to unlock, or come back later."
                },
                fontSize = 15.sp,
                color = Color(0xFFB9C2F0),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(28.dp))

            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF2A3568)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(20.dp),
                ) {
                    Text("Ask a parent", fontSize = 18.sp, color = Color(0xFFF2F3FF))
                    Spacer(Modifier.height(10.dp))
                    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        repeat(6) { index ->
                            val char = pin.getOrNull(index)
                            Box(
                                modifier = Modifier
                                    .height(36.dp)
                                    .padding(horizontal = 4.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    if (char != null) "•" else "·",
                                    fontSize = 22.sp,
                                    color = if (char != null) Color(0xFFF2F3FF) else Color(0xFF6B77B8),
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Keypad(onDigit = { digit ->
                        if (pin.length < 6) pin += digit
                        if (pin.length == 6) {
                            if (app.session.verifyPin(pin)) {
                                activity?.finish()
                            } else {
                                error = if (app.session.isPinLockedOut()) {
                                    "Too many tries — ask your parent for help."
                                } else {
                                    "That PIN isn't right."
                                }
                                pin = ""
                            }
                        }
                    }, onBackspace = { if (pin.isNotEmpty()) pin = pin.dropLast(1) })
                    error?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(it, fontSize = 13.sp, color = Color(0xFFF5A28A))
                    }
                    if (lockedOut) {
                        Spacer(Modifier.height(8.dp))
                        Text("Locked for a little while — try again later.", fontSize = 13.sp, color = Color(0xFFEBC26F))
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Button(
                onClick = {
                    // Emergency path: always allowed, never counted (E6-14)
                    val dial = android.content.Intent(android.content.Intent.ACTION_DIAL)
                    activity?.startActivity(dial)
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(24.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2A3568)),
            ) {
                Text("Call for help", color = Color(0xFFF2F3FF), fontSize = 16.sp)
            }
        }
    }
}
