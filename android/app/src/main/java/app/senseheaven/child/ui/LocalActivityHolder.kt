package app.senseheaven.child.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.compositionLocalOf

/** Compose-safe activity reference (lint ContextCastToActivity). */
val LocalActivityHolder = compositionLocalOf<ComponentActivity?> { null }
