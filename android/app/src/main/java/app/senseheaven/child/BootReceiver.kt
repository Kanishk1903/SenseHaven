package app.senseheaven.child

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import app.senseheaven.child.services.GuardService

/** E6-4: reboot mid-session — restart GuardService; persisted state restores the time. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            GuardService.start(context)
        }
    }
}
