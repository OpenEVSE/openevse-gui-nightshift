# OpenEVSE GUI v3 — Settings / Configuration Area Design Spec

**Date:** 2026-05-22
**Status:** Approved for implementation (autonomous build)
**Scope:** The entire v3 Settings area — a `/settings` hub plus 17 configuration pages,
ported from v2's `/configuration` screens.

---

## 1. Overview

v3 currently ships four screens (Dashboard, Schedule, Monitoring, History) and no way
to change device configuration. This spec defines the **Settings area**: a hub screen
reached from a new 5th bottom-nav item, and 17 configuration pages that let the user
read and write the OpenEVSE device's config.

The build is split into **five batches**: Config Foundation, then four themed batches
(Connectivity, Charger, Energy, System). One design spec (this document) up front; one
implementation plan per batch.

### Goals

- Every v2 configuration capability is reachable in v3, with the same field coverage.
- A single consistent **save model** across all form pages (no per-page bespoke flows).
- The architecture matches the v3 screens: route components own stores; sub-components
  are pure; pure logic is unit-tested.
- The three non-form pages (Firmware OTA, Terminal, Certificates) are handled with
  extra care and documented assumptions where the mock cannot represent a device flow.

### Non-goals

- No new device API. v3 is a client of the existing OpenEVSE HTTP + WS API.
- No redesign of v2's configuration semantics — same fields, same device endpoints.
- The Tesla OAuth login flow against `auth.openevse.com` is **out of scope** (see
  Decisions §11) — the Vehicle page ports Tesla *token* config, not the login UI.

---

## 2. Architecture

Identical rules to the v3 screens (Schedule/Monitoring/History are the exemplars).

- **The route component is the only store-aware unit.** Each config page is a route
  component in `src/routes/`. It subscribes to `config_store` / `status_store` /
  `certificate_store`, owns all writes, and passes plain props + callbacks to children.
- **Sub-components are pure.** Components in `src/lib/components/config/` and
  `src/lib/components/ui/` never import a store. They take props, emit callbacks.
- **Pure logic** — field definitions, validation, save-status state, derive helpers —
  lives in `src/lib/config/*.js` modules and is fully unit-tested.
- **Writes go through `serialQueue`** (`src/lib/queue.js`): `serialQueue.add(() => ...)`.
- **Failed writes** surface `showWriteError()` (`src/lib/alerts.js`) and the control
  reverts to the store's confirmed value.
- **Styling:** Tailwind theme tokens only (`bg-surface`, `bg-surface-2`, `bg-surface-3`,
  `text-text`, `text-text-dim`, `text-accent`, `border-border`, `text-error`,
  `text-warning`). No raw hex.
- **Svelte 5 runes** (`$props`, `$state`, `$derived`, `$effect`, `{@render children?.()}`).
- **i18n:** every user-facing string via `$_()`, keys under a `config.*` block in
  `src/lib/i18n/en.json`, extended per batch.
- **TDD:** failing test → red → implement → green → commit. Coverage is scoped to
  `src/lib/**/*.js`, so the pure modules in `src/lib/config/` carry the unit tests;
  components are tested with `@testing-library/svelte`.

### Routing

The v3 router (`src/lib/components/Router.svelte`) is **exact-match** — a plain
`routes[$currentPath]` lookup, no params. Every config page is therefore a **static
route key** in `src/lib/routes.js`:

| Page | Route | Page | Route |
|---|---|---|---|
| Settings hub | `/settings` | Solar (self-production) | `/settings/solar` |
| Network | `/settings/network` | Shaper | `/settings/shaper` |
| HTTP | `/settings/http` | EmonCMS | `/settings/emoncms` |
| MQTT | `/settings/mqtt` | OhmConnect | `/settings/ohmconnect` |
| OCPP | `/settings/ocpp` | Firmware | `/settings/firmware` |
| EVSE | `/settings/evse` | Certificates | `/settings/certificates` |
| Safety | `/settings/safety` | Terminal | `/settings/terminal` |
| Time | `/settings/time` | About | `/settings/about` |
| RFID | `/settings/rfid` | | |
| Vehicle | `/settings/vehicle` | | |

