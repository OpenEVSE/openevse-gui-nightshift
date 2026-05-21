# OpenEVSE GUI v3 — Foundation & Primary Screens

**Date:** 2026-05-21
**Status:** Approved design
**Repo:** `/home/rar/openevse-gui-v3`

## Summary

v3 is a ground-up replacement for the OpenEVSE WiFi module's web UI. v2
(`/home/rar/openevse-gui-v2`) works but its presentation layer is dated. v3 keeps
v2's hard-won domain logic — the stores, WebSocket data layer, version-counter
refresh pattern, and the EVSE claims/priority system — and replaces everything
visual with a modern, brand-aligned interface.

v3 must run in the same confines as v2: a static SPA, gzip-compressed, served from
the device's embedded web server out of flash, talking to the same HTTP + WebSocket
API. No backend changes.

This spec covers the **foundation plus the four primary screens**. The 17
Configuration sub-pages and the setup Wizard are deferred to later specs.

## Goals

- A modern, attractive UI that derives its identity from the OpenEVSE brand.
- Reuse v2's correct domain layer rather than reinventing it.
- Dark and light themes, brand-aligned, with the dark theme as the garage-friendly
  default.
- Mobile-first, responsive up to tablet/desktop.
- Internationalization built in from day one (English catalog shipped).
- Same deployment envelope as v2 — static, compressed, flash-served, offline.

## Non-Goals (deferred to later specs)

- The 17 Configuration sub-pages (RFID, MQTT, OCPP, Network, Firmware, etc.).
- The setup Wizard.
- Translating the string catalog into fr/es/hu/pl. The i18n machinery and the
  English catalog **are** in scope; the other languages are not.
- Any change to the device firmware or its API.

## Stack & Build

- **Framework:** Svelte 5 + Vite.
- **Styling:** Tailwind CSS, configured against semantic CSS-variable theme tokens.
- **i18n:** `svelte-i18n`.
- **Output:** a static SPA. No SSR. The build produces plain gzipped files the
  device's embedded web server serves directly from flash.

### Carried over from v2's build

These exist because of the hardware constraints and are kept:

- `base: './'` — relative asset paths.
- `vite-plugin-pwa` — `autoUpdate` + `selfDestroying` service worker; PWA
  installable; icons regenerated from the new keyhole gear mark.
- `vite-plugin-compression` — gzip with `deleteOriginFile` (the device serves
  `.gz` files directly).
- `manualChunks` — vendor/route chunk splitting to keep individual chunks small
  for flash.
- Dev proxy: `/api`, `/ws`, `/debug`, `/evse` → `VITE_OPENEVSEHOST`
  (default `openevse.local`), set in `.env`.
- A **bundled icon subset** — no icon CDN, because the device is offline.

### Deliberate change from v2

v2 fetches the Roboto font from Google Fonts at runtime. The device is offline, so
v3 uses a **system font stack** — no external fetch, faster first paint, no failed
request when the charger has no internet.

### Routing

Hash-based routing. The device has no SPA-fallback configuration, so hash routing
is required. Use `svelte-spa-router` if it is Svelte-5-clean; otherwise a minimal
(~30-line) hash router — functionally identical. Decided at implementation time.

## Data Layer

v2's domain layer is correct and is **ported with behavior unchanged**, not
rewritten.

### Ported as-is

- `httpAPI` fetch client.
- `serialQueue` — serializes all device calls. The device's web server is
  single-threaded and fails on concurrent requests, so every store download runs
  through this queue.
- `EvseClients` — the claims/priority table (manual, divert, boost, timer, rfid,
  ocpp, etc.).
- `utils.js` helpers.
- Domain stores: `status`, `config`, `schedule`, `plan`, `override`, `limit`,
  `claims_target`, `history`, `uistates`, `uisettings`. The `certificates` store
  is also ported (loaded at startup) but has no screen yet — it supports later
  Configuration work.
- The three data components:
  - **WebSocket** — opens the WS connection, merges live status messages into the
    `status` store, ping/pong keepalive, auto-reconnect.
  - **FetchData** — initial bulk download of all stores behind the startup loader,
    then sets the `data_loaded` flag.
  - **DataManager** — the version-counter refresh pattern: the device bumps a
    `*_version` field inside `status`, and only the store whose version changed is
    re-downloaded.

### Svelte 4 → 5 adaptation

- Domain stores stay as **store factories** (`writable` + custom methods). Svelte
  stores are fully supported in Svelte 5, so this is a safe, low-risk port.
- Component-local state uses runes (`$state` / `$derived`).
- `DataManager`'s `$:` reactive blocks become `$effect`.
- *Alternative considered and rejected:* rewriting stores as rune-based classes —
  more idiomatic Svelte 5, but pure churn with no behavior gain and added port
  risk.

