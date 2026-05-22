# OpenEVSE GUI v3 — Deferred Features Design Spec

**Date:** 2026-05-22
**Status:** Approved for implementation
**Scope:** The three features deferred from the Settings build (config spec §11) —
WiFi scan/join, Tesla OAuth login, and the Firmware GitHub version-check.

---

## 1. Overview

The v3 Settings build deliberately deferred three self-contained features because
each involves a device or external flow the offline mock can't fully represent. This
spec covers building all three, ported from v2's implementations.

| Feature | Page | v2 source |
|---|---|---|
| WiFi scan & join | `/settings/network` | `WifiScan.svelte`, `WifiDisplay.svelte` |
| Tesla OAuth login | `/settings/vehicle` | `VehicleTesla.svelte`, `stores/tesla.js` |
| Firmware GitHub check + install | `/settings/firmware` | `Firmware.svelte`, `FirmwareUpdateModal.svelte`, `stores/github.js` |

## 2. Architecture

Same rules as the rest of v3: the route component is the only store-aware unit; pure
logic goes in `src/lib/config/*.js` modules and is unit-tested; UI sub-components are
pure; device writes go through `serialQueue`; failures surface `showWriteError()`;
strings via `$_()`; Tailwind theme tokens; Svelte 5 runes.

New pure modules:
- `src/lib/config/wifi.js` — network-list normalisation (dedupe, sort by signal).
- `src/lib/config/firmware.js` — GitHub release classification, asset matching,
  update detection. Plus a `fetchReleases()` network function (mockable).

No new Svelte stores: the WiFi network list, the Tesla vehicle list, and the GitHub
release data are all page-local ephemeral state held in the route component with
`$state` — none is app-wide.

## 3. Feature — WiFi scan & join

On the Network page, add a **"Change WiFi"** flow below the read-only network status.

- A **Scan** button calls `GET /scan` (through `serialQueue`, `httpAPI`). The response
  is an array of `{ ssid, rssi, encryption? }`. `wifi.js` dedupes by SSID (keep the
  strongest) and sorts by signal descending.
- The scan result renders as a list: SSID, a signal-strength icon (from `rssi`), and a
  lock icon when `encryption` indicates a secured network.
- Tapping a network opens a small inline password field (skipped for open networks);
  a **Connect** button calls `config_store.upload({ ssid, pass })` through
  `serialQueue`.
