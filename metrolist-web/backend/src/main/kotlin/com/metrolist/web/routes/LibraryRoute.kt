package com.metrolist.web.routes

import com.metrolist.web.PlaylistDetailsResponse
import com.metrolist.web.SearchSong
import com.metrolist.web.db.PlaylistSongMaps
import com.metrolist.web.db.Playlists
import com.metrolist.web.db.Songs
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.insertIgnore
import org.jetbrains.exposed.sql.max
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.update
import java.time.LocalDateTime
import java.util.UUID

@Serializable
data class SyncSongRequest(
    val id: String,
    val title: String,
    val artist: String? = null,
    val duration: Int,
    val thumbnailUrl: String?,
    val albumId: String?,
    val albumName: String?
)

@Serializable
data class ToggleLikeRequest(val id: String, val liked: Boolean)

@Serializable
data class CreatePlaylistRequest(val name: String)

@Serializable
data class AddSongRequest(
    val id: String,
    val title: String,
    val artist: String? = null,
    val thumbnailUrl: String? = null
)

fun Route.libraryRoutes() {
    route("/api/library") {

        post("/songs") {
            val req = call.receive<SyncSongRequest>()
            transaction {
                val existing = Songs.selectAll().where { Songs.id eq req.id }.singleOrNull()
                if (existing == null) {
                    Songs.insertIgnore {
                        it[id] = req.id
                        it[title] = req.title
                        it[artist] = req.artist
                        it[duration] = req.duration
                        it[thumbnailUrl] = req.thumbnailUrl
                        it[albumId] = req.albumId
                        it[albumName] = req.albumName
                        it[date] = LocalDateTime.now()
                    }
                } else if (!req.artist.isNullOrBlank() && existing[Songs.artist].isNullOrBlank()) {
                    Songs.update({ Songs.id eq req.id }) {
                        it[artist] = req.artist
                    }
                }
            }
            call.respond(HttpStatusCode.OK, mapOf("status" to "saved"))
        }

        post("/songs/like") {
            val req = call.receive<ToggleLikeRequest>()
            transaction {
                Songs.update({ Songs.id eq req.id }) {
                    it[liked] = req.liked
                    it[likedDate] = if (req.liked) LocalDateTime.now() else null
                }
            }
            call.respond(HttpStatusCode.OK, mapOf("status" to "updated"))
        }

        get("/songs/liked") {
            val likedSongs = transaction {
                Songs.selectAll().where { Songs.liked eq true }.map {
                    mapOf(
                        "id" to it[Songs.id],
                        "title" to it[Songs.title],
                        "artist" to (it[Songs.artist] ?: ""),
                        "thumbnailUrl" to (it[Songs.thumbnailUrl] ?: "")
                    )
                }
            }
            call.respond(likedSongs)
        }

        get("/playlists") {
            val playlists = transaction {
                Playlists.selectAll().map {
                    mapOf(
                        "id" to it[Playlists.id],
                        "name" to it[Playlists.name]
                    )
                }
            }
            call.respond(playlists)
        }

        post("/playlists") {
            val req = call.receive<CreatePlaylistRequest>()
            val newId = UUID.randomUUID().toString()
            transaction {
                Playlists.insert {
                    it[id] = newId
                    it[name] = req.name
                    it[inLibrary] = LocalDateTime.now()
                }
            }
            call.respond(HttpStatusCode.Created, mapOf("id" to newId, "name" to req.name))
        }

        delete("/playlists/{id}") {
            val playlistId = call.parameters["id"]
            if (playlistId == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@delete
            }
            transaction {
                PlaylistSongMaps.deleteWhere { PlaylistSongMaps.playlistId eq playlistId }
                Playlists.deleteWhere { Playlists.id eq playlistId }
            }
            call.respond(HttpStatusCode.OK, mapOf("status" to "deleted"))
        }

        get("/playlists/{id}") {
            val playlistId = call.parameters["id"]
            if (playlistId == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@get
            }

            val details = transaction {
                val playlistName = Playlists.selectAll().where { Playlists.id eq playlistId }
                    .singleOrNull()?.get(Playlists.name) ?: return@transaction null

                val songs = (PlaylistSongMaps innerJoin Songs)
                    .selectAll().where { PlaylistSongMaps.playlistId eq playlistId }
                    .orderBy(PlaylistSongMaps.position)
                    .map {
                        SearchSong(
                            id = it[Songs.id],
                            title = it[Songs.title],
                            artist = it[Songs.artist] ?: "",
                            album = it[Songs.albumName],
                            duration = it[Songs.duration],
                            thumbnailUrl = it[Songs.thumbnailUrl]
                        )
                    }

                PlaylistDetailsResponse(
                    id = playlistId,
                    title = playlistName,
                    author = "You",
                    thumbnailUrl = songs.firstOrNull()?.thumbnailUrl,
                    songCount = songs.size,
                    songs = songs
                )
            }
            if (details == null) call.respond(HttpStatusCode.NotFound)
            else call.respond(details)
        }

        post("/playlists/{id}/songs") {
            val playlistId = call.parameters["id"]
            if (playlistId == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@post
            }
            val req = call.receive<AddSongRequest>()

            transaction {
                val existing = Songs.selectAll().where { Songs.id eq req.id }.singleOrNull()
                if (existing == null) {
                    Songs.insertIgnore {
                        it[id] = req.id
                        it[title] = req.title
                        it[artist] = req.artist
                        it[thumbnailUrl] = req.thumbnailUrl
                        it[date] = LocalDateTime.now()
                    }
                } else if (!req.artist.isNullOrBlank() && existing[Songs.artist].isNullOrBlank()) {
                    Songs.update({ Songs.id eq req.id }) {
                        it[artist] = req.artist
                    }
                }

                val maxPos = PlaylistSongMaps
                    .select(PlaylistSongMaps.position.max())
                    .where { PlaylistSongMaps.playlistId eq playlistId }
                    .singleOrNull()?.get(PlaylistSongMaps.position.max()) ?: 0

                PlaylistSongMaps.insertIgnore {
                    it[this.playlistId] = playlistId
                    it[songId] = req.id
                    it[position] = maxPos + 1
                }
            }
            call.respond(HttpStatusCode.OK, mapOf("status" to "added"))
        }

        delete("/playlists/{id}/songs/{songId}") {
            val playlistId = call.parameters["id"]
            val songId = call.parameters["songId"]
            if (playlistId == null || songId == null) {
                call.respond(HttpStatusCode.BadRequest)
                return@delete
            }

            transaction {
                PlaylistSongMaps.deleteWhere {
                    (PlaylistSongMaps.playlistId eq playlistId) and (PlaylistSongMaps.songId eq songId)
                }
            }
            call.respond(HttpStatusCode.OK, mapOf("status" to "deleted"))
        }
    }
}
