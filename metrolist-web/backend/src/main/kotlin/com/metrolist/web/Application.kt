/*
 * Metrolist Web Backend
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
package com.metrolist.web

import com.metrolist.innertube.YouTube
import com.metrolist.innertube.YouTube.SearchFilter
import com.metrolist.innertube.models.AlbumItem
import com.metrolist.innertube.models.ArtistItem
import com.metrolist.innertube.models.PlaylistItem
import com.metrolist.innertube.models.SongItem
import com.metrolist.innertube.models.WatchEndpoint
import com.metrolist.innertube.models.YouTubeClient
import com.metrolist.web.player.InnerTubeXStreamService
import com.metrolist.web.routes.innerTubeRoutes
import com.metrolist.web.routes.libraryRoutes
import com.metrolist.web.routes.queueRoutes
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.http.content.default
import io.ktor.server.http.content.staticFiles
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.request.receiveText
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondOutputStream
import io.ktor.server.response.respondText
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.head
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap

val DOWNLOADS_DIR = File(System.getProperty("user.home"), ".metrolist/downloads")
val downloadProgress = ConcurrentHashMap<String, Int>()
private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

fun findLocalAudioFile(videoId: String): File? {
    val candidates = listOf(
        File(DOWNLOADS_DIR, "$videoId.m4a"),
        File(DOWNLOADS_DIR, "$videoId.webm")
    )
    return candidates.firstOrNull { it.exists() && it.length() > 0 }
}

fun mimeTypeForFile(file: File): String = when (file.extension.lowercase()) {
    "webm" -> "audio/webm"
    "mp3" -> "audio/mpeg"
    else -> "audio/mp4"
}

suspend fun serveRangeFile(call: ApplicationCall, file: File, mimeType: String) {
    val totalLength = file.length()
    val rangeHeader = call.request.headers[HttpHeaders.Range]
    call.response.header(HttpHeaders.AcceptRanges, "bytes")

    if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
        val parts = rangeHeader.removePrefix("bytes=").split("-", limit = 2)
        val start = parts.getOrNull(0)?.toLongOrNull() ?: 0L
        val end = parts.getOrNull(1)?.toLongOrNull()?.coerceAtMost(totalLength - 1) ?: (totalLength - 1)
        if (start >= totalLength || start > end || start < 0) {
            call.response.header(HttpHeaders.ContentRange, "bytes */$totalLength")
            call.respond(HttpStatusCode.RequestedRangeNotSatisfiable)
            return
        }
        val length = end - start + 1
        call.response.header(HttpHeaders.ContentRange, "bytes $start-$end/$totalLength")
        call.response.header(HttpHeaders.ContentLength, length.toString())
        call.respondOutputStream(ContentType.parse(mimeType), HttpStatusCode.PartialContent) {
            FileInputStream(file).use { fis ->
                fis.channel.position(start)
                val buf = ByteArray(16384)
                var remaining = length
                while (remaining > 0) {
                    val toRead = minOf(buf.size.toLong(), remaining).toInt()
                    val read = fis.read(buf, 0, toRead)
                    if (read <= 0) break
                    write(buf, 0, read)
                    remaining -= read
                }
            }
        }
    } else {
        call.response.header(HttpHeaders.ContentLength, totalLength.toString())
        call.respondOutputStream(ContentType.parse(mimeType), HttpStatusCode.OK) {
            FileInputStream(file).use { it.copyTo(this, 16384) }
        }
    }
}

fun getUserAgentForStreamUrl(urlStr: String): String {
    val clientParam = Regex("[?&]c=([^&]+)").find(urlStr)?.groupValues?.get(1)
    return when (clientParam) {
        "ANDROID_VR" -> YouTubeClient.ANDROID_VR_1_65_10.userAgent
        "ANDROID", "ANDROID_MUSIC" -> YouTubeClient.ANDROID_NO_SDK.userAgent
        "TVHTML5", "TVHTML5_SIMPLY" -> YouTubeClient.TVHTML5.userAgent
        "IOS" -> YouTubeClient.IOS.userAgent
        "WEB", "WEB_REMIX" -> YouTubeClient.USER_AGENT_WEB
        else -> YouTubeClient.USER_AGENT_WEB
    }
}

