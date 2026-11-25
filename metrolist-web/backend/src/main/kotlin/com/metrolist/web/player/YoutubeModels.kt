package com.metrolist.web.player

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PlayerResponse(
    @SerialName("playabilityStatus")
    val playabilityStatus: PlayabilityStatus? = null,

    @SerialName("streamingData")
    val streamingData: StreamingData? = null,

    @SerialName("videoDetails")
    val videoDetails: VideoDetails? = null
)

@Serializable
data class PlayabilityStatus(
    val status: String? = null,
    val reason: String? = null
)

@Serializable
data class StreamingData(
    val formats: List<Format> = emptyList(),
    val adaptiveFormats: List<Format> = emptyList()
)

@Serializable
data class Format(
    val itag: Int? = null,
    val mimeType: String? = null,
    val bitrate: Int? = null,
    val url: String? = null,
    val signatureCipher: String? = null
)

@Serializable
data class VideoDetails(
    val title: String? = null,
    val videoId: String? = null
)