The Config Foundation batch registers **all 18 route keys** (hub + 17 pages). Pages not
yet built point at a small `ConfigPlaceholder` route component ("Coming soon"); each
themed batch swaps its placeholders for the real route components.

---

## 3. Navigation

Add a **5th bottom-nav item** to `src/lib/components/shell/BottomNav.svelte`:

```js
{ href: '/settings', key: 'nav.settings', icon: 'mdi:cog-outline' }
```

`nav.settings` → "Settings". The nav already responds to `$currentPath`; the new item
needs no other change. `aria-current` highlights `/settings` for any `/settings/*` path
is **not** required — exact-match highlight is fine and matches existing behaviour.

---

## 4. The Settings hub (`/settings`)

`src/routes/Settings.svelte`. A scrollable page of **grouped section cards**. Four
sections, each a `Card` with a heading and a list of page links:

| Section | Pages |
|---|---|
| **Connectivity** | Network, HTTP, MQTT, OCPP |
| **Charger** | EVSE, Safety, Time, RFID, Vehicle |
| **Energy** | Solar, Shaper, EmonCMS, OhmConnect |
| **System** | Firmware, Certificates, Terminal, About |

Each page link is a row: an `Icon`, the page name, and a trailing chevron
(`mdi:chevron-right`), wrapped in an `<a href="#/settings/...">`. Rows use theme tokens
and a hover state. The page-link list is data-driven from a single array exported by
`src/lib/config/pages.js` (page key, route, icon, i18n label, section) — the hub, the
nav, and tests all read from it, so the page catalogue has one source of truth.

The hub does **not** load `config_store`; it is pure navigation. It renders inside the
existing `AppShell` (header + bottom nav) like every other route.

---

## 5. Shared building blocks

Built just-in-time in the Config Foundation batch; later batches reuse them.

### 5.1 Form primitives — `src/lib/components/ui/`

`Button`, `Card`, `Select`, `Toggle`, `Slider`, `Modal`, `Icon`, `IconButton`,
`SegmentedControl`, `AlertBox`, `Loader`, `ProgressBar` already exist. Add:

- **`TextInput.svelte`** — props: `value`, `placeholder`, `disabled`, `maxlength`,
  `oninput`, `onblur`, `onchange`. Themed (`bg-surface-2`, `border-border`,
  focus ring `accent`).
- **`PasswordInput.svelte`** — like `TextInput` with `type="password"` and a
  show/hide eye toggle (`mdi:eye-outline` / `mdi:eye-off-outline`). Supports the
  v2 masked-value convention (see §6.4).
- **`NumberInput.svelte`** — props: `value`, `min`, `max`, `step`, `placeholder`,
  `disabled`, `onchange`, `onblur`. Renders `<input type="number">`; emits a
  **Number**, not a string.
- **`Textarea.svelte`** — props: `value`, `placeholder`, `rows`, `disabled`, `monospace`,
  `onchange`. Used by the Certificates modal.

All primitives are controlled: `value` in, event out. They keep no persistent local
state except transient typing buffers.

### 5.2 Config components — `src/lib/components/config/`

- **`ConfigPage.svelte`** — the page shell every config route renders inside. Props:
  `title` (string), `children` (snippet). Renders a back-to-hub link
  (`← Settings`, `href="#/settings"`, `mdi:chevron-left`), the page title, and the
  slotted content in a padded `<section class="p-4">`. Optional `loading` prop shows a
  `Loader` instead of the slot.
- **`FormField.svelte`** — a labelled row wrapping one control. Props: `label`
  (string), `description` (optional help text), `status` (`'idle' | 'saving' |
  'saved' | 'error'`), `children` (the control snippet). Renders the label, the
  control, an inline save-status indicator (see §6.3), and the description below.
- **`ReadOnlyRow.svelte`** — props: `label`, `value`, optional `tone`
  (`'default' | 'ok' | 'warn' | 'error'`). A label + value row for device info
  (firmware version, IP, connection status, counters). No control.
