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

## Screenshots

Running against a real OpenEVSE charger. The UI ships light and dark themes —
toggle from the header.

<table>
  <tr>
    <td width="33%"><img src="docs/images/IMG_1092.PNG" alt="Dashboard during a charging session" width="260"><br><sub>Dashboard — live session</sub></td>
    <td width="33%"><img src="docs/images/IMG_1085.JPG" alt="Dashboard in the light theme" width="260"><br><sub>Dashboard — light theme</sub></td>
    <td width="33%"><img src="docs/images/IMG_1081.PNG" alt="Charger fault shown on the power ring" width="260"><br><sub>Charger fault state</sub></td>
  </tr>
  <tr>
    <td width="33%"><img src="docs/images/IMG_1087.JPG" alt="Monitoring safety counters" width="260"><br><sub>Monitoring — safety</sub></td>
    <td width="33%"><img src="docs/images/IMG_1073.JPG" alt="Event history list" width="260"><br><sub>Event history</sub></td>
    <td width="33%"><img src="docs/images/IMG_1075.JPG" alt="Charger settings page" width="260"><br><sub>Settings — charger</sub></td>
  </tr>
</table>

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

### Docker (emulator — no hardware needed)

A `docker-compose.yml` is included that spins up a complete development
environment with no hardware required:

| Service | Container | Host port |
|---------|-----------|-----------|
| Vite dev server (UI) | `node:22-alpine` | [http://localhost:5173](http://localhost:5173) |
| OpenEVSE native firmware | `ghcr.io/openevse/openevse-wifi-native:latest` | [http://localhost:8000](http://localhost:8000) |
| OpenEVSE emulator HTTP UI | `ghcr.io/jeremypoulter/openevse_emulator:latest` | [http://localhost:8080](http://localhost:8080) |

The services start in dependency order — emulator first (waits until its RAPI TCP
port 8023 is healthy), then the native firmware, then the UI (waits until the
firmware HTTP API on port 8000 responds).

```bash
docker compose up
```

Open [http://localhost:5173](http://localhost:5173). Source files are bind-mounted
so edits hot-reload exactly as with the local `npm run dev` workflow.

## Build

```bash
npm run build         # static, gzipped output in dist-full/ — ready to flash
npm run preview       # serve the production build locally
```

## Build targets

- `npm run build` → `dist-full/` — ESP32 image (WebSocket transport + charts).
- `npm run build:juicebox` → `dist-juicebox/` — JuiceBox/LibreTiny image; the
  uplot chart chunk is stripped (`VITE_CHARTS=false`), Monitoring and the
  dashboard session chart are gated off.
- `npm run build:all` → both, then verifies the JuiceBox build shipped no chart chunk.

Both builds are one source tree. Transport (WebSocket vs polling) is chosen at
runtime; feature visibility is data-driven from the device's `/config` and
endpoint responses. The only build-time difference is the chart chunk.

This UI supersedes `openevse-gui-lite`, which is retired. Firmware dependencies
(separate slice): the JuiceBox firmware must accept `POST /config` JSON and embed
`dist-juicebox/`.

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
