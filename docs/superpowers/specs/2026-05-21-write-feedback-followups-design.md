# OpenEVSE GUI v3 — Write-Feedback Follow-ups

**Date:** 2026-05-21
**Status:** Approved design (autonomous build — the 4th work item of the AUTONOMOUS-RUNBOOK)
**Repo:** `/home/rar/openevse-gui-v3`
**Builds on:** the v3 foundation + all four screens (Dashboard, Schedule, Monitoring, History), merged to `main`.

## Summary

Two cross-cutting follow-ups deferred from the Dashboard plan, now that all four
screens exist:

**A. Eco / Shaper handlers.** `src/routes/Dashboard.svelte` passes `onEco` / `onShaper`
to `EcoShaperToggles` as no-op stubs (`() => {}`). Wire them to the device.

**B. Failed-write feedback.** Device control writes are optimistic — on a failed
write the UI can show a state the device never confirmed, with no error surfaced.
Add: a failed write surfaces the global `AlertBox`, and a control that has visually
moved reverts to the device's confirmed value.

## Goals

- Eco and Shaper toggles on the Dashboard actually drive the device.
- One shared write-error pattern across every screen: a failed device write surfaces
  the global `AlertBox`.
- No control shows a state the device did not confirm — the one genuinely optimistic
  control (the charge-rate slider) reverts on a failed write.

## Non-Goals

- New screens or new controls.
- Retrying failed writes automatically — the user retries.
- Changing the device API surface.

## Follow-up A — Eco / Shaper handlers

v2's `Manual.svelte` drives these two device endpoints (both `text`-type POSTs):

- **Eco** is solar divert. `POST /divertmode` with body `divertmode=2` (eco on) or
  `divertmode=1` (eco off / fast).
- **Shaper** is the current shaper. `POST /shaper` with body `shaper=1` (on) or
  `shaper=0` (off).

`Dashboard.svelte` gains `setEco(on)` and `setShaper(on)` handlers — each routes its
POST through `serialQueue`, guards against overlapping commands with the existing
`busy` flag, and on failure surfaces the write-error `AlertBox`. They are passed to
`EcoShaperToggles` in place of the stubs.

The Eco and Shaper toggles display store-derived state (`ecoOn` from
`status.divertmode`, `shaperOn` from `uistates.shaper`) — they are already
pessimistic (the toggle only moves when the store changes), so no revert is needed;
only the `AlertBox` on failure.

## Follow-up B — Failed-write feedback

### Shared helper — `src/lib/alerts.js`

A single function, `showWriteError()`, populates the global alert via
`uistates_store.setObject('alertbox', …)` — the same alert `App.svelte` already
renders. Title/body come from a new `alert.*` i18n block; the OK action resets the
alert. Every screen calls this one helper, so the write-failure experience is
identical everywhere. The Schedule route's existing inline `alertFail` is replaced
by this shared helper.

### The optimism fix — `override_store.upload`

`override_store.upload` currently POSTs to `/override` and then **unconditionally**
updates the store and returns the store object — it neither detects failure nor
signals it. This is the root of the optimism: a failed mode/rate change still
updates the store.

`upload` is changed to the same failure convention every other store uses
(`httpAPI` returns the string `"error"` on a failed request; a `msg: "error"` body
is also a failure): it updates the store **only on success** and returns a boolean.
This makes the override-backed controls pessimistic — the store, and therefore the
controls derived from it, reflect only what the device confirmed. `download`,
`clear`, `toggle`, and `removeProp` already return booleans and are unchanged.

### Dashboard control writes

With `override_store.upload` and `limit_store.upload`/`remove` all returning a
reliable boolean, every `Dashboard.svelte` write path checks the result:

- `setMode` — Auto (`override_store.clear`) / On / Off (`override_store.upload`):
  on failure, `showWriteError()`.
- `setChargeAmps` — the amps slider's `override_store.upload`: on failure,
  `showWriteError()` **and** the slider reverts (see below).