- **`ConfigSection.svelte`** — props: `title` (optional), `children`. A `Card`-wrapped
  group of `FormField`s, for visually separating a page's subsections (e.g. MQTT's
  TLS block). Use where a page has more than one logical group; otherwise fields go
  straight in `ConfigPage`.
- **`ConfigPlaceholder.svelte`** — the temporary route component for not-yet-built
  pages. Renders inside `ConfigPage` with a "Coming soon" message.

### 5.3 Pure logic — `src/lib/config/`

- **`pages.js`** — the page catalogue (§4): an array of
  `{ key, route, icon, labelKey, section }` plus a `pagesBySection` helper. Unit-tested
  for completeness (all 17 pages present, every section non-empty, routes unique).
- **`saveState.js`** — the per-field save-status helper. Exports a factory
  `createSaveState()` returning `{ subscribe, begin(name), succeed(name),
  fail(name), statusOf(name) }`. `begin` sets a field to `saving`; `succeed` sets
  `saved` and schedules an auto-clear back to `idle` after `SAVED_LINGER_MS` (2000);
  `fail` sets `error`. Pure, fully unit-tested with fake timers.
- **`validate.js`** — small pure validators reused across pages: `isRequired(v)`,
  `isHostname(v)`, `inRange(v, min, max)`, `isPort(v)`. Each returns
  `{ ok: boolean, msgKey: string | null }`. Unit-tested.
- Per-page field-definition / derive modules are added by each batch as needed
  (e.g. `src/lib/config/evse.js` for the EVSE current bounds, `src/lib/config/tz.js`
  thin wrapper over `getTZ`/`createTzObj`). Each batch's plan specifies its modules.

`src/lib/utils.js` already has `getTZ`, `createTzObj`, `compareVersion`, `httpAPI`,
`JSONTryParse`, `validateFormData`, `submitFormData`. Reuse these — do **not**
re-implement. (`submitFormData`/`validateFormData` are v2-style form orchestration;
the v3 pages use the per-field model below instead, but the timezone/version/parse
helpers are used directly.)

---

## 6. The save model

One model for **every form page**, so the experience is identical everywhere.

### 6.1 Per-field save

Mirror v2's immediate-save pages (Network, Safety, RFID): **each field saves on its
own**, there is no page-level "Save" button.

- **Toggles, selects, sliders** save on `change`.
- **Text / password / number inputs** save on `blur` (and on `change` for number
  spinners). Saving on every keystroke would hammer the single-threaded device.
- The route component owns a single `saveField(name, value)` async function:

  ```js
  async function saveField(name, value) {
    saveState.begin(name)
    const ok = await serialQueue.add(() => config_store.saveParam(name, value))
    if (ok) {
      saveState.succeed(name)
    } else {
      saveState.fail(name)
      showWriteError()
    }
  }
  ```

- `config_store.saveParam(name, val)` POSTs `{[name]: val}` to `/config` and, on
  success only, optimistically updates the store. So on **failure the store is
  unchanged** — controls bound to `$config_store[name]` show the old (correct) value.

### 6.2 Controlled fields & revert

Each control's `value` prop is fed from `$config_store[name]`. On a successful save the
store updates and the prop re-flows the new value; on failure the store is unchanged so
the prop re-flows the **old** value — that is the revert, no extra code.

Text/number inputs keep a transient local buffer while focused (so typing isn't
clobbered by store reactivity). On `blur` they emit the value and, after the save
resolves, re-sync the buffer from the prop. `FormField` owns this buffer logic so each
page doesn't repeat it: a page passes `name`, `value`, and `onsave` and `FormField`
wires the control.

### 6.3 Inline status indicator

`FormField` shows a small trailing indicator driven by the field's `status`:

- `idle` — nothing.
- `saving` — a spinning `mdi:loading` icon (`text-text-dim`).
- `saved` — `mdi:check` (`text-accent`) for ~2s, then back to `idle`.
- `error` — `mdi:alert-circle-outline` (`text-error`); cleared on the next save attempt.

The global `showWriteError()` AlertBox is the loud failure signal; the inline `error`
icon is the quiet per-field marker. Both fire on failure.

### 6.4 Password fields

