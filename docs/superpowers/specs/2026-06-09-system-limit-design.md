# System Limit Design

**Date:** 2026-06-09
**Status:** Approved

## Problem

The device supports two kinds of charge limits:

- **User limits** — one-shot, set from the dashboard via `POST /limit` with
  `auto_release: true`; cleared by `DELETE /limit` or when the session ends.
- **System limits** — a persistent default, stored in config as
  `limit_default_type` + `limit_default_value`, applied by the firmware to
  every session and reported via `GET /limit` with `auto_release: false`.

Nightshift has no UI for system limits (the EVSE settings page lacks the
section gui-v2 had), and the dashboard treats every active limit as a user
limit — including a clear (×) button that shouldn't apply to a config-driven
default.

## Goals

- EVSE settings page can set, change, and remove the system limit.
- The dashboard shows an active system limit like any limit, but offers **no
  delete affordance** for it; user limits keep theirs.
- No change to the user-limit flow.

## Non-goals

- No "system" badge/labeling on the dashboard limit row.
- No changes to the firmware API usage beyond the existing config keys.

## Device contract (established by gui-v2 + firmware)

| Concern | Mechanism |
|---|---|
| Set/change system limit | `POST /config` `{ limit_default_type, limit_default_value }` |
| Remove system limit | `POST /config` `{ limit_default_type: "none" }` |
| Active limit report | `GET /limit` → `{ type, value, auto_release }` |
| Discriminator | `auto_release === false` ⇒ system limit |
| Value units | time: minutes; energy: **Wh** (UI shows kWh); soc: %; range: km or miles per `mqtt_vehicle_range_miles` |
| Unset config value | `limit_default_type` may be `""` — UI normalizes to `none` |

## EVSE page — System limit section (`src/routes/settings/Evse.svelte`)

New `ConfigSection` titled with `config.evse.system_limit`, placed between
the Behaviour and Sensor sections:

- **Type** — `Select` with options none / time / energy / soc / range.
  Value derives from `$config_store?.limit_default_type`, treating `""`,
  `undefined`, and `"none"` as `none`.
- **Value** — a `NumberInput` rendered only when type ≠ none, unit-adaptive:
  - time → minutes (min 0, step 5)
  - energy → kWh shown (min 0, step 1); device stores Wh: save `kWh * 1000`,
    display `limit_default_value / 1000`
  - soc → % (min 0, max 100)
  - range → km or miles label per `mqtt_vehicle_range_miles` (min 0, step 10)
- **Saving** — both keys in one write via the existing `form.saveFields`:
  - changing type to a concrete kind: `{ limit_default_type: t,
    limit_default_value: 0 }` — the value resets on type change because units
    differ per type (matches gui-v2); the user then enters the value
  - changing the value: `{ limit_default_value: v }` (converted for energy)
  - choosing None: `{ limit_default_type: 'none' }`
- Follows the page's existing FormField/save-state idiom; no modal.

## Dashboard — system limits are not deletable

Discriminator derived once: `let systemLimit = $derived($limit_store?.auto_release === false)`.

Four touch points in `src/routes/Dashboard.svelte` (+ `ChargeLimitCard.svelte`):

1. **Limit row ×** — `ChargeLimitCard` gains a `clearable = true` prop; the
   time/energy row renders the clear button only when `clearable`. Dashboard
   passes `clearable={!systemLimit}`. The summary still shows.
2. **SOC-bar ceiling auto-clear** — the knob-commit path that currently calls
   `limit_store.remove()` when the committed percent reaches the ceiling
   skips the delete when `systemLimit` (no-op; the knob snaps back via the
   existing nonce remount). Dragging to a sub-ceiling value still posts a
   normal *user* limit, which overrides the default for the session.
3. **Mode "On" after a tripped limit** — `setSegment('on')` currently issues
   `DELETE /limit` when `limitTripped`; skip that when `systemLimit`. Note:
   the firmware only re-applies the config default at boot or on a config
   write, so a DELETE would silently discard the configured limit — the
   guard prevents a destructive action, not just a futile one.
4. **Boost's defensive limit clear** — `boost()` opens with a defensive
   `DELETE /limit` (residual-claim workaround); skip it when `systemLimit`
   for the same destructive-DELETE reason. Boosting past a *tripped* system
   limit therefore won't resume charging — same accepted behavior as On.
   (Found in final review; the original spec enumerated only three paths.)

## i18n

- `config.evse.system_limit` (section title), `config.evse.limit_type`,
  `config.evse.limit_value` labels, and type option labels (reuse existing
  `dashboard.limit.*` type strings where present; add under `config.evse.*`
  otherwise). All four locales (en/es/fr/hu); parity maintained.

## Testing

- **Evse page tests:** section renders; selecting a type saves
  `limit_default_type` + `limit_default_value`; energy value converts kWh→Wh
  on save and Wh→kWh on display; selecting None saves
  `{ limit_default_type: 'none' }`.
- **ChargeLimitCard tests:** with an active time/energy limit,
  `clearable: false` hides the × and `clearable: true` shows it.
- **Dashboard tests:** with `limit_store` holding `auto_release: false`, the
  clear button is absent and pressing On while tripped does not call
  `DELETE /limit`; with `auto_release: true`, existing behavior unchanged.
- Existing suite (673) stays green.
