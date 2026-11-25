# Metrolist Desktop App

A desktop & web YouTube Music client built with **Electron**, **React + Vite**, and a local **Kotlin / Ktor** backend powered by **InnerTubeX (`v0.13.1`)**.

## Features (v14.0.0)
- **Resilient Audio Streaming (`InnerTubeX v0.13.1`)**: Multi-client resolution with SABR & direct HTTP Range streaming, offline downloads, and `ResilientDns` (system DNS retry + Cloudflare/Google DoH fallback + automatic SABR fallback).
- **Audio Engine & DSP**: 10-band Web Audio equalizer with presets & frequency curve preview, playback speed controls, crossfade, real-time 60fps spectrum visualizer, Sleep Timer, and OS MediaSession controls.
- **Immersive Now Playing & Synced Lyrics**: Fullscreen player with dynamic album-art ambient backdrop and click-to-seek synced lyrics (LRCLIB + YouTube captions).
- **Discovery & Library**: Home mood filter chips, category-filtered Search v2 (`Songs`, `Videos`, `Albums`, `Playlists`, `Artists`), Artist pages, Speed Dial shortcuts, persistent SQLite library (`~/.metrolist/metrolist.db`), custom playlists, and endless autoplay queue.

## Quick Start

Inside [`metrolist-web/`](./metrolist-web):

```bash
# 1. Install frontend/Electron dependencies
npm install

# 2. Build the Kotlin backend fat JAR (requires JDK 25)
cd backend
./gradlew shadowJar
cd ..

# 3. Run in development (Vite + Electron + Kotlin backend)
npm run electron:dev

# 4. Build Windows NSIS installer
npm run electron:build:win
```
