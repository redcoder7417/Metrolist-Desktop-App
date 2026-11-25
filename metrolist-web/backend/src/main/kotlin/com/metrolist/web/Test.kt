package com.metrolist.web

import com.metrolist.web.player.InnerTubeXStreamService
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    for (videoId in listOf("jNQXAC9IVRw", "dQw4w9WgXcQ")) {
        val stream = InnerTubeXStreamService.resolveStream(videoId, "high")
        println("=== $videoId ===")
        println("Client: ${stream?.clientName} (${stream?.profileId})")
        println("Mime: ${stream?.mimeType}, Itag: ${stream?.itag}, Bitrate: ${stream?.bitrate}")
        println("SABR: ${stream?.sabrBootstrap != null}, Url: ${stream?.audioUrl?.take(80)}")
    }
}