Each store is a self-contained unit exposing `subscribe` plus `download` /
`upload` methods. UI components consume that public interface and never reach
into store internals.

## Design System

### Theme tokens

Components reference **semantic CSS variables**, never raw hex:

- `--surface`, `--surface-raised`, `--text`, `--text-dim`, `--accent`, `--border`,
  and semantic status colors (charging / idle / error / warning).

Dark and light themes are two sets of values for those variables. Switching theme
swaps a single `data-theme` attribute on the root element. Tailwind is configured
so its color utilities map onto these variables.

### Palette (derived from the OpenEVSE gear)

- **Accent:** `#3cc6bd` (dark theme, rendered with a soft glow) / `#0f9b98`
  (light theme).
- **Dark surfaces:** `#0c0e13` → `#10141c` → `#161b26` → `#1c2230`.
- **Light surfaces:** `#ffffff` → `#eef4f3` → `#dde7e6`.

### Theme store

`lib/theme/` holds a theme store that:

- Defaults to the OS `prefers-color-scheme`.
- Exposes a manual override toggle in the UI.
- Persists the override in `uisettings` (localStorage).
- Live-reacts to OS preference changes while no manual override is set.

### Brand assets

The softened OpenEVSE keyhole gear — an 8-tooth gear with rounded teeth and a
classic old-fashioned lock keyhole (round bore + flared, flat-bottomed slot),
flat with no bevel/gloss. Delivered as a single SVG, fillable via `currentColor`
so it themes automatically. PWA and favicon icons are regenerated from it.

### UI primitives

`lib/components/ui/` — each independently testable: `Button`, `IconButton`,
`Card`, `StatChip`, `ProgressRing`, `ProgressBar`, `Toggle`, `Slider`, `Select`,
`Modal`, `AlertBox`, `Tabs`, `Loader`.

## App Shell

`lib/components/shell/`:

- **Header** — keyhole gear mark + device name + a live connection-status dot.
- **BottomNav** — fixed 4-tab bar: Home · Schedule · Monitoring · History.
  Mobile-first; at tablet/desktop widths it promotes to a side rail.
- **Startup** — the FetchData loader (gear + progress bar) shows until stores are
  loaded, then the shell renders.
- **Global banners** — connection-lost, EVSE-not-connected, and device-error
  states surface as dismissible banners (behavior ported from v2's `App.svelte`),
  alongside the global `AlertBox` modal.

## Primary Screens

All four read live data through the ported data layer. No screen talks to the
device directly; they consume stores.

### Dashboard

The core screen.

- Power ring — live charge power.
- Stat chips — energy, elapsed, current, voltage, temperature.
- Charge state label.
- Primary Start/Stop action.
- Charge-mode selector — Auto / Manual-on / Manual-off, driven by the
  `claims_target` priority system.
- Charge-limit indicator with override entry.

### Schedule

- List of charge timers (day/time, target, enabled state).
- Add/edit a timer in a modal.
- Enable/disable toggles.
- Backed by the `schedule` and `plan` stores.

### Monitoring

- Live data view.
- Energy manager — solar / divert / grid balance.
- Safety monitoring.
- Backed by the `status` store (live WebSocket data).

### History

- Charge-session log list.
- Per-session detail.
- Backed by the `history` store.

## Error Handling

Behavior ported from v2:

- `httpAPI` failures → store `download()` returns `false`. At startup, FetchData
  shows a reconnect dialog. In-app, a failed refresh surfaces a banner — it does
  not crash the UI.
- WebSocket drop → auto-reconnect with ping/pong keepalive; a "connection lost"
  banner shows while the socket is down.
- Device error-state codes → an error banner with a decoded description.
- "EVSE not connected" → a dedicated banner.

## Testing

- **Tooling:** Vitest + jsdom + `@testing-library/svelte` (Svelte 5 versions).
- **Domain logic** — stores, `utils`, `queue`, theme store — gets unit tests,
  porting v2's existing tests where the logic is ported.
- **UI** — key primitives and each of the four screens get component tests.
- **Coverage** scoped to `src/lib`, mirroring v2.

## Project Structure

```
src/
  App.svelte, main.js
  app.css                  Tailwind entry + theme tokens
  lib/
    api/        httpAPI client
    stores/     domain stores (status, config, schedule, ...)
    data/       WebSocket, FetchData, DataManager
    theme/      theme store (OS preference + manual override)
    i18n/       svelte-i18n setup + en catalog
    components/
      ui/       primitives (Button, Card, ProgressRing, Toggle, Slider, Modal, ...)
      shell/    AppShell, Header, BottomNav, connection banners
    icons/      bundled icon subset
    queue.js, vars.js, utils.js, routes.js
  routes/       Dashboard, Schedule, Monitoring, History, NotFound
  assets/       keyhole-gear SVG, PWA icons
```

## Open Questions

None. All design decisions for this spec are resolved.