@Serializable
data class SearchSong(
    val id: String,
    val title: String,
    val artist: String?,
    val album: String?,
    val duration: Int?,
    val thumbnailUrl: String?
)

@Serializable
data class SearchItemDto(
    val id: String,
    val title: String,
    val subtitle: String? = null,
    val artist: String? = null,
    val album: String? = null,
    val duration: Int? = null,
    val thumbnailUrl: String? = null,
    val type: String = "song"
)

@Serializable
data class PlaylistDetailsResponse(
    val id: String,
    val title: String,
    val author: String?,
    val thumbnailUrl: String?,
    val songCount: Int,
    val songs: List<SearchSong>
)

@Serializable
data class ArtistDetailsResponse(
    val id: String,
    val title: String,
    val thumbnailUrl: String?,
    val description: String?,
    val subscriberCount: String?,
    val sections: List<HomeSection>
)

@Serializable
data class NextResponse(
    val items: List<SearchSong>
)

@Serializable
data class HomeChipDto(
    val title: String,
    val params: String?
)

@Serializable
data class HomeResponse(
    val sections: List<HomeSection>,
    val chips: List<HomeChipDto> = emptyList()
)

@Serializable
data class HomeSection(
    val title: String,
    val items: List<HomeItem>
)

@Serializable
data class HomeItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val cover: String?,
    val type: String,
    val duration: Int? = null
)

@Serializable
data class ApiError(val error: String)

@Serializable
data class StreamResponse(
    val url: String?,
    val signatureCipher: String? = null,
    val playerJsUrl: String? = null,
    val mimeType: String? = null,
    val bitrate: Int? = null,
    val codecs: String? = null,
    val clientName: String? = null,
    val durationSeconds: Long? = null,
    val loudnessDb: Double? = null,
    val isSabr: Boolean = false
)

private fun com.metrolist.innertube.models.YTItem.toHomeItem(): HomeItem? = when (this) {
    is SongItem -> HomeItem(id, title, artists.joinToString { it.name }, thumbnail, "song", duration)
    is AlbumItem -> HomeItem(browseId, title, artists?.joinToString { it.name } ?: "", thumbnail, "album")
    is PlaylistItem -> HomeItem(id, title, author?.name ?: "", thumbnail, "playlist")
    is ArtistItem -> HomeItem(id, title, "Artist", thumbnail, "artist")
    else -> null
}

