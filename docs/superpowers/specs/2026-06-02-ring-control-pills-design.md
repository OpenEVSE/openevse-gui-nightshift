# Ring Control Pills — Design

**Status:** Approved design. Date: 2026-06-02.

## Goal

Declutter the Dashboard by removing the always-open **Charge mode** segmented row
and the **Charge rate** slider row, and surfacing both as compact tappable pills
that flank the power ring: **mode pill top-left, rate pill top-right**. Each opens
a small popover to change the value.

## Background

The Dashboard had grown busy (status → ring → chips → eco/shaper → mode row →
rate row → SOC bar → limit → boost). The mode and rate controls each took a full
row while only occasionally needing interaction. Moving them into pills around the
ring reclaims two rows and keeps the value glanceable.

Current wiring already exists in `src/routes/Dashboard.svelte` and is reused
unchanged:

- `mode` (0 Auto / 1 On / 2 Off), `setMode(m)`, `modeLocked`, `claimOwner`.
- `chargeAmps`, `setChargeAmps(val)`, `maxAmps` (`config.max_current_soft`),
  `rateClaimedBy`, `ecoOn`, `busy`, `rateNonce`.
- `EvseClients` ids for the lock owners: `ocpp` 65545, `rfid` 65546, `limit` 65542.

## What this builds

Three new components plus Dashboard rewiring.

### `src/lib/components/ui/Popover.svelte` (new, generic)

A lightweight anchored popover — DRY base for both pills.

- Props: `open` (bool), `align` (`'left' | 'right'`, default `'left'`),
  `onclose` (fn), `children` (snippet for the panel), and a `trigger` snippet.
- Renders the trigger inline; when `open`, renders the panel absolutely below the
  trigger, edge-aligned per `align` (left edge for `left`, right edge for `right`)
  so it doesn't run off-screen.
- Closes on **click outside** and **Escape**. Implemented with a full-viewport
  transparent backdrop (click → `onclose`), mirroring `Modal.svelte`'s
  click-outside idiom, plus a `keydown` Escape handler.
- The panel is `role="menu"`; the trigger is the caller's button.

### `src/lib/components/dashboard/ModePill.svelte` (new)

- Props: `mode` (0/1/2), `locked` (bool), `lockLabel` (string, e.g. `'OCPP'`),
  `disabled` (bool), `onmode` (fn).
- Renders a small pill. Label = `dashboard.mode.auto|on|off` for the current
  `mode`, with a `▾` affordance.
- **Locked:** when `locked`, the pill is dimmed (`opacity-40`), non-interactive,
  and shows `lockLabel` (the short owner word) instead of the mode; no popover.
