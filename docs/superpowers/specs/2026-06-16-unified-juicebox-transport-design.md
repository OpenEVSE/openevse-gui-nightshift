# Unified UI for ESP32 + JuiceBox — Transport & Capability Gating Design

**Date:** 2026-06-16
**Status:** Approved (brainstorming) — ready for implementation plan

## Goal

Make nightshift the single web UI that runs on **both** OpenEVSE hardware targets —
the ESP32 (WebSocket push) and the JuiceBox / LibreTiny port (HTTP polling) — by
selecting the data transport automatically at runtime and hiding features the
device doesn't support based on what it reports. Retire the separate
`openevse-gui-lite` fork.

## Motivation

The lite fork existed for one reason: the JuiceBox flash was assumed too small for
the full UI. That assumption was wrong. Full nightshift first-load is ~143 KB
gzipped against a **960 KB OTA slot**; lite uses ~3%. Maintaining a parallel UI
that drifts from nightshift costs more than the bytes it was meant to save.

Three things make consolidation cheap:

1. **`DataManager` is already transport-agnostic.** It watches `status_store.*_version`
   counters via derived stores and re-downloads only the store that changed. It
   does not care whether `status_store` was updated by a WebSocket push or by a
   poll. Only `WebSocket.svelte` is transport-specific; lite's `Poller.svelte` is
   its drop-in sibling.
2. **The `/api` prefix is dev-only.** `httpAPI` only prepends `/api` under
   `import.meta.env.DEV` (the Vite proxy). The flashed bundle already hits bare
   `/status`, `/config`, `/override` — identical to lite and the JuiceBox firmware.
3. **Capability gating is already idiomatic.** `Evse.svelte` gates controls on
   `config?.field !== undefined`, and `pages.js` already has an (unused) `requires`
   predicate. Nightshift is a strict superset of lite — every lite component
   (`PowerRing`, `BoostButton`, `ShaperDivertRow`, `StatusLine`) exists in
   nightshift. Retiring lite loses nothing.

## Scope

**In scope (GUI, this spec):**

1. A transport manager that auto-selects WebSocket vs polling.
2. Data-driven capability gating of settings pages, nav entries, and controls.
3. Converge all writes on `POST` JSON; remove any GET-query write path.
4. Port lite's `Poller.svelte` (and its test) into nightshift's `src/lib/data/`.
5. Two build profiles differing **only** by a `VITE_CHARTS` flag, so the JuiceBox
   profile strips the uplot chunk from flash.

**Out of scope (separate firmware slice — recorded as dependencies):**

- JuiceBox LibreTiny firmware accepting `POST /config` JSON.
- JuiceBox firmware serving the unified `index.html.gz` + AP/provisioning
  (`/scan`, `/connect`, softAP bootstrap).
- Re-embedding the built bundle into firmware (`xxd -i` into `web_ui_lite.h`).

**Unchanged:** `FetchData` (bulk HTTP load), `DataManager` (version-bump reactive
reload), every store, every route component.

## Architecture

### 1. Transport layer

A new `src/lib/data/TransportManager.svelte` replaces the bare `<WebSocket />`
mount in `App.svelte`. Model: **polling is the always-on baseline; a live
WebSocket suppresses it.**

- On mount, start `Poller` **and** attempt the WebSocket connection.
- WS `open` + first real (non-pong) message → pause polling; WS now drives
  `status_store`.
- WS `close`/`error` → resume polling immediately; WS keeps retrying with its
  existing exponential backoff in the background.
- JuiceBox (no `/ws`): the WS connect never succeeds, so polling runs for the
  whole session. No timeout to tune, no flapping.
- ESP32: ~1–2 polls fire during the WS handshake, then polling goes quiet. Both
  paths merge into the same `status_store`, so the overlap is harmless.

`uistates.connected` becomes "either transport reported a good read recently"
(`poll ok || ws_connected`), so the connection dot and reconnect banner behave
identically on both targets.

Rationale: no probe timeout to calibrate; the degraded path (polling) is the
*default*, not a fallback; and it self-heals — a flaky ESP32 WS transparently
drops to polling and back.

`Poller.svelte` is ported verbatim from lite (single in-flight guard, ~1.5 s
interval, merges `GET /status` into `status_store`, sets `uistates.connected`).
It already routes through `httpAPI` and therefore the serial queue.

### 2. Capability gating (data-driven)

The device's own responses are the capability descriptor. No firmware contract,
no central feature table. Three levels:

**a) Settings pages** — activate and populate the existing `requires` predicate in
`src/lib/config/pages.js`. Each hardware-dependent page declares the config field
that proves the feature exists (e.g. `ocpp`, `rfid`, `mqtt`, `solar`, `shaper`,
`emoncms`, `ohmconnect`, `certificates`). Hardware-independent pages (`evse`,
`time`, `network`, `firmware`, `about`) declare no `requires` and always show.

