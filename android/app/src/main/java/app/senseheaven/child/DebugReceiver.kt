package app.senseheaven.child

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * DEBUG-ONLY test hooks (5e, LEAN §1.1 demo tools): broadcast actions driven by adb in the
 * scripted e2e. Never compiled into release (registered in the debug manifest only… kept in
 * the main manifest but gated on BuildConfig.DEBUG at receive time).
 *
 *   adb shell am broadcast -a app.senseheaven.debug.PAIR --es code 123456
 *   adb shell am broadcast -a app.senseheaven.debug.INJECT --ei ci 20
 *   adb shell am broadcast -a app.senseheaven.debug.FASTFORWARD --ei minutes 6
 *   adb shell am broadcast -a app.senseheaven.debug.DUMP_STATE
 */
class DebugReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!BuildConfig.DEBUG) return
        val app = context.applicationContext as SenseHeavenApp
        val session = app.session
        when (intent.action) {
            "app.senseheaven.debug.PAIR" -> {
                val code = intent.getStringExtra("code") ?: return
                CoroutineScope(Dispatchers.IO).launch {
                    val (ok, error) = session.pair(code)
                    Log.i("SH_DEBUG", "{\"action\":\"pair\",\"ok\":$ok,\"error\":\"$error\"}")
                }
            }
            "app.senseheaven.debug.INJECT" -> {
                val ci = intent.getIntExtra("ci", 75)
                session.injectCalmIndex(ci)
                Log.i("SH_DEBUG", "{\"action\":\"inject\",\"ci\":$ci}")
            }
            "app.senseheaven.debug.FASTFORWARD" -> {
                val minutes = intent.getIntExtra("minutes", 1)
                session.fastForward(minutes * 60)
                Log.i("SH_DEBUG", "{\"action\":\"fast_forward\",\"seconds\":${minutes * 60}}")
            }
            "app.senseheaven.debug.DUMP_STATE" -> {
                CoroutineScope(Dispatchers.IO).launch {
                    session.syncOnce()
                    Log.i("SH_DEBUG", session.dumpState())
                }
            }
        }
    }
}