v2 convention: a saved password reads back from the device as the literal
`"_DUMMY_PASSWORD"` (or is masked `"••••••••••"`). `PasswordInput` shows a masked
placeholder when the stored value is the dummy sentinel and the field is untouched; it
only emits a save when the user actually types a new value. If the user blurs without
changing it, **no save fires**. `src/lib/config/validate.js` exports
`isDummyPassword(v)` for this check.

### 6.5 Toggle-gated sections

Several pages hide a block of fields behind an "enabled" toggle (`mqtt_enabled`,
`ocpp_enabled`, `divert_enabled`, `emoncms_enabled`, `ohm_enabled`,
`current_shaper_enabled`, `rfid_enabled`, `auth_enabled`). The toggle is itself a
config field saved on change via `saveField`. The dependent fields simply render under
`{#if $config_store.<enabled>}`. No special validation gate — the user can leave inner
fields blank; the device tolerates it. (v2 blocked enabling with required fields
empty; v3 simplifies to per-field save, so an empty required field shows the inline
`error`/validation hint but does not block the toggle. Recorded in Decisions §11.)

---

## 7. The 17 pages

Field tables below list **label → `config_store` property → control**. Read-only rows
come from `status_store` unless noted. Each batch's plan turns these into TDD tasks
with exact code; this section is the contract.

### Batch B — Connectivity

#### 7.1 Network — `/settings/network`
- Read-only: Mode (`status.mode` → AP/STA/STA+AP/Wired), IP (`status.ipaddress`),
  MAC (`status.macaddress`), WiFi/Eth connected (`status.wifi_client_connected` /
  `status.eth_connected`).
- Fields: Hostname → `hostname` (text); AP SSID → `ap_ssid` (text, placeholder
  `openevse`); AP Password → `ap_pass` (password).
- The AP block renders only when `config.wizard_passed`.
- **WiFi scan/join** (`WifiScan`) is **deferred** — see Decisions §11. The page shows
  the connected SSID/RSSI read-only (`config.ssid`, `status.srssi`) but no scan UI.

#### 7.2 HTTP — `/settings/http`
- Fields: Auth enabled → `auth_enabled` (toggle); when on: Username →
  `www_username` (text, maxlength 15), Password → `www_password` (password,
  maxlength 15). Language → `lang` (select; options from svelte-i18n `$locales`,
  v3 currently ships `en` only — fine).

#### 7.3 MQTT — `/settings/mqtt`
- Read-only: connection status (`status.mqtt_connected`) when enabled.
- Fields: `mqtt_enabled` (toggle); when on — `mqtt_protocol` (select, options from
  `config.mqtt_supported_protocols`), `mqtt_server` (text), `mqtt_port` (number,
  placeholder 1883), `mqtt_user` (text), `mqtt_pass` (password), `mqtt_topic` (text,
  placeholder `openevse`), `mqtt_announce_topic` (text), `mqtt_retained` (toggle),
  `mqtt_vrms` (text).
- TLS sub-block, shown only when `mqtt_protocol === 'mqtts'`:
  `mqtt_reject_unauthorized` (toggle), `mqtt_certificate_id` (select; options built
  from `certificate_store` client certs + a "None" option).

#### 7.4 OCPP — `/settings/ocpp`
- Read-only: connection status (`status.ocpp_connected`) when enabled.
- Fields: `ocpp_enabled` (toggle); when on — `ocpp_server` (text, placeholder
  `wss://…`), `ocpp_chargeBoxId` (text), `ocpp_authkey` (password),
  `ocpp_auth_auto` (toggle), `ocpp_idtag` (text; shown only when `ocpp_auth_auto`),
  `ocpp_auth_offline` (toggle), `ocpp_suspend_evse` (toggle),
  `ocpp_energize_plug` (toggle).

### Batch C — Charger

#### 7.5 EVSE — `/settings/evse`
- Fields: Max current → `max_current_soft` (slider, min `min_current_hard` default 6,
  max `max_current_hard` default 32, unit A); `default_state` (select: Disabled=false,
  Active=true; render only if defined); `is_threephase` (select: No=false, Yes=true;
  render only if defined); `scheduler_start_window` (number, 0–3600 s);
  `scale` (number); `offset` (number); `service` (select: Auto=0, Level 1=1,
  Level 2=2); `pause_uses_disabled` (toggle); `led_brightness` (slider 0–255; render
  only if defined).
