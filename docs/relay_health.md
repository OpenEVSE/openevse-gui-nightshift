# Relay health — GUI changes

Adds a Relay Health section to the Monitoring screen, and reorders/renames
its tabs. `relay_health` @ `c3f49b8`. Requires the `relay_health` branches of
`openevse_esp32_firmware` and `open_evse` (9.3.0+) to actually see any relay
data — see the cross-repo summary below for how those fit together.

## Monitoring tab changes

`src/routes/Monitoring.svelte`:

- **Tab order/default**: was Data, Energy, Safety (default: Data) → now
  **Energy, Data, Health** (default: **Energy**).
- **Safety → Health**: `SafetyTab.svelte` renamed to `HealthTab.svelte`
  (component + test file), tab id/label renamed throughout, and the
  fault-alert auto-jump (`onMount`, jumps to the tab on an active fault)
  retargeted from `'safety'` to `'health'`. The existing content — GFCI/
  no-ground/stuck-relay trip counts, relay switch count, "Reset fault
  counters" ($FC) — is unchanged.

## New: Relay Health section

Added to the bottom of the (renamed) Health tab, sourced from `/config`
(`relay_life_pct` and siblings, populated server-side by the
`openevse_esp32_firmware` `relay_health` branch):

| Row | Source field |
|---|---|
| Life Remaining | `relay_life_pct` |
| Cold Opens | `relay_cold_open_count` |
| Electrical Damage | `relay_elec_damage_x1e6` (shown as %) |
| Contact Transit Drift | `relay_transit_drift_warning` |
| Open Transit Baseline | `relay_transit_baseline_ms` |
| Thermal Warning | `relay_thermal_warning_level` (OK/Watch/Warning) |
| Thermal Index | `relay_thermal_index_x100` |
| Thermal Baseline | `relay_thermal_baseline_x100` |
| Stuck-Relay Recoveries | `relay_stuck_recovery_count` |

Each row gets a severity badge (ok/warning/error), matching the visual style
of the existing Errors/Info cards on the same tab. New pure helper
`relayHealthData(config)` in `src/lib/monitoring/metrics.js` builds the row
data; formatting/translation happens in `HealthTab.svelte`.

**Hidden on older controllers.** The whole section — data card and reset
button both — is wrapped in `{#if relay}`, and `relayHealthData()` returns
`null` whenever `config.relay_life_pct === undefined`. That field is only
ever present in `/config` once the controller has answered `$GL`
successfully at least once (`EvseManager::isRelayHealthKnown()` on the
gateway side) — a controller predating `open_evse` 9.3.0's `RELAY_HEALTH`
feature NAKs `$GL`, so the key is never sent and the section never renders.
No firmware-version sniffing on the GUI side; it just reacts to what's
actually in the payload.

### Reset button

"Relay Replaced - Reset Health Values" sends `$FH` via the existing RAPI
passthrough (`serialQueue` + `httpAPI('GET', '/r?json=1&rapi=$FH')`, same
pattern as the neighboring "Reset fault counters" button), then re-downloads
`config_store` — relay health lives in `/config`, not `/status`, so that's
the store that needs refreshing (the fault-counter button re-downloads
`status_store` instead, for the same reason).

## i18n

New `monitoring.health.relay.*` namespace (title, each row label, `ok`/
`warning`, `level_0`/`level_1`/`level_2`, `not_available`, and the three
reset-button states) plus `units.ms`, added to all four locales (en/es/fr/
hu). `monitoring.tab.safety` renamed to `monitoring.tab.health`. Verified
against this repo's `locale-parity` test, which enforces identical key sets
across all locale files.

## Verification

- Full test suite: 955/955 passing, including new `HealthTab.test.js` cases
  (renders/hides the section, formats values, fires `$FH`) and updated
  `Monitoring.test.js` (tab order, default tab, Health-tab routing, relay
  section presence/absence).
- `npm run build`: clean.
- Visual: a throwaway Playwright script against the mock dev server
  (`vite --mode mock`), screenshotted and reviewed, then discarded — not
  committed. Also added the new `relay_*` fields to
  `dev/fixtures/config.json` so the section is visible in normal
  `npm run dev:mock` sessions.

Not done: `docs/screenshots/monitoring-*.png` (used by `npm run screenshots`)
weren't regenerated, even though the default tab changed — that's a
separate maintenance step. The `openevse_esp32_firmware` submodule pointer
also hasn't been bumped to this commit yet.

---

## Cross-repo summary: the relay-health feature end to end

This GUI work is the last leg of a feature that touches four repos. Full
per-repo detail lives in each one's own `docs/relay_health.md` (or
`docs/stuck_relay_recovery.md`); this is the map between them.

| Repo | Branch @ commit | What it adds |
|---|---|---|
| `open_evse` (controller firmware) | `dev` @ `442a98f`, `5b3a755` | The estimation model and RAPI surface: `RelayHealth` module (cumulative-damage/Miner's-rule life estimate, coil transit-time drift, thermal index), plus stuck-relay auto-recovery (cycles the relay to try to free a weld when no EV is connected, instead of an unrecoverable hard fault). New commands `$GL`, `$GW`, `$GZ` (extended), `$SZ`, `$FH`, `$FK`. Firmware 9.3.0. |
| `OpenEVSE_Lib` (client library) | `OpenEVSE9` @ `caad0b3`, `2c7c3f3` | `getRelayHealth()`, `resetRelayHealth()`, `runStuckRelayRecovery()` — typed wrappers for the new commands. `library.json` 0.0.21 → 0.0.22. |
| `openevse_esp32_firmware` (gateway) | `relay_health` @ `68569781`, `9b4c8a88`, `de6fe6a1` | Polls the new data (at boot, after every charge session, and on a ~60s cadence), caches it in `EvseMonitor`/`EvseManager`, and exposes it via `/config` (`config_serialize()`). |
| `openevse-gui-nightshift` (this repo) | `relay_health` @ `c3f49b8` | Displays it: the Relay Health section and reset button described above. |

**The model, in short**: relay contact life splits into a mechanical budget
(huge, effectively free under normal cycling) and an electrical budget
(consumed by hot switches — fault interrupts, e-stops — weighted by
current², load character, and temperature). The reported life percentage is
mostly driven by fault events, not routine sessions. Two independent early-
warning signals ride alongside it: coil transit-time drift (a lengthening
gap between commanding the relay open and it actually opening, ahead of a
hard stuck-relay fault) and a thermal index (ΔT/I², proportional to contact
resistance, self-baselined per station). Stuck-relay recovery is a separate
but related feature: when the hard fault does happen with no EV connected,
the controller now tries cycling the relay (progressively faster on/off
toggles, up to 3 rounds) before giving up and requiring a power cycle.

Every layer degrades gracefully against an older peer: the library defaults
missing fields to 0/not-available rather than failing, the gateway omits
`relay_*` keys entirely when the controller doesn't support `$GL`, and (per
above) the GUI hides the whole section rather than showing zeros.
