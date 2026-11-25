package com.metrolist.web.routes

import com.metrolist.innertube.YouTube
import com.metrolist.innertube.models.WatchEndpoint
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable

@Serializable
data class QueueRequest(val videoId: String?, val playlistId: String?, val continuation: String?)

@Serializable
data class QueueResponse(
    val title: String?,
    val items: List<QueueItem>,
    val currentIndex: Int,
    val continuation: String?
)

@Serializable
data class QueueItem(
    val id: String,
    val title: String,
    val artists: String,
    val album: String?,
    val duration: Int,
    val thumbnail: String?
)

fun Route.queueRoutes() {
    route("/api/queue") {
        get("/next") {
            val videoId = call.request.queryParameters["videoId"]
            val playlistId = call.request.queryParameters["playlistId"]
            val continuation = call.request.queryParameters["continuation"]
            
            if (videoId == null && playlistId == null && continuation == null) {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing parameters"))
                return@get
            }
            
            val endpoint = WatchEndpoint(videoId = videoId, playlistId = playlistId)
            val result = YouTube.next(endpoint, continuation).getOrElse {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (it.message ?: "Unknown error")))
                return@get
            }
            
            val response = QueueResponse(
                title = result.title,
                items = result.items.map { item ->
                    QueueItem(
                        id = item.id,
                        title = item.title,
                        artists = item.artists.joinToString { it.name },
                        album = item.album?.name,
                        duration = item.duration ?: 0,
                        thumbnail = item.thumbnail
                    )
                },
                currentIndex = result.currentIndex ?: 0,
                continuation = result.continuation
            )
            
            call.respond(response)
        }
    }
}