- On a successful write, show a non-blocking notice ("Connecting — the charger will
  rejoin your network; this page may need reloading at its new address"). v2 waited
  20 s then checked `status.net_connected`; v3 keeps it simple — show the notice and
  let the existing IP-change redirect (in `DataManager`) handle a moved device.
- The current connection (SSID + signal) stays shown read-only at the top, as today.

Mock: add `GET /scan` to `dev/mock-plugin.js` returning a representative network list
so the scan UI works offline. The join itself is a `POST /config` write — it fails
against the mock (the mock doesn't accept config writes) exactly like every other
Settings write; that is expected and unchanged.

## 4. Feature — Tesla OAuth login

On the Vehicle page, the Tesla data-source mode currently offers only manual token
entry. Add the full login flow:

- A **username + password** form. **Log in** posts `{ username, password }` to
  `https://auth.openevse.com/login` (an absolute URL — `httpAPI` passes absolute URLs
  through unprefixed). A successful response is `{ ok: true, access_token,
  refresh_token, created_at, expires_in }`.
- On success, save the tokens to the device config in one write:
  `{ tesla_enabled: true, tesla_access_token, tesla_refresh_token, tesla_created_at,
  tesla_expires_in }`.
- When logged in (all five `tesla_*` credential fields present and non-empty), fetch
  the vehicle list with `GET /tesla/vehicles` → `{ count, vehicles: [{ id, name }] }`.
  Show a vehicle `Select`; choosing one writes `{ tesla_vehicle_id }`.
- A **Log out** button writes `{ tesla_enabled: false, tesla_access_token: '',
  tesla_refresh_token: '', tesla_created_at: '', tesla_expires_in: '' }`.
- The manual **access/refresh token** fields remain, under an "Advanced" disclosure,
  for users who already hold tokens.
- `src/lib/config/tesla.js` (pure) exports `hasTeslaCredentials(config)` — the
  five-field check — and is unit-tested.

**Decision — credential relay (recorded).** This posts the user's Tesla account
username and password to `auth.openevse.com`, OpenEVSE's own service, which performs
the Tesla OAuth exchange server-side and returns tokens. This is v2's established
design. The page must make clear (a one-line note) that login goes through OpenEVSE's
server, and the advanced token-entry path remains for users who prefer not to.

Mock: add `GET /tesla/vehicles`. The login endpoint is external; offline it simply
errors and the page shows a login-failed message — acceptable and documented.

## 5. Feature — Firmware GitHub check + install

On the Firmware page, add an **"Online updates"** section above the manual file
upload.

- On mount, `fetchReleases()` GETs
  `https://api.github.com/repos/OpenEVSE/ESP32_WiFi_V4.x/releases` (direct browser
  fetch — public API, no device involved). On any failure it returns `[]` and the
  section shows "couldn't reach GitHub".
- `firmware.js` `classifyReleases(releases)` returns `{ release, prerelease, daily }`:
  - **release** — first entry with `prerelease === false`.
  - **prerelease** — first with `prerelease === true` and a `v<digit>.<digit>…` tag.
  - **daily** — first with `tag_name === 'latest'`.
- `findAsset(release, buildenv)` returns the release asset whose `name` starts with
  the device's `config.buildenv` and ends with `.bin`, else `null`. (v2 hardcoded a
  `_gui-v2.bin` suffix; v3 uses a prefix match so it survives asset-name changes.)
- `updateAvailable(latestName, installedVersion)` uses the existing
  `compareVersion()` — true only when the latest is strictly newer. If the installed
  version isn't a parseable `vX.Y.Z` (e.g. a local dev build), treat update as **not**
  available (don't nag) but still let the user install a chosen build manually.
- For each build channel that has a matching asset, show its version and an
  **Install** button (behind a confirm). Install POSTs `{ url: asset.browser_download_url }`
  to `/update`; progress is the existing `status.ota` / `status.ota_progress` flow and
  the existing post-completion auto-reload.

Mock: no mock route needed for the GitHub fetch (it goes straight to GitHub).
`POST /api/update` already exists in the mock.

## 6. Error handling

- `GET /scan`, `GET /tesla/vehicles`, `fetchReleases()` — on `'error'`/failure, show an
  inline "couldn't load" state; never throw, never block the page.
- Writes (`/config`, `/update`) — on failure, `showWriteError()`; controls revert.
- Tesla login failure — an inline message on the login form, not the global alert.

## 7. Testing

- Pure modules (`wifi.js`, `firmware.js`, `tesla.js`) — full unit tests in
  `src/lib/config/__tests__/`.
- Route components — `@testing-library/svelte`: render, the scan/login/check flows
  with `httpAPI` / `fetch` mocked, assert the right endpoints and the conditional UI.
- Standard svelte-i18n mock; `vi.waitFor` for post-async assertions.
- Verification gate per the runbook: `npm test` green, `npm run build` clean, a
  Playwright pass with no console errors.

## 8. Decisions

1. **No new stores** — the three data sets (networks, vehicles, releases) are
   page-local `$state`, not app-wide stores.
2. **Tesla credential relay** — login routes Tesla credentials through
   `auth.openevse.com` (v2's design); the page says so and keeps manual token entry.
3. **GitHub asset prefix-match** — `findAsset` matches `buildenv`-prefixed `.bin`
   assets rather than v2's hardcoded `_gui-v2.bin` suffix.
4. **Non-semver installed version** — a local/dev build version never shows as
   "update available"; the user can still pick and install a build channel manually.
5. **WiFi join verification** — the join write can't be exercised against the offline
   mock (no config writes); the scan list is mockable and is what's verified offline.