- `max_current_hard` is **read-only** in v3 — see Decisions §11.

#### 7.6 Safety — `/settings/safety`
- Read-only counters: `status.gfcicount`, `status.nogndcount`, `status.stuckcount`.
- Fields (all toggles): `gfci_check`, `ground_check`, `relay_check`, `temp_check`,
  `diode_check`, `vent_check`.
- Warning banner when not all six are on.

#### 7.7 Time — `/settings/time`
- Read-only: current device time (`status.time` / `status.local_time`).
- Fields: Time mode (select: Manual=0, NTP=2 → maps to the device's NTP-enable field;
  see plan); `sntp_hostname` (text, placeholder `pool.ntp.org`; shown only in NTP
  mode); `time_zone` (select; options via `createTzObj` from the `posix_tz_db`
  submodule, current value normalised with `getTZ`).
- Manual mode shows a "Set device time to browser time" button that POSTs the current
  browser time to the device time endpoint (per v2 `setTime()`); plan pins the
  endpoint from v2.

#### 7.8 RFID — `/settings/rfid`
- Fields: `rfid_enabled` (toggle).
- When on: a tag manager. Tags live in `config.rfid_storage` (comma-separated string;
  `src/lib/config/rfid.js` parses ↔ serialises). "Scan tag" button calls
  `GET /rfid/add` (60 s timeout via `httpAPI`); a scanned UID
  (`status.rfid_input`) can be registered (appended to `rfid_storage`) or, if already
  present, shown as already-registered. Each tag row has a Remove button; a Remove-all
  button clears the list.

#### 7.9 Vehicle — `/settings/vehicle`
- Field: `vehicle_data_src` (select: None=0, Tesla=1, MQTT=2, HTTP=3).
- Mode 2 (MQTT): `mqtt_vehicle_range_miles` (select km/miles),
  `mqtt_vehicle_soc` / `mqtt_vehicle_range` / `mqtt_vehicle_eta` (text topics).
- Mode 1 (Tesla): **token-only** — `tesla_access_token` (password),
  `tesla_refresh_token` (password), `mqtt_vehicle_range_miles` (select). The Tesla
  OAuth login flow is out of scope (Decisions §11); a short note links advanced users
  to obtain tokens elsewhere.
- Mode 3 (HTTP): an info block describing the HTTP push endpoint (no fields).
- Read-only vehicle status (battery level/range/ETA from `status_store`) shown when
  the data source is active.

### Batch D — Energy

#### 7.10 Solar / Self-production — `/settings/solar`
- Read-only: `status.solar`, `status.grid_ie`, `status.charge_rate`,
  `status.smoothed_available_current` (when `divert_active`), `status.divert_active`.
- Fields: `divert_enabled` (toggle); when on — `divert_type` (select:
  Production=0, Excess=1); `mqtt_solar` (text; shown when type 0) /
  `mqtt_grid_ie` (text; shown when type 1); `divert_PV_ratio` (number, step 0.01);
  `divert_min_charge_time` (number, s); `divert_attack_smoothing_time` (number,
  0–600); `divert_decay_smoothing_time` (number, 0–600).
- Four preset buttons (Default / No Waste / No Import / Custom) that fill the four
  tuning params; values per v2 (`src/lib/config/divert.js`, unit-tested).

#### 7.11 Shaper — `/settings/shaper`
- Read-only: `status.shaper_updated`, `status.shaper_live_pwr`, `status.shaper_cur`.
- Fields: `current_shaper_enabled` (toggle); when on — `current_shaper_max_pwr`
  (number, W); `mqtt_live_pwr` (text topic); `current_shaper_min_pause_time`
  (number, 0–60 s); `current_shaper_data_maxinterval` (number, 10–300 s);
  `current_shaper_smoothing_time` (number, 0–600 s).

#### 7.12 EmonCMS — `/settings/emoncms`
- Read-only: `status.emoncms_connected`, posts `status.packets_success` /
  `status.packets_sent`.
