import org.gradle.api.file.DuplicatesStrategy
import org.gradle.api.tasks.AbstractCopyTask

plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.serialization") version "2.4.21"
    application
    id("com.gradleup.shadow") version "8.3.0"
}

group = "com.metrolist.web"
version = "14.0.0"
project.ext.set("mainClassName", "com.metrolist.web.ApplicationKt")

repositories {
    google()
    mavenCentral()
    maven("https://jitpack.io")
}

kotlin {
    jvmToolchain(25)
}


dependencies {
    val ktorVersion = "3.6.1"
    implementation("io.ktor:ktor-server-core-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-netty-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-cors-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-core-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-okhttp-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-encoding-jvm:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:$ktorVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.13.0")
    implementation("com.github.MetrolistGroup.innertubex:innertubex:v0.13.1")
    implementation("com.github.MetrolistGroup:MetrolistExtractor:3cd3341") {
        exclude(group = "com.google.protobuf")
    }
    implementation("org.brotli:dec:0.1.2")
    implementation("org.json:json:20240303")
    
    val exposedVersion = "0.49.0"
    implementation("org.jetbrains.exposed:exposed-core:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-dao:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-jdbc:$exposedVersion")
    implementation("org.jetbrains.exposed:exposed-java-time:$exposedVersion")
    implementation("org.xerial:sqlite-jdbc:3.45.2.0")
}

application {
    mainClass.set("com.metrolist.web.ApplicationKt")
}

tasks.withType<AbstractCopyTask>().configureEach {
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
}
