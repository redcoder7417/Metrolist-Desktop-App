package com.metrolist.web.db

import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import java.io.File

object DatabaseFactory {
    fun init() {
        val dataDir = File(System.getProperty("user.home"), ".metrolist").apply {
            if (!exists()) mkdirs()
        }
        val dbFile = File(dataDir, "metrolist.db")
        Database.connect("jdbc:sqlite:${dbFile.absolutePath}", driver = "org.sqlite.JDBC")

        transaction {
            SchemaUtils.createMissingTablesAndColumns(
                Songs,
                Artists,
                Albums,
                Playlists,
                PlaylistSongMaps,
                SongArtistMaps,
            )
        }
    }
}