fun main() {
    val port = 8091
    embeddedServer(Netty, port = port) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true; encodeDefaults = true })
        }
        install(CORS) {
            anyHost()
            allowHeader(HttpHeaders.Range)
            allowHeader(HttpHeaders.ContentType)
            allowHeader(HttpHeaders.Authorization)
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Delete)
            allowMethod(HttpMethod.Options)
            allowMethod(HttpMethod.Head)
            exposeHeader(HttpHeaders.ContentRange)
            exposeHeader(HttpHeaders.AcceptRanges)
            exposeHeader(HttpHeaders.ContentLength)
        }

        com.metrolist.web.db.DatabaseFactory.init()
        InnerTubeXStreamService.prewarmAsync()

        routing {
            queueRoutes()
            libraryRoutes()
            innerTubeRoutes()

            staticFiles("/", File("..")) {
                default("index.html")
            }

            get("/api/health") {
                call.respond(
                    mapOf(
                        "status" to "ok",
                        "service" to "metrolist-innertube",
                        "version" to "14.0.0",
                        "engine" to "innertubex-0.13.1"
                    )
                )
            }

            get("/api/home") {
                val params = call.request.queryParameters["params"]?.takeIf { it.isNotBlank() }
                val result = YouTube.home(params = params).getOrElse {
                    call.respond(HttpStatusCode.BadGateway, ApiError("YouTube Music home failed: ${it.message}"))
                    return@get
                }
                val responseSections = result.sections.map { section ->
                    HomeSection(
                        title = section.title,
                        items = section.items.mapNotNull { it.toHomeItem() }
                    )
                }
                val chips = result.chips.orEmpty().mapNotNull { chip ->
                    chip.endpoint?.params?.let { HomeChipDto(chip.title, it) }
                }
                call.respond(HomeResponse(responseSections, chips))
            }

            get("/api/search") {
                val query = call.request.queryParameters["q"]?.trim().orEmpty()
                if (query.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Query parameter q is required."))
                    return@get
                }
                val result = YouTube.search(query, SearchFilter.FILTER_SONG).getOrElse {
                    call.respond(HttpStatusCode.BadGateway, ApiError("YouTube Music search failed: ${it.message}"))
                    return@get
                }
                val songs = result.items.filterIsInstance<SongItem>().map { song ->
                    SearchSong(song.id, song.title, song.artists.joinToString { it.name }, song.album?.name, song.duration, song.thumbnail)
                }
                call.respond(songs)
            }

            get("/api/search/v2") {
                val query = call.request.queryParameters["q"]?.trim().orEmpty()
                val filterParam = call.request.queryParameters["filter"]?.lowercase() ?: "songs"
                if (query.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Query parameter q is required."))
                    return@get
                }

                val filter = when (filterParam) {
                    "videos" -> SearchFilter.FILTER_VIDEO
                    "albums" -> SearchFilter.FILTER_ALBUM
                    "artists" -> SearchFilter.FILTER_ARTIST
                    "playlists" -> SearchFilter.FILTER_COMMUNITY_PLAYLIST
                    else -> SearchFilter.FILTER_SONG
                }

                val result = YouTube.search(query, filter).getOrElse {
                    call.respond(HttpStatusCode.BadGateway, ApiError("YouTube Music search failed: ${it.message}"))
                    return@get
                }

                val items = result.items.mapNotNull { item ->
                    when (item) {
                        is SongItem -> SearchItemDto(
                            id = item.id,
                            title = item.title,
                            subtitle = item.artists.joinToString { it.name },
                            artist = item.artists.joinToString { it.name },
                            album = item.album?.name,
                            duration = item.duration,
                            thumbnailUrl = item.thumbnail,
                            type = if (item.isVideoSong) "video" else "song"
                        )
                        is AlbumItem -> SearchItemDto(
                            id = item.browseId,
                            title = item.title,
                            subtitle = listOfNotNull(item.artists?.joinToString { it.name }, item.year?.toString()).joinToString(" • "),
                            artist = item.artists?.joinToString { it.name },
                            thumbnailUrl = item.thumbnail,
                            type = "album"
                        )
                        is PlaylistItem -> SearchItemDto(
                            id = item.id,
                            title = item.title,
                            subtitle = listOfNotNull(item.author?.name, item.songCountText).joinToString(" • "),
                            artist = item.author?.name,
                            thumbnailUrl = item.thumbnail,
                            type = "playlist"
                        )
                        is ArtistItem -> SearchItemDto(
                            id = item.id,
                            title = item.title,
                            subtitle = "Artist",
                            thumbnailUrl = item.thumbnail,
                            type = "artist"
                        )
                        else -> null
                    }
                }
                call.respond(items)
            }

            get("/api/artist/{id}") {
                val id = call.parameters["id"]
                if (id.isNullOrBlank()) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Artist ID is required."))
                    return@get
                }
                val result = YouTube.artist(id).getOrElse {
                    call.respond(HttpStatusCode.BadGateway, ApiError("Artist fetch failed: ${it.message}"))
                    return@get
                }
                val sections = result.sections.map { sec ->
                    HomeSection(
                        title = sec.title,
                        items = sec.items.mapNotNull { it.toHomeItem() }
                    )
                }.filter { it.items.isNotEmpty() }

                call.respond(
                    ArtistDetailsResponse(
                        id = result.artist.id,
                        title = result.artist.title,
                        thumbnailUrl = result.artist.thumbnail,
                        description = result.description,
                        subscriberCount = result.monthlyListenerCount ?: result.subscriberCountText,
                        sections = sections
                    )
                )
            }

            get("/api/innertube/next") {
                val videoId = call.request.queryParameters["videoId"]?.trim().orEmpty()
                if (videoId.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Query parameter videoId is required."))
                    return@get
                }
                val result = YouTube.next(WatchEndpoint(videoId = videoId)).getOrElse {
                    call.respond(HttpStatusCode.BadGateway, ApiError("YouTube Music next failed: ${it.message}"))
                    return@get
                }
                val songs = result.items.filterIsInstance<SongItem>().map { song ->
                    SearchSong(song.id, song.title, song.artists.joinToString { it.name }, song.album?.name, song.duration, song.thumbnail)
                }
                call.respond(NextResponse(songs))
            }

            get("/api/playlist/{id}") {
                val id = call.parameters["id"]
                if (id.isNullOrBlank()) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Playlist ID is required."))
                    return@get
                }
                val result = YouTube.playlist(id).getOrElse {
                    call.respond(HttpStatusCode.BadGateway, ApiError("Playlist fetch failed: ${it.message}"))
                    return@get
                }
                val songs = result.songs.map { song ->
                    SearchSong(song.id, song.title, song.artists.joinToString { it.name }, song.album?.name, song.duration, song.thumbnail)
                }
                call.respond(
                    PlaylistDetailsResponse(
                        id = result.playlist.id,
                        title = result.playlist.title,
                        author = result.playlist.author?.name,
                        thumbnailUrl = result.playlist.thumbnail,
                        songCount = songs.size,
                        songs = songs
                    )
                )
            }

            get("/api/album/{id}") {
                val id = call.parameters["id"]
                if (id.isNullOrBlank()) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Album ID is required."))
                    return@get
                }
                val result = YouTube.album(id).getOrElse {
                    call.respond(HttpStatusCode.BadGateway, ApiError("Album fetch failed: ${it.message}"))
                    return@get
                }
                val songs = result.songs.map { song ->
                    SearchSong(song.id, song.title, song.artists.joinToString { it.name }, result.album.title, song.duration, song.thumbnail)
                }
                call.respond(
                    PlaylistDetailsResponse(
                        id = result.album.id,
                        title = result.album.title,
                        author = result.album.artists?.joinToString { it.name },
                        thumbnailUrl = result.album.thumbnail,
                        songCount = songs.size,
                        songs = songs
                    )
                )
            }

            get("/api/lyrics") {
                val videoId = call.request.queryParameters["videoId"]?.trim()
                val title = call.request.queryParameters["title"]?.trim()
                val artist = call.request.queryParameters["artist"]?.trim()
                val duration = call.request.queryParameters["duration"]?.toIntOrNull()
                val lyrics = InnerTubeXStreamService.getLyrics(videoId, title, artist, duration)
                call.respond(lyrics)
            }

            get("/api/stream/{videoId}") {
                val videoId = call.parameters["videoId"]
                if (videoId.isNullOrBlank() || !videoId.matches(Regex("[A-Za-z0-9_-]{6,}"))) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("A valid video ID is required."))
                    return@get
                }

                val localFile = findLocalAudioFile(videoId)
                if (localFile != null) {
                    call.respond(
                        StreamResponse(
                            url = "http://localhost:8091/api/localfile/$videoId",
                            mimeType = mimeTypeForFile(localFile),
                            clientName = "OFFLINE"
                        )
                    )
                    return@get
                }

                val quality = call.request.queryParameters["quality"] ?: "high"
                try {
                    val stream = InnerTubeXStreamService.resolveStream(videoId, quality)
                    if (stream != null) {
                        if (stream.sabrBootstrap != null) {
                            // Kick off SABR cache prefetch immediately
                            InnerTubeXStreamService.getOrStartSabrCache(videoId, quality, stream)
                        }
                        call.respond(
                            StreamResponse(
                                url = "http://localhost:8091/api/stream_audio?videoId=$videoId&quality=$quality",
                                mimeType = stream.mimeType,
                                bitrate = stream.bitrate,
                                codecs = stream.codecs,
                                clientName = stream.clientName,
                                durationSeconds = stream.mediaMetadata?.durationSeconds,
                                loudnessDb = stream.loudnessDb,
                                isSabr = stream.sabrBootstrap != null
                            )
                        )
                    } else {
                        call.respond(HttpStatusCode.NotFound, ApiError("No playable audio streams found"))
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(HttpStatusCode.BadGateway, ApiError("Stream error: ${e.message}"))
                }
            }

            get("/api/localfile/{videoId}") {
                val videoId = call.parameters["videoId"]
                if (videoId.isNullOrBlank() || !videoId.matches(Regex("[A-Za-z0-9_-]{6,}"))) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Invalid video ID"))
                    return@get
                }
                val localFile = findLocalAudioFile(videoId)
                if (localFile != null) {
                    serveRangeFile(call, localFile, mimeTypeForFile(localFile))
                } else {
                    call.respond(HttpStatusCode.NotFound, ApiError("File not found"))
                }
            }

            get("/api/download/progress") {
                call.respond(downloadProgress)
            }

            post("/api/download/{videoId}") {
                val videoId = call.parameters["videoId"]
                if (videoId.isNullOrBlank() || !videoId.matches(Regex("[A-Za-z0-9_-]{6,}"))) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Invalid video ID"))
                    return@post
                }

                if (!DOWNLOADS_DIR.exists()) DOWNLOADS_DIR.mkdirs()

                if (findLocalAudioFile(videoId) != null) {
                    call.respond(mapOf("status" to "already_downloaded"))
                    return@post
                }

                call.respond(mapOf("status" to "downloading"))

                backgroundScope.launch {
                    try {
                        downloadProgress[videoId] = 0
                        val file = InnerTubeXStreamService.downloadToFile(videoId, DOWNLOADS_DIR) { pct ->
                            downloadProgress[videoId] = pct
                        }
                        downloadProgress.remove(videoId)
                        if (file != null) {
                            println("Successfully downloaded ${file.name}")
                        } else {
                            println("Download failed for $videoId: no stream")
                        }
                    } catch (e: Exception) {
                        println("Failed to download $videoId: ${e.message}")
                        downloadProgress.remove(videoId)
                        findLocalAudioFile(videoId)?.delete()
                    }
                }
            }

            delete("/api/download/{videoId}") {
                val videoId = call.parameters["videoId"]
                if (videoId.isNullOrBlank() || !videoId.matches(Regex("[A-Za-z0-9_-]{6,}"))) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Invalid video ID"))
                    return@delete
                }
                File(DOWNLOADS_DIR, "$videoId.m4a").takeIf { it.exists() }?.delete()
                File(DOWNLOADS_DIR, "$videoId.webm").takeIf { it.exists() }?.delete()
                call.respond(mapOf("status" to "deleted"))
            }

            get("/api/proxy") {
                val urlParam = call.request.queryParameters["url"]
                if (urlParam.isNullOrBlank() || !urlParam.startsWith("https://www.youtube.com/")) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Invalid URL"))
                    return@get
                }

                try {
                    val url = URL(urlParam)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.setRequestProperty("User-Agent", YouTubeClient.USER_AGENT_WEB)

                    val responseCode = conn.responseCode
                    if (responseCode == HttpURLConnection.HTTP_OK) {
                        val responseText = conn.inputStream.bufferedReader().use { it.readText() }
                        call.respondText(responseText, ContentType.Text.Plain)
                    } else {
                        call.respond(HttpStatusCode.BadGateway, ApiError("Proxy request failed with code $responseCode"))
                    }
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, ApiError("Proxy error: ${e.message}"))
                }
            }

            get("/api/stream_audio") {
                val videoId = call.request.queryParameters["videoId"]?.trim()
                val quality = call.request.queryParameters["quality"] ?: "high"
                val urlParam = call.request.queryParameters["url"]
                val rangeHeader = call.request.headers[HttpHeaders.Range]

                if (!videoId.isNullOrBlank()) {
                    val stream = InnerTubeXStreamService.resolveStream(videoId, quality)
                    if (stream == null) {
                        call.respond(HttpStatusCode.NotFound, ApiError("No stream found for $videoId"))
                        return@get
                    }

                    if (stream.sabrBootstrap != null) {
                        val session = InnerTubeXStreamService.getOrStartSabrCache(videoId, quality, stream)
                        // For typical songs (~3-5 MB), SABR finishes in ~1-2.5s; waiting briefly enables instant native 206 seeking!
                        if (!session.finished) {
                            withTimeoutOrNull(4500L) { session.completed.await() }
                        }

                        if (session.finished && session.file.exists()) {
                            serveRangeFile(call, session.file, session.mimeType)
                            return@get
                        }

                        // Still downloading (long track) — ensure first chunk arrived, then tail the growing file
                        val ready = withTimeoutOrNull(10_000L) {
                            session.firstChunkReady.await()
                            true
                        } ?: false

                        if (!ready || session.error != null) {
                            call.respond(HttpStatusCode.BadGateway, ApiError("SABR stream failed: ${session.error?.message ?: "timeout"}"))
                            return@get
                        }

                        call.respondOutputStream(ContentType.parse(session.mimeType), HttpStatusCode.OK) {
                            var offset = 0L
                            val buf = ByteArray(16384)
                            while (true) {
                                val targetFile = if (session.finished && session.file.exists()) session.file else session.partFile
                                if (targetFile.exists() && targetFile.length() > offset) {
                                    FileInputStream(targetFile).use { fis ->
                                        fis.channel.position(offset)
                                        var read: Int
                                        while (fis.read(buf).also { read = it } > 0) {
                                            write(buf, 0, read)
                                            offset += read
                                        }
                                        flush()
                                    }
                                } else if (session.finished || session.error != null) {
                                    break
                                } else {
                                    delay(50)
                                }
                            }
                        }
                        return@get
                    }

                    // Direct stream resolved by InnerTubeX (already n-transformed & signature-deciphered with exact headers!)
                    val streamed = proxyDirectStream(call, stream.audioUrl, stream.headers, rangeHeader, respondOnFailure = false)
                    if (!streamed) {
                        InnerTubeXStreamService.invalidateStream(videoId)
                        val fallback = InnerTubeXStreamService.resolveSabrFallback(videoId, quality)
                        if (fallback?.sabrBootstrap != null) {
                            val session = InnerTubeXStreamService.getOrStartSabrCache(videoId, quality, fallback)
                            if (!session.finished) {
                                withTimeoutOrNull(4500L) { session.completed.await() }
                            }
                            if (session.finished && session.file.exists()) {
                                serveRangeFile(call, session.file, session.mimeType)
                                return@get
                            }
                            val ready = withTimeoutOrNull(10_000L) {
                                session.firstChunkReady.await()
                                true
                            } ?: false
                            if (ready && session.error == null) {
                                call.respondOutputStream(ContentType.parse(session.mimeType), HttpStatusCode.OK) {
                                    var offset = 0L
                                    val buf = ByteArray(16384)
                                    while (true) {
                                        val targetFile = if (session.finished && session.file.exists()) session.file else session.partFile
                                        if (targetFile.exists() && targetFile.length() > offset) {
                                            FileInputStream(targetFile).use { fis ->
                                                fis.channel.position(offset)
                                                var read: Int
                                                while (fis.read(buf).also { read = it } > 0) {
                                                    write(buf, 0, read)
                                                    offset += read
                                                }
                                                flush()
                                            }
                                        } else if (session.finished || session.error != null) {
                                            break
                                        } else {
                                            delay(50)
                                        }
                                    }
                                }
                                return@get
                            }
                        }
                        call.respond(HttpStatusCode.BadGateway, ApiError("Audio proxy & fallback failed for $videoId"))
                    }
                    return@get
                }

                if (urlParam.isNullOrBlank()) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Missing videoId or url"))
                    return@get
                }
                proxyDirectStream(call, urlParam, mapOf("User-Agent" to getUserAgentForStreamUrl(urlParam)), rangeHeader)
            }

            head("/api/stream_audio") {
                val videoId = call.request.queryParameters["videoId"]?.trim()
                val quality = call.request.queryParameters["quality"] ?: "high"
                if (!videoId.isNullOrBlank()) {
                    val stream = InnerTubeXStreamService.resolveStream(videoId, quality)
                    if (stream?.sabrBootstrap != null) {
                        val session = InnerTubeXStreamService.getOrStartSabrCache(videoId, quality, stream)
                        if (session.finished && session.file.exists()) {
                            call.response.header(HttpHeaders.AcceptRanges, "bytes")
                            call.response.header(HttpHeaders.ContentLength, session.file.length().toString())
                        }
                        call.respond(HttpStatusCode.OK)
                        return@head
                    } else if (stream != null) {
                        call.response.header(HttpHeaders.AcceptRanges, "bytes")
                        stream.contentLengthBytes?.let { call.response.header(HttpHeaders.ContentLength, it.toString()) }
                        call.respond(HttpStatusCode.OK)
                        return@head
                    }
                }
                call.respond(HttpStatusCode.OK)
            }

            post("/api/botguard") {
                val action = call.request.queryParameters["action"]
                val body = call.receiveText()
                val urlStr = if (action == "create") {
                    "https://www.youtube.com/api/jnn/v1/Create"
                } else {
                    "https://www.youtube.com/api/jnn/v1/GenerateIT"
                }

                try {
                    val url = URL(urlStr)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("User-Agent", YouTubeClient.USER_AGENT_WEB)
                    conn.setRequestProperty("Accept", "application/json")
                    conn.setRequestProperty("Content-Type", "application/json+protobuf")
                    conn.setRequestProperty("x-goog-api-key", "AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw")
                    conn.setRequestProperty("x-user-agent", "grpc-web-javascript/0.1")
                    conn.doOutput = true

                    conn.outputStream.bufferedWriter().use {
                        it.write(body)
                        it.flush()
                    }

                    val responseCode = conn.responseCode
                    if (responseCode == HttpURLConnection.HTTP_OK) {
                        val responseText = conn.inputStream.bufferedReader().use { it.readText() }
                        call.respondText(responseText, ContentType.Application.Json)
                    } else {
                        val errorText = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                        call.respond(HttpStatusCode.BadGateway, ApiError("Botguard request failed with code $responseCode: $errorText"))
                    }
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, ApiError("Botguard error: ${e.message}"))
                }
            }

            get("/api/cipher_config") {
                val hash = call.request.queryParameters["hash"]
                if (hash.isNullOrBlank()) {
                    call.respond(HttpStatusCode.BadRequest, ApiError("Missing hash"))
                    return@get
                }

                try {
                    val stream = Thread.currentThread().contextClassLoader.getResourceAsStream("player_configs.json")
                    if (stream != null) {
                        val jsonText = stream.bufferedReader().use { it.readText() }
                        call.respondText(jsonText, ContentType.Application.Json)
                    } else {
                        call.respond(HttpStatusCode.NotFound, ApiError("player_configs.json not found"))
                    }
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.InternalServerError, ApiError("Error reading config: ${e.message}"))
                }
            }
        }
    }.start(wait = true)
}

