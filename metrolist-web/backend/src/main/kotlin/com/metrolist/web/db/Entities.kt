package com.metrolist.web.db

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.datetime

object Songs : Table() {
    val id = varchar("id", 50)
    val title = varchar("title", 255)
    val artist = varchar("artist", 255).nullable()
    val duration = integer("duration").default(-1)
    val thumbnailUrl = varchar("thumbnailUrl", 255).nullable()
    val albumId = varchar("albumId", 50).nullable()
    val albumName = varchar("albumName", 255).nullable()
    val explicit = bool("explicit").default(false)
    val year = integer("year").nullable()
    val date = datetime("date").nullable()
    val liked = bool("liked").default(false)
    val likedDate = datetime("likedDate").nullable()
    val totalPlayTime = long("totalPlayTime").default(0L)
    val inLibrary = datetime("inLibrary").nullable()
    val isLocal = bool("isLocal").default(false)
    val playbackPosition = long("playbackPosition").nullable()
    
    override val primaryKey = PrimaryKey(id)
}

object Artists : Table() {
    val id = varchar("id", 50)
    val name = varchar("name", 255)
    val thumbnailUrl = varchar("thumbnailUrl", 255).nullable()
    
    override val primaryKey = PrimaryKey(id)
}

object Albums : Table() {
    val id = varchar("id", 50)
    val title = varchar("title", 255)
    val year = integer("year").nullable()
    val thumbnailUrl = varchar("thumbnailUrl", 255).nullable()
    val authorsText = varchar("authorsText", 255).nullable()
    
    override val primaryKey = PrimaryKey(id)
}

object Playlists : Table() {
    val id = varchar("id", 50)
    val name = varchar("name", 255)
    val browseId = varchar("browseId", 50).nullable()
    val playEndpoint = varchar("playEndpoint", 255).nullable()
    val inLibrary = datetime("inLibrary").nullable()
    
    override val primaryKey = PrimaryKey(id)
}

object PlaylistSongMaps : Table() {
    val playlistId = varchar("playlistId", 50).references(Playlists.id)
    val songId = varchar("songId", 50).references(Songs.id)
    val position = integer("position")
    
    override val primaryKey = PrimaryKey(playlistId, songId)
}

object SongArtistMaps : Table() {
    val songId = varchar("songId", 50).references(Songs.id)
    val artistId = varchar("artistId", 50).references(Artists.id)
    
    override val primaryKey = PrimaryKey(songId, artistId)
}