Change the predicate test from **truthiness** to **presence**:
`p.requires in config` instead of `config[p.requires]`. A feature that is present
but *configured off* (value `0`/`false`/`''`) must still show its page; only a
field that is entirely absent hides it.

**b) Bottom nav + routing** — `BottomNav`'s static item list is filtered by the
same capability signals. `History` and `Monitoring` gate on chart-data
availability (see §3); `Home`, `Schedule`, `Settings` always show. The router
redirects a gated route reached by deep link / bookmark to `/`, so a hidden page
cannot be opened by URL.

**c) Individual controls** — already idiomatic
(`{#if config?.field !== undefined}`), extended where the JuiceBox reveals gaps.
No new mechanism.

**Endpoint-presence gating** — for capabilities without a config field (e.g.
History needs `/history`), the backing store's `download()` returning
`error`/`404` records the capability as absent in `uistates`; nav and routes read
that flag. This reuses the existing store-failure path rather than adding probes.

### 3. Chart bundling (two build profiles)

uplot is ~22 KB gzipped (21.3 KB JS + 0.7 KB CSS) and is already isolated into a
`charts` chunk by `vite.config.js` `manualChunks`, but it is statically imported
(`SessionChart` → `UplotChart` → `uplot`) and `SessionChart` is on the Dashboard,
so it loads eagerly today — even on a device that never renders a chart.

Two build profiles, differing by a **single flag**, keep the split minimal:

- Chart-bearing modules (`SessionChart`, `EnergySummaryChart`, `UplotChart`, and
  the `History`/`Monitoring` routes) load via a **build-conditional dynamic
  `import()`** keyed to `import.meta.env.VITE_CHARTS`. Vite substitutes the env
  var with a literal at build time, so when `VITE_CHARTS=false` the branch is
  dead-code-eliminated and Rollup **never emits the uplot chunk**.
- A central helper (e.g. `src/lib/charts/load.js`) exposes the guarded loaders so
  the conditional lives in one place.
- `dist-full/` (default, `VITE_CHARTS` unset/`true`) → ESP32 image, charts
  included.
- `dist-juicebox/` (`VITE_CHARTS=false`) → JuiceBox image, uplot physically
  absent.
- The **runtime** charts-data gate (§2) still applies in *both* builds (defense in
  depth): even the full build hides chart UI when a device reports no chart data.

Everything else — transport probe, gating, writes — is identical across both
profiles and runtime-driven. The build-time divergence is deliberately limited to
charts; do not expand it.

### 4. Write convergence

The GUI uses **only** `POST /config` and `POST`/`DELETE`/`PATCH /override` with
JSON bodies (nightshift's current idiom). No GET-query write path is added;
nothing per-device branches in `httpAPI` or the stores. Reads
(`GET /status|/config|/override`) already match across both firmwares.

**Firmware dependency (separate slice):** JuiceBox LibreTiny firmware must accept
`POST /config` JSON. This is a hard prerequisite for JuiceBox writes and is owned
by the firmware slice.

### 5. Lite retirement

`openevse-gui-lite` is archived. Its only non-shared asset, `Poller.svelte` (plus
its test), moves into nightshift. The repo's spec/plan docs remain as historical
record. Firmware that currently embeds lite's `dist/*.html.gz` switches, in the
firmware slice, to embedding `dist-juicebox/`.

## Testing

- **`TransportManager`** — component tests with a mocked `httpAPI` and a fake
  WebSocket: (1) WS success suppresses polling; (2) no WS → polling persists;
  (3) WS drop → polling resumes; (4) `uistates.connected` reflects either path.
- **`pages.js`** — `pagesBySection` hides a page when its `requires` field is
  absent and *shows* it when the field is present-but-falsy (the presence-vs-
  truthiness fix). Extend the existing test file.
- **`BottomNav` / router** — gated nav item hidden when capability absent; gated
  deep link redirects to `/`.
- **Chart loader** — guarded loader returns null when `VITE_CHARTS=false`, the
  component otherwise. Verify the JuiceBox build emits no uplot chunk
  (build-output assertion or a smoke check in the build script).
- **`Poller`** — port lite's existing test as-is.
- Full suite stays green; coverage scope unchanged (`src/lib/**/*.js`).

## Open detail for the plan

The exact `/config` field names the JuiceBox firmware reports drive the `requires`
predicates. The mechanism does not depend on the exact names; confirm them against
real hardware (or the firmware source) when writing the plan, and adjust the
predicate list accordingly.
