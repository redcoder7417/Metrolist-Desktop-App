package com.metrolist.web.player

import com.metrolist.innertubex.InnerTube
import com.metrolist.innertubex.cipher.PlayerConfigRepository
import com.metrolist.innertubex.cipher.RemotePlayerConfigStore
import com.metrolist.innertubex.cipher.YouTubeCipherService
import com.metrolist.innertubex.extraction.AudioQuality
import com.metrolist.innertubex.extraction.ContentHints
import com.metrolist.innertubex.extraction.ExtractedStream
import com.metrolist.innertubex.extraction.InnerTubeExtractor
import com.metrolist.innertubex.extraction.YtConfigParserImpl
import com.metrolist.innertubex.models.YouTubeClient
import com.metrolist.innertubex.sabr.ExperimentalSabrApi
import com.metrolist.innertubex.sabr.SabrAudioStream
import com.metrolist.innertubex.transcriptCues
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.Request
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.io.FileOutputStream
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

@Serializable
data class LyricLineDto(
    val timeMs: Long,
    val text: String
)

@Serializable
data class LyricsResponseDto(
    val synced: Boolean,
    val lines: List<LyricLineDto>,
    val plain: String? = null,
    val source: String? = null
)

@Serializable
private data class FaradayCacheState(
    val json: String = "",
    val fetchedAtMs: Long = 0L,
    val sourceUrl: String = "",
    val etag: String = ""
)

class FilePlayerConfigRepository(
    private val cacheFile: File
) : PlayerConfigRepository {
    private val jsonCodec = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private var state: FaradayCacheState = loadState()

    override val enabled: Boolean = true
    override val defaultSourceUrl: String =
        "https://raw.githubusercontent.com/MetrolistGroup/faraday/master/registry/player_configs.json"
    override val sourceUrl: String = defaultSourceUrl

    private fun loadState(): FaradayCacheState {
        return try {
            if (cacheFile.exists() && cacheFile.length() > 0) {
                jsonCodec.decodeFromString<FaradayCacheState>(cacheFile.readText())
            } else {
                FaradayCacheState()
            }
        } catch (_: Exception) {
            FaradayCacheState()
        }
    }

    @Synchronized
    private fun saveState() {
        try {
            cacheFile.parentFile?.mkdirs()
            cacheFile.writeText(jsonCodec.encodeToString(state))
        } catch (_: Exception) {
        }
    }

    override var cachedJson: String
        @Synchronized get() = state.json
        @Synchronized set(value) {
            state = state.copy(json = value)
            saveState()
        }

    override var cachedAtMs: Long
        @Synchronized get() = state.fetchedAtMs
        @Synchronized set(value) {
            state = state.copy(fetchedAtMs = value)
            saveState()
        }

    override var cachedSourceUrl: String
        @Synchronized get() = state.sourceUrl
        @Synchronized set(value) {
            state = state.copy(sourceUrl = value)
            saveState()
        }

    override var cachedEtag: String
        @Synchronized get() = state.etag
        @Synchronized set(value) {
            state = state.copy(etag = value)
            saveState()
        }
}

class SabrCacheSession(
    val file: File,
    val partFile: File,
    val mimeType: String
) {
    @Volatile var bytesWritten: Long = 0L
    @Volatile var finished: Boolean = false
    @Volatile var error: Throwable? = null
    val firstChunkReady = CompletableDeferred<Unit>()
    val completed = CompletableDeferred<Boolean>()
}

@OptIn(ExperimentalSabrApi::class)
object InnerTubeXStreamService {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    private val dataDir = File(System.getProperty("user.home"), ".metrolist").apply {
        if (!exists()) mkdirs()
    }
    val streamCacheDir = File(dataDir, "stream_cache").apply {
        if (!exists()) mkdirs()
    }

    private data class DnsCacheEntry(
        val addresses: List<InetAddress>,
        val expiresAtMs: Long
    )

