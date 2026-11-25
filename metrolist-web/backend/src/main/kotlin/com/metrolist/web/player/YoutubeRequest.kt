package com.metrolist.web.player

import kotlinx.serialization.Serializable

@Serializable
data class PlayerRequest(
    val context: Context,
    val videoId: String,
    val serviceIntegrityDimensions: ServiceIntegrityDimensions? = null,
    val contentCheckOk: Boolean = true,
    val racyCheckOk: Boolean = true,
    val playbackContext: PlaybackContext? = null
)

@Serializable
data class PlaybackContext(
    val contentPlaybackContext: ContentPlaybackContext
)

@Serializable
data class ContentPlaybackContext(
    val signatureTimestamp: Int
)

@Serializable
data class Context(
    val client: Client
)

@Serializable
data class Client(
    val clientName: String,
    val clientVersion: String,
    val visitorData: String? = null,
    val gl: String = "US",
    val hl: String = "en"
)

@Serializable
data class ServiceIntegrityDimensions(
    val poToken: String
)