private suspend fun proxyDirectStream(
    call: ApplicationCall,
    urlStr: String,
    headers: Map<String, String>,
    rangeHeader: String?,
    respondOnFailure: Boolean = true
): Boolean {
    return try {
        val reqBuilder = okhttp3.Request.Builder().url(urlStr).get()
        headers.forEach { (k, v) ->
            if (!k.equals("Range", true) && !k.equals("Accept-Encoding", true)) {
                reqBuilder.header(k, v)
            }
        }
        if (!headers.keys.any { it.equals("User-Agent", true) }) {
            reqBuilder.header("User-Agent", getUserAgentForStreamUrl(urlStr))
        }
        if (rangeHeader != null) {
            reqBuilder.header("Range", rangeHeader)
        }

        InnerTubeXStreamService.okHttpClient.newCall(reqBuilder.build()).execute().use { resp ->
            val responseCode = resp.code
            if (responseCode == 200 || responseCode == 206) {
                val contentType = resp.header("Content-Type") ?: "audio/mp4"
                call.response.header(HttpHeaders.AcceptRanges, "bytes")
                resp.header("Content-Range")?.let {
                    call.response.header(HttpHeaders.ContentRange, it)
                }
                resp.header("Content-Length")?.let {
                    call.response.header(HttpHeaders.ContentLength, it)
                }
                val body = resp.body ?: return false
                call.respondOutputStream(ContentType.parse(contentType), HttpStatusCode.fromValue(responseCode)) {
                    body.byteStream().use { it.copyTo(this, 16384) }
                }
                true
            } else {
                val errorText = resp.body?.string()?.take(200) ?: ""
                println("PROXY FAILED: HTTP $responseCode -> $errorText")
                if (respondOnFailure) {
                    call.respond(HttpStatusCode.BadGateway, ApiError("Audio proxy failed with code $responseCode"))
                }
                false
            }
        }
    } catch (e: Exception) {
        println("PROXY EXCEPTION: ${e.message}")
        if (respondOnFailure) {
            call.respond(HttpStatusCode.InternalServerError, ApiError("Audio proxy error: ${e.message}"))
        }
        false
    }
}