- Fields: `emoncms_enabled` (toggle); when on — `emoncms_server` (text),
  `emoncms_node` (text), `emoncms_apikey` (password).

#### 7.13 OhmConnect — `/settings/ohmconnect`
- Read-only: `status.ohm_hour`.
- Fields: `ohm_enabled` (toggle); when on — `ohm` (password, "Ohm key").

### Batch E — System

#### 7.14 Firmware — `/settings/firmware` *(complex — extra care)*
- Read-only device info: OpenEVSE hardware version (`config.firmware`), WiFi gateway
  version (`config.version`), `config.espinfo`, `config.build_env`.
- Actions: Restart EVSE / Restart gateway (`POST /restart` with `{device:'evse'|'gateway'}`),
  Factory reset (`GET /reset`, behind a typed/explicit confirm).
- **OTA file upload:** a `.bin`/`.hex` file POSTed to `/update` (multipart, field
  `update`); progress from `status.ota` (`started`/`completed`/`failed`) and
  `status.ota_progress` (0–100) shown in a `ProgressBar`; `serialQueue.pause()` for
  the duration, `resume()` after. On `completed`, a 6 s countdown then reload.
- **Config backup/restore:** Backup downloads a sanitised `config.json` (strip the
  password/secret/identity fields v2 strips — list pinned in the plan). Restore reads
  a JSON file and calls `config_store.upload(parsed)`.
- The GitHub release version-check is **deferred** (Decisions §11) — the page shows
  installed versions and manual file-upload OTA only.

#### 7.15 Certificates — `/settings/certificates` *(complex — extra care)*
- Uses `certificate_store` (already in v3: `download`, `upload(cert)` →
  `{msg,success}`, `remove(id)` → boolean).
- A list of certs (id, type, name) with a per-row delete (confirm first).
- An "Add certificate" `Modal`: Type (select Root/Client), Name (text),
  Certificate (textarea, monospace), Private key (textarea, monospace; required and
  shown only when Type = Client). Submit calls `certificate_store.upload`.
- Mock support: `dev/mock-plugin.js` gains `GET/POST/DELETE /certificates`; a
  `dev/fixtures/certificates.json` already exists — confirm/extend it.

#### 7.16 Terminal — `/settings/terminal` *(complex — extra care)*
- **RAPI console:** a command input; each command runs `GET /r?json=1&rapi=<cmd>`
  (via `httpAPI`); results accumulate in a scrollback list; a Clear button.
- **Debug / EVSE consoles:** buttons opening a fullscreen `Modal` with a live
  WebSocket terminal (`ws(s)://<host>/{debug|evse}/console`, 2000-line buffer,
  auto-scroll, font-size toggle, auto-reconnect). When the WS cannot connect (the
  mock does not serve `/debug/console`), the terminal shows a clear
  "console unavailable" state instead of erroring — see Decisions §11.
- Mock support: add a `GET /r` route to `dev/mock-plugin.js` returning a plausible
  RAPI JSON shape so the RAPI console is exercisable offline.

#### 7.17 About — `/settings/about`
- Purely informational: app/firmware versions (`config.version`, `config.firmware`),
  documentation link, repository links, tech-stack credits, OpenEVSE/OpenEnergyMonitor
  footer. No stores written; versions read from `config_store`.

---

## 8. Error handling

- **Write failure** (any `saveParam` / `upload` returning false, or `httpAPI`
  returning the string `"error"`): call `showWriteError()` and set the field's inline
  status to `error`; the control reverts via the unchanged store (§6.2).
- **Download failure** on a page that bulk-loads (Certificates): `ConfigPage` shows an
  inline error with a retry button; no crash.
- **Action endpoints** (restart, reset, scan, RAPI, OTA): on `"error"` show
  `showWriteError()` (or a page-local inline error for long flows like OTA) and leave
  the UI in a safe idle state.
- Components must guard against missing `status_store` / `config_store` fields
  (device may not report everything) — render "—" or hide the row, never throw.

---

## 9. Testing

- **Pure modules** (`src/lib/config/*.js`) — unit tests in `src/lib/config/__tests__/`,
  full branch coverage (this is where coverage is measured).
