package app.senseheaven.child.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.senseheaven.child.design.Tokens

/**
 * Entry point (File 02 §4): Welcome & consent — three short cards, reachable later from
 * Home → "How SenseHeaven works". Primary button advances to pairing (layer 5a).
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DuskTheme {
                SenseHeavenApp()
            }
        }
    }
}

/** Dusk gradient feel implemented with Material surfaces + tokens (LEAN §1.1 themes). */
@Composable
fun DuskTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MaterialTheme.colorScheme.copy(
            background = Color(0xFF1B2350),
            onBackground = Color(0xFFF2F3FF),
            primary = Tokens.Calm,
            onPrimary = Color(0xFFF2F3FF),
        ),
        content = content,
    )
}

@Composable
fun SenseHeavenApp() {
    var consented by rememberSaveable { mutableStateOf(false) }
    if (consented) {
        PairScreen()
    } else {
        ConsentScreen(onUnderstood = { consented = true })
    }
}

private val consentCards = listOf(
    "What SenseHeaven does" to
        "It keeps your screen time healthy: you earn extra time by staying calm, and take " +
        "short breathing breaks when things get tense.",
    "What it can see" to
        "Your face expression is estimated on this phone — no photos are ever saved or sent. " +
        "It also sees which apps you use (and searches, only if your parent turns that on).",
    "Who sees it" to
        "Your parent. Your wellbeing score and app totals show in their dashboard — never " +
        "your camera or photos.",
)

@Composable
fun ConsentScreen(onUnderstood: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "SenseHeaven",
            fontSize = 28.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = "Before we start, here is the honest deal.",
            fontSize = 15.sp,
            color = Color(0xFFB9C2F0),
        )
        Spacer(Modifier.height(20.dp))
        consentCards.forEach { (title, body) ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF2A3568)),
            ) {
                Column(Modifier.padding(18.dp)) {
                    Text(text = title, fontSize = 17.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                    Spacer(Modifier.height(6.dp))
                    Text(text = body, fontSize = 14.sp, lineHeight = 20.sp, color = Color(0xFFD7DCF8))
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onUnderstood,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Tokens.Calm),
        ) {
            Text("I understand", fontSize = 17.sp, color = Color(0xFF10231C))
        }
        Spacer(Modifier.height(12.dp))
        Text(
            text = "Face estimates are approximate and are not a medical or psychological assessment.",
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            color = Color(0xFF8F9ACD),
        )
    }
}

/** Pair screen (layer 5a wires the API; the keypad UX is built now). */
@Composable
fun PairScreen() {
    var code by rememberSaveable { mutableStateOf("") }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Enter the 6-digit code", fontSize = 22.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
        Text("Ask your parent for the code on their dashboard.", fontSize = 14.sp, color = Color(0xFFB9C2F0))
        Spacer(Modifier.height(24.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(6) { index ->
                val char = code.getOrNull(index)
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (char != null) Color(0xFF3D4FA8) else Color(0xFF2A3568),
                    ),
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
        Spacer(Modifier.height(24.dp))
        Keypad(onDigit = { digit -> if (code.length < 6) code += digit }, onBackspace = {
            if (code.isNotEmpty()) code = code.dropLast(1)
        })
        Spacer(Modifier.height(12.dp))
        Text(
            text = "Your parent's phone shows the code for 10 minutes.",
            fontSize = 12.sp,
            color = Color(0xFF8F9ACD),
        )
    }
}

@Composable
fun Keypad(onDigit: (Char) -> Unit, onBackspace: () -> Unit) {
    val rows = listOf(listOf('1', '2', '3'), listOf('4', '5', '6'), listOf('7', '8', '9'))
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { digit ->
                    KeyCap(label = digit.toString(), onClick = { onDigit(digit) })
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            KeyCap(label = "⌫", onClick = onBackspace, contentDescription = "Backspace")
            KeyCap(label = "0", onClick = { onDigit('0') })
        }
    }
}

@Composable
fun KeyCap(label: String, onClick: () -> Unit, contentDescription: String? = null) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .height(64.dp)
            .fillMaxWidth(0.3f),
        shape = RoundedCornerShape(24.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2A3568)),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
    ) {
        Text(
            text = label,
            fontSize = 22.sp,
            color = Color(0xFFF2F3FF),
            modifier = if (contentDescription != null) {
                Modifier.semantics { this.contentDescription = contentDescription }
            } else {
                Modifier
            },
        )
    }
}
