// Root build file (P5.0): plugin versions come from gradle/libs.versions.toml; the app
// module freezes its own dependency set. assembleDebug must be green BEFORE feature work.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.kotlin.compose) apply false
}
