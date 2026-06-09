# Limit Pills Design (Charge-Limit Card v2)

**Date:** 2026-06-09
**Status:** Approved (design B, mockups validated interactively)

## Problem

The charge-limit card makes SOC/Range limits first-class (the draggable bar)
while time/energy limits live in a small text row + a settings modal. Upstream
wants time and energy limits as prominent as the SOC bar. Chosen direction:
**type pills above one prominent editor slot** — every limit type gets the
same bar-style, inline treatment; the modal and the text row are removed.

## Decisions locked during brainstorming

- SOC and Range are **separate pills**; the bar's internal %/km unit toggle is
  removed (the pill is the unit choice).
- The set-limit modal (`ChargeLimitModal`) is **removed entirely** — inline
  editors are the only way to set limits from the dashboard.
- Time scale 0–8 h (15-min steps); energy scale 0–100 kWh (1-kWh steps).
- Applies at **all widths** (the card is shared mobile/desktop).

## Card anatomy (`ChargeLimitCard.svelte`)

```
[ SOC ] [ Range ] [ Time ] [ Energy ]     ← pill row (the only type selector)
[ ─────────────── editor slot ─────────────── ]
```

- **Pill availability:** SOC always when `hasSoc`; Range when `hasSoc` AND
  `Number.isFinite(estMaxRange)` (same condition as today's unit toggle);
  Time and Energy always. Without a vehicle the row is just `Time · Energy`.
- **Selection:** card-local state. Default = the active limit's pill when one
  is set; else SOC (or Time when `!hasSoc`). A user's manual pick overrides
  the default until the active limit's type changes (`userPick ?? default`,
  mirroring the Dashboard's existing `userUnit ?? …` pattern).
- **Active dot:** the pill whose type matches the active limit carries a
  small accent dot, visible even while another pill is selected.
- **Replacement semantics:** the device holds ONE limit; committing from any
  editor replaces the active limit. No confirmation — same as today's bar.

### SOC / Range editors

Today's `VehicleSocBar`, unchanged except:
- the header unit toggle (`showUnitToggle` block, `onunit`, `unit_aria`) is
  deleted — `unit` stays a prop, now driven by the selected pill;
- everything else (knob, ceiling snap-to-clear, vehicle pin, progress line)
  is untouched.

The card maps pill→unit and forwards to the existing Dashboard plumbing:
selecting SOC/Range calls the existing `onunit('percent' | 'range')` so the
Dashboard's `userUnit`/`limitUnit`/`setTarget` machinery is reused as-is.

### Time / Energy editors — new `LimitSliderBar.svelte`

One component, same visual language as the SOC bar (34px rounded track,
invisible `<input type=range>` overlay, knob + value pill):

- **Props:** `kind` (`'time' | 'energy'`), `value` (device units — minutes or
  Wh — of the active limit of this kind, else 0), `progress` (session elapsed
  seconds / session energy Wh), `charging`, `disabled`,
  `onchange(deviceValue)` (0 = clear).
- **Scale:** time → 0–480 min, step 15, knob pill shows `H:MM`; energy →
  0–100 kWh, step 1, shows `N kWh`. Device units convert at the edge
  (energy Wh ↔ kWh ×1000; time stays minutes).
- **Fill:** live progress toward the limit while it's active and charging
  (`progress / value`, capped 100%), using the charging shimmer like the SOC
  bar; no fill when no limit of this kind is active.
- **Header line:** active → remaining (`hmsShort(value*60 − elapsed)` /
  `(value − sessionWh)/1000 kWh` + the existing `dashboard.limit.left`
  string); inactive → a "drag to set" hint.
- **Clearing:** dragging the knob to 0 commits `onchange(0)` (mirror of the
  SOC bar's drag-to-ceiling clear). Knob renders dimmed at 0 (no limit), like
  the SOC bar's at-rest state.
- **No-change suppression:** `onchange` fires only when the committed value
  differs from the current `value` prop — so nudging an already-empty editor
  to 0 emits nothing (otherwise it would DELETE an active limit of a
  *different* type).

### What's removed

- The divider + compact text row (summary, ×, "+ Set"), the `clearable`,
  `summary`, `onopen`, `onclear` props.
- `ChargeLimitModal.svelte` + its test + the Dashboard's `limitModalOpen` /
  modal render / modal-specific bits of `saveLimit`.
- `VehicleSocBar`'s unit toggle block.
- i18n: `dashboard.limit.{none,set,clear,type,type_none,hours,minutes,energy_value,save,or_limit_by}`
  and `dashboard.vehicle.unit_aria` (all four locales).
- i18n added: `dashboard.limit.{type_soc,type_range,drag_to_set,pills_aria}`
  (`type_time`/`type_energy`/`label`/`left` are kept and reused). Parity
  maintained across en/es/fr/hu.

## Dashboard wiring (`Dashboard.svelte`)

- New handler `setInlineLimit({ type, value })`: `value > 0` → existing
  `limit_store.upload({type, value, auto_release: true})` + re-download
  (reuses `saveLimit`'s body); `value === 0` → `clearLimit()` **guarded by
  `systemLimit`** (a system limit is never DELETEd — no-op + `socNonce++`
  snap-back instead, consistent with the shipped system-limit rules).
- Card props: drop `summary`/`onopen`/`onclear`/`clearable`; add
  `limitActive` data the editors need: `elapsedSec={$status_store?.session_elapsed ?? 0}`,
  `sessionWh={$status_store?.session_energy ?? 0}`, `systemLimit`,
  `onlimit={setInlineLimit}`. Keep `limit`, `charging`, `unit`, `onunit`,
  `ontarget`, and the bar inputs as today.
- **System limits:** the active system limit's editor renders `disabled`
  (read-only bar with progress; knob inert). Other pills' editors stay
  enabled — committing them POSTs a user limit that overrides the default
  for the session (allowed today via the SOC bar; the config default is
  untouched). The clear path is the only thing systemLimit blocks.
- `limitSummary` (row-only) is removed; `formatLimit` stays (ring reason).
- `limitTripped` / ring-reason behavior unchanged.

## Testing

- **LimitSliderBar:** value→knob geometry (time minutes→position, energy
  Wh→kWh), commit emits device units, drag-to-0 emits 0, disabled blocks
  input, remaining/header strings, progress fill caps at 100%.
- **ChargeLimitCard:** pill row per `hasSoc`/`estMaxRange` (4 / 2 pills);
  default selection (active limit type wins; SOC/Time fallback); active dot;
  SOC pill renders the bar, Time pill renders the slider; pill click calls
  `onunit` for SOC/Range; no modal trigger, no clear ×, no "+ Set".
- **Dashboard:** existing SOC-bar tests unchanged; modal upload test replaced
  by an inline-editor commit test (`POST /limit` time payload); system-limit
  tests updated — assert the active system editor is disabled instead of the
  removed ×; drag-to-0 with a system limit issues no DELETE (mutation-style
  negative with flush, matching the shipped guard tests).
- Locale parity check after key changes.

## Risks / notes

- The card's tests and the system-limit guard tests overlap — rewrite, don't
  weaken: every removed × assertion is replaced by a disabled-editor
  assertion of equal strength.
- `VehicleSocBar` keeps its `unit` prop contract, so `setTarget`'s
  range↔percent mapping is untouched.
- Time limits over 8 h set elsewhere (REST, system default) still display:
  the bar clamps the knob render at the max but the header shows the true
  remaining; committing a drag then writes ≤8 h (acceptable, documented).
