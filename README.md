# openevse-gui-nightshift

A replacement web UI for the [OpenEVSE](https://www.openevse.com/) WiFi module —
a from-scratch rewrite built with **Svelte 5, Vite 8 and Tailwind 4**.

The app is a pure client of the OpenEVSE device's HTTP + WebSocket API; it has no
backend of its own. The production build is a small, gzipped static bundle intended
to be flashed onto the WiFi module and served from its embedded web server.

## Features

- **Dashboard** — live charge state, power ring, session stats, charge mode
  (Auto / On / Off), charge-rate and charge-limit controls.
- **Schedule** — recurring charge timers.
- **Monitoring** — live energy, sensor, service and vehicle metrics.
- **History** — the device event log.
- **Settings** — a hub plus 17 configuration pages: Network (incl. WiFi scan/join),
  HTTP, MQTT, OCPP, EVSE, Safety, Time, RFID, Vehicle (incl. Tesla login),
  Self-production, Load Shaper, EmonCMS, OhmConnect, Firmware (incl. GitHub online
  updates), Certificates, Terminal and About.
- **Four languages** — English, Spanish, French, Hungarian; the locale follows the
  browser and can be changed in Settings → HTTP.

## Requirements

- Node.js 20+ and npm.

## Quick start

```bash
npm install
npm run dev:mock      # run the UI offline against built-in mock data
```

Open the printed URL — no hardware required.

## Develop

### Against a real device

Point the dev server at a charger by setting `VITE_OPENEVSEHOST` in a `.env` file
(copy `.env.example`; default `openevse.local`):

```bash
cp .env.example .env        # then edit VITE_OPENEVSEHOST, e.g. 10.75.1.144
npm install
npm run dev
```

Vite proxies `/api`, `/ws`, `/debug` and `/evse` to that host, so the dev UI talks
to live hardware.

### Mock mode (no hardware needed)

```bash
npm run dev:mock
```

This starts Vite in `mock` mode. A built-in plugin intercepts every `/api/*` request
with canned fixture data and serves a mock `/ws` WebSocket that pushes live-looking
status updates every 2 seconds. No `VITE_OPENEVSEHOST` and no proxy are needed.

Fixture files live in `dev/fixtures/` and can be edited to simulate different device
states (e.g. set `state` in `status.json` to `1` for standby or `3` for charging).
Note: the mock serves reads only — it does not accept config writes, so Settings-page
saves report a write error in mock mode. They work against a real device.

## Build

```bash
npm run build         # static, gzipped output in dist/ — ready to flash
npm run preview       # serve the production build locally
```

## Test

```bash
npm test              # run the full suite once
npm run test:watch    # re-run on change
npm run test:coverage # with a coverage report
```

Tests use Vitest and `@testing-library/svelte`. Coverage is scoped to the pure logic
in `src/lib/**/*.js`.

## Project layout

```
src/
  routes/            page components (one per screen); routes/settings/ = config pages
  lib/
    components/      ui/ (primitives), config/, plus per-screen component folders
    stores/          Svelte stores — the device API client layer
    config/          pure config-page logic (validators, helpers) — unit-tested
    data/            WebSocket / FetchData / DataManager — the live data layer
    i18n/            en / es / fr / hu translation files
    routes.js        the exact-match route table
dev/
  mock-plugin.js     the mock-mode Vite plugin
  fixtures/          canned device responses for mock mode
docs/superpowers/    design specs and implementation plans
```

Architecture in brief: the route component is the only store-aware unit; pure logic
lives in `src/lib/` modules and is unit-tested; device writes are serialised through a
single queue (the device's web server is single-threaded).

Other scripts: `npm run icons` regenerates the PWA icon set.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