- Otherwise tapping toggles a `Popover` (`align="left"`) listing the three modes
  (current one highlighted, like `SegmentedControl`'s selected style). Picking one
  calls `onmode(value)` and closes the popover.
- Also `disabled` (e.g. `busy` or `display === 'error'`) dims and blocks opening.

### `src/lib/components/dashboard/RatePill.svelte` (new)

- Props: `amps`, `min` (6), `max` (maxAmps), `claimedBy` (string), `disabled`
  (bool), `onchange` (fn).
- Renders a small pill showing `{amps} A` with a `▾` affordance.
- Tapping toggles a `Popover` (`align="right"`) containing the existing
  `ui/Slider.svelte` (min→max, step 1) and the live `{amps} A` readout; commit on
  release calls `onchange(value)`.
- When `claimedBy` is set, the popover shows the `dashboard.rate.claimed` hint
  (as the row did).
- `disabled` (Eco owns the rate, or `busy`) dims the pill and blocks opening.

### `src/routes/Dashboard.svelte` (modify — layout + wiring only)

- Wrap `<PowerRing>` in a `relative` container. Place `<ModePill>` absolutely at
  the **top-left** corner and `<RatePill>` at the **top-right** corner (the corner
  positions validated in the mockup). Both render in **all** ring states (the
  wrapper sits outside the `{#if display !== 'error'}` block, like `PowerRing`).
- **Remove** the `<ModeSelector>` and `<ChargeRate>` instances (and their imports).
  Keep `{#key rateNonce}` around the rate path by wrapping `<RatePill>`.
- Add a derived `modeLockLabel`: map `claimOwner` →
  `EvseClients.ocpp.id → 'OCPP'`, `rfid.id → 'RFID'`, `limit.id → 'LIMIT'`, else
  `''`.
- Wire: `ModePill` gets `mode`, `locked={modeLocked}`, `lockLabel={modeLockLabel}`,
  `disabled={busy || display === 'error'}`, `onmode={setMode}`. `RatePill` gets
  `amps={chargeAmps}`, `min={6}`, `max={maxAmps}`, `claimedBy={rateClaimedBy}`,
  `disabled={busy || ecoOn || display === 'error'}`, `onchange={setChargeAmps}`.

`ModeSelector.svelte` and `ChargeRate.svelte` files are left in the tree (no longer
imported) — removing them is out of scope; YAGNI says don't delete code other
things might still reference, but note they're now unused.

## Visual / placement

- Pills: `surface-2`-ish background, `border-border`, rounded-full, ~13px bold
  value, a tiny `▾`. A small uppercase `mode` / `rate` micro-label above each
  (per the mock).
- Mode pill pinned top-left of the ring wrapper, rate pill top-right, clear of the
  178px ring and its kW readout.
- Popovers open downward, edge-aligned (mode left, rate right), narrow (~150px /
  slider width), above sibling content (`z` over the chips).

## States & edge cases

- **Locked mode:** dim + short word (`OCPP`/`RFID`/`LIMIT`), no popover.
- **Eco owns rate:** rate pill dimmed, not openable; shows the claimed value.
- **Error display:** both pills dimmed/non-interactive (consistent with the old
  rows being hidden/disabled in error).
- **Failed rate write:** `rateNonce` bump remounts `RatePill`, reverting the
  shown amps — same mechanism as today.
- **Open popover + state change:** if a claim locks the mode while its popover is
  open, the lock takes precedence (popover closes / pill dims on next render).
- Only one popover need be open at a time in practice; each closes on outside click
  (which includes clicking the other pill).

## i18n

Reuse existing keys: `dashboard.mode.{label,auto,on,off}`, `dashboard.rate.{label,claimed}`.
The lock short words (`OCPP`/`RFID`/`LIMIT`) are fixed acronyms, not translated.
Add `dashboard.mode.aria` / `dashboard.rate.aria` accessible-name keys for the
pill buttons (e.g. "Charge mode", "Charge rate") in all four locales.

## Testing

- `ui/Popover.test.js` — opens on `open`, fires `onclose` on backdrop click and on
  Escape, applies right vs left alignment class.
- `dashboard/ModePill.test.js` — shows the current mode label; opening the popover
  and picking a mode calls `onmode(value)`; `locked` shows `lockLabel`, dims, and
  does not open a popover.
- `dashboard/RatePill.test.js` — shows `{amps} A`; opening and moving the slider
  calls `onchange(value)`; `disabled` blocks opening; `claimedBy` shows the hint.
- `routes/__tests__/Dashboard.test.js` — update: the mode/rate **rows** are gone
  (no `SegmentedControl` "Charge mode" row), the pills are present, and the wiring
  still fires the same writes (mode pick → override/clear; rate change → the
  serialized `/limit`-style override write as today). Adjust the existing
  "disables mode segments when RFID owns the claim" test to assert the **locked
  pill** (dimmed, shows `RFID`, no popover) instead of disabled segments.

Coverage stays scoped to `src/lib/**/*.js`; the new logic in the pills is mostly
presentational, so any pure mapping (e.g. `modeLockLabel`) that's worth unit-testing
lives in the Dashboard or a small helper.

## Out of scope

- Deleting the now-unused `ModeSelector.svelte` / `ChargeRate.svelte` files.
- Any change to the SOC bar, limit card, eco/shaper toggles, or boost button.
- The deferred SOC charging-pulse animation.
- Reworking the claims/priority model — only the *display* of the lock owner changes.
