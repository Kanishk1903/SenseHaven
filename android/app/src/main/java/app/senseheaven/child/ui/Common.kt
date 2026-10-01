package app.senseheaven.child.ui

import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.senseheaven.child.design.Tokens

/** Dusk feel (LEAN §1.1 themes): dark indigo surfaces + calm-green primary. */
@Composable
fun DuskTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MaterialTheme.colorScheme.copy(
            background = Color(0xFF1B2350),
            onBackground = Color(0xFFF2F3FF),
            primary = Tokens.Calm,
            onPrimary = Color(0xFF10231C),
        ),
        content = content,
    )
}

private val consentCards = listOf(
    "What SenseHeaven does" to
        "It keeps your screen time healthy: you earn extra time by staying calm, and take " +
        "short breathing breaks when things get tense.",
    "What it can see" to
        "Your face expression is estimated on this phone — no photos are ever saved or sent. " +
        "It also sees which apps you use.",
    "Who sees it" to
        "Your parent. Your wellbeing score and app totals show in their dashboard — never " +
        "your camera or photos.",
)

/** Welcome & consent (File 02 §4 screen 1) — reachable later from "How SenseHeaven works". */
@Composable
fun ConsentScreenBody(onUnderstood: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1B2350)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Spacer(Modifier.height(40.dp))
        Text("SenseHeaven", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF2F3FF))
        Spacer(Modifier.height(6.dp))
        Text("Before we start, here is the honest deal.", fontSize = 15.sp, color = Color(0xFFB9C2F0))
        Spacer(Modifier.height(20.dp))
        consentCards.forEach { (title, body) ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF2A3568)),
            ) {
                Column(Modifier.padding(18.dp)) {
                    Text(title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFF2F3FF))
                    Spacer(Modifier.height(6.dp))
                    Text(body, fontSize = 14.sp, lineHeight = 20.sp, color = Color(0xFFD7DCF8))
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        Spacer(Modifier.height(8.dp))
        Button(
            onClick = onUnderstood,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Tokens.Calm),
        ) {
            Text("I understand", fontSize = 17.sp, color = Color(0xFF10231C))
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "Face estimates are approximate and are not a medical or psychological assessment.",
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            color = Color(0xFF8F9ACD),
        )
    }
}

/** Custom keypad (File 02 §4 screen 2): 72 dp-ish keys, haptic feedback by the caller. */
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