- **Route components** — `@testing-library/svelte` tests in
  `src/routes/__tests__/`: render, interact, assert `config_store.saveParam` /
  `certificate_store` calls (mock the store module), assert `showWriteError` on
  failure, assert conditional sections show/hide on toggle state.
- **Standard svelte-i18n mock** in every component test:
  ```js
  vi.mock('svelte-i18n', () => {
    const t = (k) => k
    t.subscribe = (fn) => { fn(t); return () => {} }
    return { _: t }
  })
  ```
- Every `import`/`vi.mock()` target must resolve to a real file (Vite 8 / rolldown).
- Verification gate per batch: `npm test` green; `npm run build` succeeds with all
  `dist/assets` JS/CSS gzipped (except `sw.js`); a Playwright visual pass with no
  console/page errors.

---

## 10. Build batches & process

One spec (this doc), then per batch: explore v2 → `superpowers:writing-plans` →
`docs/superpowers/plans/2026-05-22-config-<batch>.md` → `config-<batch>` branch →
`superpowers:subagent-driven-development` (sonnet implementers, opus reviewer for
route/integration tasks + a final batch review) → merge to `main` when green →
Playwright check. Order:

1. **Config Foundation** — nav item, `/settings` hub, all 18 route keys (placeholders),
   the shared primitives + config components (§5.1–5.2), the pure modules `pages.js` /
   `saveState.js` / `validate.js` (§5.3), the base `config` i18n block.
2. **Connectivity** — Network, HTTP, MQTT, OCPP.
3. **Charger** — EVSE, Safety, Time, RFID, Vehicle.
4. **Energy** — Solar, Shaper, EmonCMS, OhmConnect.
5. **System** — Firmware, Certificates, Terminal, About.

Full process detail is in `docs/superpowers/CONFIG-RUNBOOK.md`.

---

## 11. Decisions

Choices made where v2 was ambiguous or a flow does not fit v3 / the offline mock.
Each follows the runbook rule: pick the v2-/v3-consistent option, record it, continue.

1. **Per-field save for all pages.** v2 mixed immediate-save pages with
   submit-button pages. v3 standardises on per-field save (§6) for a single
   consistent model. Toggle-gated pages no longer block the enable toggle on empty
   required inner fields; an empty required field shows an inline validation hint.
2. **`max_current_hard` is read-only.** v2 let an advanced user raise the hardware max
   behind a confirmation. That is a rare, foot-gun setting; v3 shows it read-only.
   `max_current_soft` (the everyday setting) stays editable.
3. **WiFi scan/join deferred.** v2's `WifiScan` does a live AP scan + join handshake.
   It cannot be meaningfully exercised against the mock and is a self-contained
   sub-feature. v3's Network page ships hostname + AP config; the scan/join UI is a
   documented follow-up.
4. **Tesla OAuth login deferred.** v2's Vehicle page logs into `auth.openevse.com` and
   fetches a vehicle list. That external OAuth flow is out of scope; v3 ports the
   Tesla *token* fields (access/refresh token, range units) so an advanced user can
   still configure Tesla. The interactive login UI is a documented follow-up.
5. **Firmware GitHub version-check deferred.** v2 queries the GitHub releases API to
   offer an auto-update. v3's Firmware page ships installed-version display, restart,
   factory reset, manual file-upload OTA with progress, and config backup/restore.
   The GitHub auto-update is a documented follow-up.
6. **Terminal WS graceful degradation.** The offline mock cannot serve the
   `/debug/console` and `/evse/console` WebSockets. The Terminal page's debug/EVSE
   consoles detect the failed connection and render a clear "console unavailable"
   state. The RAPI console (`GET /r`) gets a mock route and works offline.
7. **`config` i18n block, English only.** All new strings go under `config.*` in
   `src/lib/i18n/en.json`. v3 ships `en` only today; other locales are out of scope.
8. **Hub is pure navigation.** `/settings` loads no stores; it is a static grouped
   menu driven by `src/lib/config/pages.js`.
9. **Static route per page.** The v3 router is exact-match; each page is its own route
   key. No param/nested routing is introduced.
