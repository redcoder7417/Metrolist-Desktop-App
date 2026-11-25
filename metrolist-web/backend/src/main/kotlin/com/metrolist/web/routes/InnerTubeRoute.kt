package com.metrolist.web.routes

import com.metrolist.innertube.YouTube
import com.metrolist.innertube.models.WatchEndpoint
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route

fun Route.innerTubeRoutes() {
    route("/api/innertube") {
        get("/album/{browseId}") {
            val browseId = call.parameters["browseId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
            val result = YouTube.album(browseId).getOrElse {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (it.message ?: "Unknown error")))
                return@get
            }
            call.respond(result)
        }

        get("/artist/{browseId}") {
            val browseId = call.parameters["browseId"] ?: return@get call.respond(HttpStatusCode.BadRequest)
            val result = YouTube.artist(browseId).getOrElse {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (it.message ?: "Unknown error")))
                return@get
            }
            call.respond(result)
        }

        get("/search") {
            val query = call.request.queryParameters["q"] ?: return@get call.respond(HttpStatusCode.BadRequest)
            val filter = call.request.queryParameters["filter"]
            
            if (filter != null) {
                val searchFilter = YouTube.SearchFilter(filter)
                val result = YouTube.search(query, searchFilter).getOrElse {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (it.message ?: "Unknown error")))
                    return@get
                }
                call.respond(result)
            } else {
                val result = YouTube.searchSummary(query).getOrElse {
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (it.message ?: "Unknown error")))
                    return@get
                }
                call.respond(result)
            }
        }
    }
}