- `saveLimit` / `clearLimit` — `limit_store.upload` / `remove`: on failure,
  `showWriteError()` (and `saveLimit` only re-downloads on success).
- `setEco` / `setShaper` — the `text` POSTs: on failure, `showWriteError()`.

### Slider revert

The mode segmented control, the limit card, and the Eco/Shaper toggles all render
store-derived state — they cannot show an unconfirmed state, so they need no revert.
The **charge-rate slider** is the exception: it is a native `<input type="range">`,
and once the user drags the thumb the browser keeps it there even though the bound
`value` (store-derived `chargeAmps`) is unchanged after a failed write.

Fix: `Dashboard.svelte` holds a `rateNonce` counter and wraps `<ChargeRate>` in
`{#key rateNonce}`. On a failed `setChargeAmps` write, `rateNonce` is bumped, which
remounts `ChargeRate` (and its slider) so the thumb re-reads the device-confirmed
`chargeAmps`. The nonce is bumped only on failure — remounting on success would
flicker, since the confirmed value arrives slightly later via the version-bump
re-download.

## Architecture

```
src/lib/i18n/en.json                 (modify — add the "alert" block)
src/lib/alerts.js                     NEW — showWriteError() shared helper
src/lib/stores/override.js            (modify — upload: pessimistic + boolean return)
src/routes/Dashboard.svelte           (modify — wire Eco/Shaper, check writes, slider revert)
src/routes/Schedule.svelte            (modify — use the shared showWriteError helper)
```

`showWriteError` lives in `src/lib/` (not a component) because it is called from
route logic, not markup. It reads i18n via `get(_)` — the same pattern `getStateDesc`
in `utils.js` already uses.

## Error Handling

- A failed write never leaves the UI ahead of the device: stores update only on
  confirmed success, and the one optimistic control (slider) reverts.
- `showWriteError()` is idempotent — repeated failures just re-show the alert.
- The alert is dismissible (the existing `AlertBox` OK button / backdrop).

## Testing

- **`src/lib/alerts.js`** — `showWriteError()` sets `uistates_store.alertbox`
  visible with the alert title/body and a working reset action.
- **`override_store.upload`** — updates the store and returns `true` on a successful
  POST; returns `false` and leaves the store unchanged when `httpAPI` yields
  `"error"` (or a `msg: "error"` body).
- **`Dashboard.svelte`** — with mocked stores/`httpAPI`: a failed mode write surfaces
  the alert; the Eco and Shaper toggles invoke the `/divertmode` and `/shaper`
  endpoints with the right body.
- **`Schedule.svelte`** — the existing failed-write test still passes against the
  shared helper.
- Existing screen tests must stay green.
- Vitest + `@testing-library/svelte`; coverage scoped to `src/lib`.

## Decisions (judgment calls — per locked decision #2, recorded here)

1. **`override_store.upload` is made pessimistic.** v2's (and the v3 port's) `upload`
   updated the store before the device confirmed and returned the store object. The
   follow-up's premise — "control writes are currently optimistic" — *is* this
   behavior. Changing `upload` to update-on-success and return a boolean is the fix,
   and it uses the exact failure convention (`"error"`) already used by `download`,
   `clear`, `schedule_store`, and `limit_store`.
2. **One generic write-error message** (`alert.write_failed_*`) for every screen,
   rather than per-screen copy. The runbook asks for "one pattern"; a single helper
   with one message is that pattern. The Schedule route's previous screen-specific
   `schedule.error_*` strings remain in `en.json` (still referenced by the
   `schedule-i18n` test) but are no longer used by the route.
3. **Only the charge-rate slider gets an explicit revert.** Every other control
   renders store-derived state and is already pessimistic. Auditing them and finding
   the slider the sole optimistic case is the correct minimal fix — not a blanket
   remount of every control.
4. **The Eco/Shaper failure path surfaces the alert but does not revert** — the
   toggles are store-derived and pessimistic, so there is nothing to revert.

## Open Questions

None. All design decisions for these follow-ups are resolved.