    /**
     * System DNS with retry + Cloudflare/Google DNS-over-HTTPS fallback so transient
     * OS/ISP resolver failures on googlevideo.com or lrclib.net recover transparently.
     */
    private object ResilientDns : Dns {
        private val cache = ConcurrentHashMap<String, DnsCacheEntry>()
        private val dohClient = OkHttpClient.Builder()
            .connectTimeout(4, TimeUnit.SECONDS)
            .readTimeout(4, TimeUnit.SECONDS)
            .build()

        override fun lookup(hostname: String): List<InetAddress> {
            val now = System.currentTimeMillis()
            cache[hostname]?.let { cached ->
                if (now < cached.expiresAtMs && cached.addresses.isNotEmpty()) {
                    return cached.addresses
                }
            }

            // 1. Try system DNS (with a quick retry on transient blip)
            var lastErr: UnknownHostException? = null
            repeat(2) { attempt ->
                try {
                    val addrs = Dns.SYSTEM.lookup(hostname)
                    if (addrs.isNotEmpty()) {
                        // Prefer IPv4 first to avoid broken IPv6 routes on some Windows networks
                        val sorted = addrs.sortedBy { if (it is java.net.Inet4Address) 0 else 1 }
                        cache[hostname] = DnsCacheEntry(sorted, now + 5 * 60_000L)
                        return sorted
                    }
                } catch (e: UnknownHostException) {
                    lastErr = e
                    if (attempt == 0) Thread.sleep(80)
                }
            }

            // 2. Fallback to DNS-over-HTTPS via direct resolver IPs (no recursive DNS needed)
            val dohUrls = listOf(
                "https://1.1.1.1/dns-query?name=$hostname&type=A",
                "https://8.8.8.8/resolve?name=$hostname&type=A"
            )
            for (url in dohUrls) {
                try {
                    val req = Request.Builder()
                        .url(url)
                        .header("Accept", "application/dns-json")
                        .build()
                    dohClient.newCall(req).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val body = resp.body?.string().orEmpty()
                            val obj = json.parseToJsonElement(body).jsonObject
                            val answers = obj["Answer"]?.jsonArray ?: JsonArray(emptyList())
                            val resolved = answers.mapNotNull { ans ->
                                val a = ans.jsonObject
                                val type = a["type"]?.jsonPrimitive?.contentOrNull?.toIntOrNull()
                                val data = a["data"]?.jsonPrimitive?.contentOrNull
                                if ((type == 1 || type == 28) && !data.isNullOrBlank()) {
                                    runCatching { InetAddress.getByName(data) }.getOrNull()
                                } else null
                            }
                            if (resolved.isNotEmpty()) {
                                println("[ResilientDns] Resolved $hostname via DoH (${resolved.first().hostAddress})")
                                cache[hostname] = DnsCacheEntry(resolved, now + 5 * 60_000L)
                                return resolved
                            }
                        }
                    }
                } catch (_: Exception) {
                }
            }

