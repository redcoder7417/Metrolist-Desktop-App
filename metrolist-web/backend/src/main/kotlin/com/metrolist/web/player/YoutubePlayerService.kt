package com.metrolist.web.player

import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import java.net.HttpURLConnection
import java.net.URL

object YoutubePlayerService {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun player(videoId: String, poToken: String? = null, visitorData: String? = null, signatureTimestamp: Int? = null): com.metrolist.innertube.models.response.PlayerResponse {
        val requestBody = PlayerRequest(
            context = Context(
                client = Client(
                    clientName = "WEB_REMIX",
                    clientVersion = "1.20260114.03.00",
                    visitorData = visitorData
                )
            ),
            videoId = videoId,
            serviceIntegrityDimensions = poToken?.let { ServiceIntegrityDimensions(it) },
            playbackContext = signatureTimestamp?.let {
                PlaybackContext(ContentPlaybackContext(it))
            }
        )

        val bodyString = json.encodeToString(requestBody)

        val url = URL("https://music.youtube.com/youtubei/v1/player")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.3")
        conn.setRequestProperty("X-Goog-Api-Format-Version", "1")
        conn.setRequestProperty("X-YouTube-Client-Name", "67")
        conn.setRequestProperty("X-YouTube-Client-Version", "1.20260114.03.00")
        conn.setRequestProperty("X-Origin", "https://music.youtube.com")
        conn.setRequestProperty("Origin", "https://music.youtube.com")
        conn.setRequestProperty("Referer", "https://music.youtube.com/")
        visitorData?.let { conn.setRequestProperty("X-Goog-Visitor-Id", it) }
        
        conn.doOutput = true
        
        conn.outputStream.bufferedWriter().use {
            it.write(bodyString)
        }

        val responseCode = conn.responseCode
        if (responseCode == 200) {
            val responseText = conn.inputStream.bufferedReader().use { it.readText() }
            return json.decodeFromString(com.metrolist.innertube.models.response.PlayerResponse.serializer(), responseText)
        } else {
            val errorText = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
            throw Exception("Failed with code $responseCode: $errorText")
        }
    }
}
