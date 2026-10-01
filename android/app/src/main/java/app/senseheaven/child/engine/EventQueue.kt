package app.senseheaven.child.engine

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * JSON-file event queue (LEAN §1.2 replaces Room): in-memory list, persisted as JSON via
 * the caller (DataStore/file), capped at 2000 items dropping the OLDEST EMOTION rows
 * first. Pure logic — persistence is injected so tests need no Android.
 */
@Serializable
data class QueuedEvent(
    val kind: String, // emotion | ledger | app_usage | session
    val payloadJson: String,
    val clientUuid: String? = null,
    val createdAtMs: Long = 0,
)

class EventQueue(private val cap: Int = 2000) {

    private val items = ArrayDeque<QueuedEvent>()

    val size: Int get() = items.size

    fun add(event: QueuedEvent) {
        items.addLast(event)
        while (items.size > cap) {
            val oldestEmotion = items.indexOfFirst { it.kind == "emotion" }
            if (oldestEmotion >= 0) items.removeAt(oldestEmotion) else items.removeFirst()
        }
    }

    /** Up to [max] items ready to send (oldest first). */
    fun batch(max: Int = 200): List<QueuedEvent> = items.take(max)

    /** Remove exactly the sent items after a 2xx (idempotent by uuid/kind). */
    fun remove(sent: List<QueuedEvent>) {
        val byIdentity = sent.toHashSet()
        items.removeAll { it in byIdentity }
    }

    fun serialize(): String = Json.encodeToString(kotlinx.serialization.builtins.ListSerializer(QueuedEvent.serializer()), items.toList())

    fun deserialize(raw: String) {
        items.clear()
        items.addAll(Json.decodeFromString(kotlinx.serialization.builtins.ListSerializer(QueuedEvent.serializer()), raw))
    }
}
