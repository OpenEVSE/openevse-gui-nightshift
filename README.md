# OpenEVSE GUI v3

Replacement web UI for the OpenEVSE WiFi module. Svelte 5 + Vite + Tailwind.

## Develop

Set `VITE_OPENEVSEHOST` in `.env` (copy from `.env.example`; default `openevse.local`).

    npm install
    npm run dev

## Build

    npm run build      # static, gzipped output in dist/ for the device

## Test

    npm test           # run once
    npm run test:watch
    npm run test:coverage

## Status

Foundation + app shell complete. Primary screens (Dashboard, Schedule,
Monitoring, History) and Configuration are tracked in
`docs/superpowers/`.