            throw lastErr ?: UnknownHostException("Unable to resolve host: $hostname")
        }
    }

    val resilientDns: Dns = ResilientDns

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .dns(ResilientDns)
        .followRedirects(false)
        .followSslRedirects(false)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    val httpClient: HttpClient = HttpClient(OkHttp) {
        engine {
            preconfigured = okHttpClient
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 60_000
            connectTimeoutMillis = 15_000
            socketTimeoutMillis = 30_000
        }
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
        followRedirects = false
    }

    private val playerConfigRepo = FilePlayerConfigRepository(File(dataDir, "faraday_cache.json"))
    private val remoteConfigStore = RemotePlayerConfigStore(httpClient, playerConfigRepo)
    private val cipherService = YouTubeCipherService(httpClient, remoteConfigStore)
    val innerTube = InnerTube(httpClient)
    private val configParser = YtConfigParserImpl(httpClient, innerTube, remoteConfigStore, cipherService = cipherService)
    private val extractor = InnerTubeExtractor(configParser, cipherService, innerTube)

    private data class CachedStream(
        val stream: ExtractedStream,
        val cachedAtMs: Long
    )

    private val streamCache = ConcurrentHashMap<String, CachedStream>()
    private val sabrSessions = ConcurrentHashMap<String, SabrCacheSession>()

    @Volatile
    private var prewarmed = false

    fun prewarmAsync() {
        if (prewarmed) return
        scope.launch {
            try {
                extractor.prewarm()
                prewarmed = true
                println("[InnerTubeX] Prewarm completed")
            } catch (e: Exception) {
                println("[InnerTubeX] Prewarm skipped/failed: ${e.message}")
            }
        }
    }

    fun clearExpiredCache() {
        val now = System.currentTimeMillis()
        streamCache.entries.removeIf { now - it.value.cachedAtMs > 2 * 60 * 60 * 1000L }
    }

    fun invalidateStream(videoId: String) {
        streamCache.keys.removeIf { it.startsWith("$videoId:") }
    }

    suspend fun resolveStream(videoId: String, quality: String = "high"): ExtractedStream? {
        clearExpiredCache()
        val key = "$videoId:$quality"
        val existing = streamCache[key]
        if (existing != null && System.currentTimeMillis() - existing.cachedAtMs < 90 * 60 * 1000L) {
            return existing.stream
        }

        val audioQuality = when (quality.lowercase()) {
            "low" -> AudioQuality.LOW
            "medium" -> AudioQuality.AUTO
            else -> AudioQuality.HIGH
        }

        val primaryHints = ContentHints().withStreamCapabilities(
            allowHls = false,
            allowSabr = true,
            allowBoundedRange = false,
            allowProgressive = true
        )

        var stream: ExtractedStream? = null
        for (attempt in 1..2) {
            stream = try {
                extractor.extract(videoId, primaryHints, audioQuality = audioQuality)
            } catch (e: Exception) {
                println("[InnerTubeX] extract($videoId, $quality) attempt $attempt failed: ${e.message}")
                null
            }
            if (stream != null) break
            if (attempt == 1) delay(250)
        }

        if (stream == null) {
            stream = resolveSabrFallback(videoId, quality)
        }

        if (stream != null) {
            streamCache[key] = CachedStream(stream, System.currentTimeMillis())
            println("[InnerTubeX] Resolved $videoId via ${stream.clientName} (${stream.profileId}) mime=${stream.mimeType} sabr=${stream.sabrBootstrap != null}")
        }
        return stream
    }

    suspend fun resolveSabrFallback(videoId: String, quality: String = "high"): ExtractedStream? {
        val audioQuality = when (quality.lowercase()) {
            "low" -> AudioQuality.LOW
            "medium" -> AudioQuality.AUTO
            else -> AudioQuality.HIGH
        }
        val sabrHints = ContentHints().withStreamCapabilities(
            allowHls = false,
            allowSabr = true,
            allowBoundedRange = false,
            allowProgressive = false
        )
        return try {
            val stream = extractor.extract(videoId, sabrHints, audioQuality = audioQuality)
            if (stream != null) {
                streamCache["$videoId:$quality"] = CachedStream(stream, System.currentTimeMillis())
                println("[InnerTubeX] SABR fallback resolved $videoId via ${stream.clientName} (${stream.profileId})")
            }
            stream
        } catch (e: Exception) {
            println("[InnerTubeX] SABR fallback($videoId, $quality) failed: ${e.message}")
            null
        }
    }

    fun getCachedStream(videoId: String, quality: String = "high"): ExtractedStream? {
        return streamCache["$videoId:$quality"]?.stream
    }

    fun getOrStartSabrCache(videoId: String, quality: String, stream: ExtractedStream): SabrCacheSession {
        val bootstrap = requireNotNull(stream.sabrBootstrap) { "Stream is not SABR" }
        val mime = stream.mimeType ?: "audio/mp4"
        val ext = if (mime.contains("webm", ignoreCase = true)) "webm" else "m4a"
        val key = "${videoId}_$quality"
        val finalFile = File(streamCacheDir, "$key.$ext")
        val partFile = File(streamCacheDir, "$key.$ext.part")

        sabrSessions[key]?.let { existing ->
            if (existing.error == null) return existing
        }

        val session = SabrCacheSession(finalFile, partFile, mime)
        if (finalFile.exists() && finalFile.length() > 0) {
            session.bytesWritten = finalFile.length()
            session.finished = true
            session.firstChunkReady.complete(Unit)
            session.completed.complete(true)
            sabrSessions[key] = session
            return session
        }

        val prev = sabrSessions.putIfAbsent(key, session)
        if (prev != null && prev.error == null) return prev
        sabrSessions[key] = session

        scope.launch {
            try {
                if (partFile.exists()) partFile.delete()
                FileOutputStream(partFile).use { out ->
                    SabrAudioStream(httpClient, bootstrap).bytes().collect { chunk ->
                        if (chunk.isNotEmpty()) {
                            out.write(chunk)
                            out.flush()
                            session.bytesWritten += chunk.size
                            if (!session.firstChunkReady.isCompleted) {
                                session.firstChunkReady.complete(Unit)
                            }
                        }
                    }
                }
                if (partFile.exists() && partFile.length() > 0) {
                    if (finalFile.exists()) finalFile.delete()
                    partFile.renameTo(finalFile)
                    session.finished = true
                    session.firstChunkReady.complete(Unit)
                    session.completed.complete(true)
                    println("[InnerTubeX] SABR cached $key (${finalFile.length()} bytes)")
                } else {
                    throw IllegalStateException("SABR stream produced 0 bytes")
                }
            } catch (e: Exception) {
                println("[InnerTubeX] SABR download failed for $key: ${e.message}")
                session.error = e
                session.firstChunkReady.completeExceptionally(e)
                session.completed.complete(false)
                sabrSessions.remove(key, session)
                runCatching { partFile.delete() }
            }
        }
        return session
    }

    suspend fun downloadToFile(videoId: String, destDir: File, onProgress: (Int) -> Unit): File? {
        val stream = resolveStream(videoId, "high") ?: return null
        val mime = stream.mimeType ?: "audio/mp4"
        val ext = if (mime.contains("webm", ignoreCase = true)) "webm" else "m4a"
        val destFile = File(destDir, "$videoId.$ext")

        if (stream.sabrBootstrap != null) {
            val session = getOrStartSabrCache(videoId, "high", stream)
            val expectedTotal = stream.contentLengthBytes ?: 3_500_000L
            while (!session.completed.isCompleted) {
                val pct = ((session.bytesWritten.toDouble() / expectedTotal) * 95).toInt().coerceIn(5, 95)
                onProgress(pct)
                withTimeoutOrNull(250) { session.completed.await() }
            }
            val ok = session.completed.await()
            if (ok && session.file.exists()) {
                session.file.copyTo(destFile, overwrite = true)
                onProgress(100)
                return destFile
            }
            return null
        } else {
            val url = java.net.URL(stream.audioUrl)
            val conn = url.openConnection() as java.net.HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            stream.headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            val total = conn.contentLengthLong.takeIf { it > 0 } ?: stream.contentLengthBytes ?: -1L
            conn.inputStream.use { input ->
                FileOutputStream(destFile).use { output ->
                    val buf = ByteArray(16384)
                    var read: Int
                    var downloaded = 0L
                    while (input.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                        downloaded += read
                        if (total > 0) {
                            onProgress(((downloaded.toDouble() / total) * 100).toInt().coerceIn(0, 100))
                        } else {
                            onProgress(50)
                        }
                    }
                }
            }
            onProgress(100)
            return destFile
        }
    }

    suspend fun getLyrics(
        videoId: String?,
        title: String?,
        artist: String?,
        durationSec: Int?
    ): LyricsResponseDto {
        // 1. Try LRCLIB first for clean synced LRC lyrics
        if (!title.isNullOrBlank()) {
            try {
                val lrc = fetchFromLrcLib(title, artist, durationSec)
                if (lrc != null) return lrc
            } catch (e: Exception) {
                println("[Lyrics] LRCLIB failed: ${e.message}")
            }
        }

        // 2. Fallback to YouTube Music transcript cues / captions
        if (!videoId.isNullOrBlank()) {
            try {
                val cues = innerTube.transcriptCues(YouTubeClient.WEB, videoId)
                if (cues.isNotEmpty()) {
                    return LyricsResponseDto(
                        synced = true,
                        lines = cues.map { LyricLineDto(it.startMs, it.text) },
                        plain = cues.joinToString("\n") { it.text },
                        source = "YouTube Captions"
                    )
                }
            } catch (_: Exception) {
            }
        }

        return LyricsResponseDto(synced = false, lines = emptyList(), plain = null, source = null)
    }

    private suspend fun fetchFromLrcLib(title: String, artist: String?, durationSec: Int?): LyricsResponseDto? {
        val cleanTitle = title.replace(Regex("\\s*[\\(\\[]?(Official|Lyrics|Audio|Video|HD|4K|Remix|feat\\..*?)[\\)\\]]?", RegexOption.IGNORE_CASE), "").trim()
        val cleanArtist = artist?.split(",", "&", "•")?.firstOrNull()?.trim().orEmpty()

        // Try direct get if we have title + artist
        if (cleanArtist.isNotBlank()) {
            val res = httpClient.get("https://lrclib.net/api/get") {
                parameter("track_name", cleanTitle)
                parameter("artist_name", cleanArtist)
                if (durationSec != null && durationSec > 0) parameter("duration", durationSec)
                header(HttpHeaders.UserAgent, "Metrolist-Desktop/14.0.0")
            }
            if (res.status.isSuccess()) {
                val obj = json.parseToJsonElement(res.bodyAsText()).jsonObject
                parseLrcLibObject(obj)?.let { return it }
            }
        }

        // Fallback to LRCLIB search
        val query = listOf(cleanTitle, cleanArtist).filter { it.isNotBlank() }.joinToString(" ")
        val searchRes = httpClient.get("https://lrclib.net/api/search") {
            parameter("q", query)
            header(HttpHeaders.UserAgent, "Metrolist-Desktop/14.0.0")
        }
        if (searchRes.status.isSuccess()) {
            val arr = json.parseToJsonElement(searchRes.bodyAsText()).jsonArray
            val best = arr.firstOrNull { el ->
                !el.jsonObject["syncedLyrics"]?.jsonPrimitive?.contentOrNull.isNullOrBlank()
            } ?: arr.firstOrNull()
            if (best != null) {
                parseLrcLibObject(best.jsonObject)?.let { return it }
            }
        }
        return null
    }

    private fun parseLrcLibObject(obj: JsonObject): LyricsResponseDto? {
        val syncedRaw = obj["syncedLyrics"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
        val plainRaw = obj["plainLyrics"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }

        if (syncedRaw != null) {
            val lines = parseLrc(syncedRaw)
            if (lines.isNotEmpty()) {
                return LyricsResponseDto(
                    synced = true,
                    lines = lines,
                    plain = plainRaw ?: lines.joinToString("\n") { it.text },
                    source = "LRCLIB"
                )
            }
        }
        if (plainRaw != null) {
            val lines = plainRaw.lines().filter { it.isNotBlank() }.mapIndexed { idx, line ->
                LyricLineDto(timeMs = idx * 1000L, text = line.trim())
            }
            return LyricsResponseDto(
                synced = false,
                lines = lines,
                plain = plainRaw,
                source = "LRCLIB"
            )
        }
        return null
    }

    private fun parseLrc(lrc: String): List<LyricLineDto> {
        val regex = Regex("\\[(\\d{1,2}):(\\d{2})(?:\\.(\\d{1,3}))?\\](.*)")
        return lrc.lines().mapNotNull { line ->
            val match = regex.find(line.trim()) ?: return@mapNotNull null
            val min = match.groupValues[1].toLongOrNull() ?: 0L
            val sec = match.groupValues[2].toLongOrNull() ?: 0L
            val fracStr = match.groupValues[3]
            val ms = when (fracStr.length) {
                0 -> 0L
                1 -> (fracStr.toLongOrNull() ?: 0L) * 100
                2 -> (fracStr.toLongOrNull() ?: 0L) * 10
                else -> fracStr.take(3).toLongOrNull() ?: 0L
            }
            val text = match.groupValues[4].trim()
            if (text.isBlank()) return@mapNotNull null
            LyricLineDto(timeMs = (min * 60 + sec) * 1000 + ms, text = text)
        }.sortedBy { it.timeMs }
    }
}
