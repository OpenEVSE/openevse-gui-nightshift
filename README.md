# OpenEVSE GUI v3

Replacement web UI for the OpenEVSE WiFi module. Svelte 5 + Vite + Tailwind.

## Develop

Set `VITE_OPENEVSEHOST` in `.env` (copy from `.env.example`; default `openevse.local`).

    npm install
    npm run dev

### Mock mode (no hardware needed)

To view the full UI locally without a real OpenEVSE device, run:

    npm run dev:mock

This starts Vite in `mock` mode. A built-in plugin intercepts all `/api/*`
HTTP requests with canned fixture data and serves a mock `/ws` WebSocket that
sends live-looking status updates every 2 seconds. No `VITE_OPENEVSEHOST` is
required and no proxy is configured — the mock handles everything.

Fixture files live in `dev/fixtures/` and can be edited to simulate different
device states (e.g. change `state` to `1` for standby, or adjust `amp` /
`wattpower` for different charging scenarios).

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
