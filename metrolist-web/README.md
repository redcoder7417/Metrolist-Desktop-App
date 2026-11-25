# Metrolist Desktop & Web (v14.0.0)

A YouTube Music desktop & web client aligned with [MetrolistGroup/Metrolist](https://github.com/MetrolistGroup/Metrolist) and powered by [MetrolistGroup/innertubex](https://github.com/MetrolistGroup/innertubex) (`v0.13.1`).

## Prerequisites
- **Node.js** `18+` (tested on `v25.9.0`)
- **Java (JDK/JRE)** `25+`

## Commands
- `npm run dev` — Start Vite frontend dev server on `http://localhost:5173`.
- `npm run electron:dev` — Launch Electron desktop app with Vite and live Kotlin/Ktor backend on port `8091`.
- `npm run build` — Build frontend bundle to `dist/`.
- `cd backend && ./gradlew shadowJar` — Build `backend/build/libs/metrolist-web-backend-14.0.0-all.jar`.
- `npm run electron:build:win` — Build frontend and package Windows NSIS installer (`release-new/v14.0.0/`).
