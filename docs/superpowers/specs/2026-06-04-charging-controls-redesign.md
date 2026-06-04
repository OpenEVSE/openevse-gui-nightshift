# Charging-Page Controls Redesign

**Goal:** Replace the dashboard's separate Mode pill + floating Eco/Shaper toggle row with one unified control panel — a segmented mode control (`Off · Auto · Eco · On`) plus a Shaper/Boost modifier row — so the charging screen's session controls read as one consistent group.

**Approach:** "Eco as a peer mode." Eco/Solar becomes a top-level segment beside Off/Auto/On (selecting it sets Auto + divert under the hood). Shaper and Boost remain distinct modifiers below the segments. The mode control leaves the hero (ring overlay and chart top row) and lives in the panel below the hero, in the same place whether the hero shows the ring or the session chart.

**Scope:** Controls only. The Power ring, session chart internals, Rate pill, Stat chips, Charge-limit card, Status line, Vehicle SoC bar, and Boost timer logic are unchanged. The mockups redrew the whole screen only for realistic context; nothing outside the control cluster changes.

---

## Background — what exists today

The dashboard (`src/routes/Dashboard.svelte`) renders, top to bottom: hero (ring or `ChargingHero` chart), `ThrottleBadge`, `StatChips`, `EcoShaperToggles`, `ChargeLimitCard`, `BoostButton`.

- **Mode** is a `ModePill` (`Auto / On / Off`) overlaid top-left on the ring, and also in the top row of the chart hero. Backed by `override_store`: Auto = clear override, On = `state:'active'`, Off = `state:'disabled'` (both with `auto_release:false`).
- **Eco** and **Shaper** are two `Toggle`s in a centered row (`EcoShaperToggles.svelte`). Eco posts `/divertmode` (`divertmode=2` on, `=1` off); Shaper posts `/shaper` (`shaper=1|0`). Both are independent of the override claim.
- `ecoOn` is derived as `divertmode === 2 && mode === 0` — Eco only takes effect in Auto.
- **Boost** (`BoostButton`) is a separate full-width button: idle opens a preset modal (15/30/60 min); active shows an inline "Boosting · MM:SS" countdown with Cancel.
- When OCPP/RFID/a Limit claim owns charging, `modeLocked` is true and `modeLockLabel` is `OCPP`/`RFID`/`LIMIT`; the Mode pill shows that label and is disabled.

OhmConnect was never a dashboard control (config-only in v2 and v3) and stays out.

---

## The unified panel

A new component, `ChargeControls.svelte`, rendered where `EcoShaperToggles` is today (between `StatChips` and `ChargeLimitCard`). It owns the segmented mode control + the modifier row. `BoostButton`'s logic is reused inside the modifier row (see Boost below). The standalone `ModePill` is removed from the hero in both ring and chart variants; `EcoShaperToggles.svelte` is deleted.

### Segmented mode control

A single segmented control. Segments, in order: **Off · Auto · Eco · On**.

- **Eco segment is conditional** on `config.divert_enabled`. When divert is disabled the control is three segments (`Off · Auto · On`) — so only solar/divert users ever see the tighter four-segment layout.
- Text-only labels, no icons. Selected segment uses the accent fill with the accent glow; unselected use `text-dim`.

**Selection → device actions** (all writes via `serialQueue`, mirroring today's `setMode`/`setEco`):

| Segment | Action |
|---|---|
| Off | `override_store.upload({state:'disabled', charge_current, auto_release:false})` |
| Auto | clear override (`override_store.clear()`) **and** `POST /divertmode divertmode=1` |
| Eco | clear override (`override_store.clear()`) **and** `POST /divertmode divertmode=2` |
| On | `override_store.upload({state:'active', charge_current, auto_release:false})` |

Auto and Eco both force the divert state explicitly so the control lands on the intended segment regardless of the prior divert value (e.g. On→Auto must turn divert off; On→Eco must turn it on).

**Selected-segment derivation** (preserves today's semantics):

```
if mode === 1 (override active)      → "On"
else if mode === 2 (override disabled) → "Off"
else /* Auto: override cleared */:
    divertmode === 2 ? "Eco" : "Auto"
```

(`mode` here is the existing derived charging mode in `Dashboard.svelte`; `divertmode` from `status_store`.)

**Eco ↔ Rate coupling (unchanged behavior):** when Eco is the selected segment, divert owns the charge current, so the Rate pill is shown disabled/dimmed — this is exactly today's `rateDisabled = busy || ecoOn || ...`. No change to the Rate pill itself.

### Modifier row

Below the segments, a row of modifier buttons distinct in style from the mode segments (outlined buttons, not filled segments), so it's visually clear they're a different kind of control (sticky/independent, not part of the exclusive mode choice).

- **Shaper** — conditional on `config.current_shaper_enabled`. A toggle button: outlined when off, accent outline + glow when on. Click posts `/shaper shaper=1|0` (today's `setShaper`). Reflects `uistates_store.shaper`.
- **Boost** — always present. Reuses the existing `BoostButton` behavior verbatim: idle button opens the 15/30/60 preset modal; while active it becomes the inline "Boosting · MM:SS" countdown + Cancel. The boost timer, override save/restore, and `boostEndsAt` logic in `Dashboard.svelte` are unchanged — only the button's placement moves into the modifier row.

**Row layout:** two-up grid when both Shaper and Boost are present; single full-width button when only Boost is present (Shaper disabled in config). When Boost is **active**, its "Boosting · MM:SS" countdown card spans the full row width, and Shaper (if enabled) moves to its own full-width button row directly above the boost card. When Boost is idle, the two-up grid resumes.

### Locked state

When `modeLocked` is true, the segmented control is **removed entirely** (not greyed) and replaced, in the same vertical slot, by a status box: a dashed-border container with centered text **"Controlled by {OCPP|RFID|LIMIT}"** in `text-dim`. Text-only — no icon, no status dot.

- The label maps from the existing `modeLockLabel` (`OCPP`/`RFID`/`LIMIT`); the i18n string is `dashboard.controls.locked_by` with a `{owner}` placeholder.
- The dashed box is sized to roughly match the segment-row height to minimize layout reflow when a claim is acquired/released.
- **Modifiers while locked:** Shaper and Boost remain visible but disabled/dimmed (consistent with how external control supersedes user actions). They are not removed.

---

## Components & data flow

| File | Change |
|---|---|
| `src/lib/components/dashboard/ChargeControls.svelte` | **New.** Segmented mode control + modifier row + locked box. Props: current segment, `divertEnabled`, `shaperEnabled`, `shaperOn`, `locked`, `lockLabel`, `disabled`, boost props (`boostEndsAt`), and callbacks `onsegment(seg)`, `onshaper(on)`, `onboost(min)`, `oncancelboost()`. Pure presentational; all device writes happen in the parent's handlers. |
| `src/lib/components/dashboard/EcoShaperToggles.svelte` | **Delete.** Replaced by `ChargeControls`. |
| `src/lib/components/dashboard/BoostButton.svelte` | **Keep**, rendered inside `ChargeControls`'s modifier row (or its markup folded into `ChargeControls` — implementer's call; behavior must be identical). |
| `src/routes/Dashboard.svelte` | Replace `EcoShaperToggles` + standalone `BoostButton` usage with `ChargeControls`. Add a `setSegment(seg)` handler implementing the segment→action table (reusing `setMode`/`setEco` internals). Compute the derived selected segment. Remove the `ModePill` import/usage from the ring-variant overlay. |
| `src/lib/components/dashboard/ChargingHero.svelte` | Remove `ModePill` from the chart top row (mode now lives in `ChargeControls` below the hero). Top row keeps status text + Rate pill. |
| `src/lib/components/dashboard/ModePill.svelte` | Likely **delete** once no longer referenced (verify no other importers). |
| `src/lib/i18n/{en,es,fr,hu}.json` | New keys (below), all four locales. Reuse existing `dashboard.mode.*`, `dashboard.eco`, `dashboard.shaper`, `dashboard.boost.*` where possible. |

### i18n keys (4 locales)

- `dashboard.controls.locked_by` — "Controlled by {owner}" (interpolates `{owner}`).
- Segment labels reuse `dashboard.mode.off/auto/on`; Eco reuses `dashboard.eco`.
- Shaper/Boost labels reuse existing `dashboard.shaper` and `dashboard.boost.*`.

(Confirm during implementation which of these already exist; add only what's missing. Parity test `src/lib/i18n/__tests__/locale-parity.test.js` must stay green.)

---

## Testing

`.svelte` files are outside the coverage scope (`src/lib/**/*.js` only), but `ChargeControls` warrants a component test like the existing dashboard component tests (which mock `svelte-i18n`):

- **Segment selection derivation** — a small pure helper `selectedSegment({mode, divertmode, divertEnabled})` returning `'off'|'auto'|'eco'|'on'`, unit-tested for: On (mode 1), Off (mode 2), Auto (mode 0, divert 1), Eco (mode 0, divert 2), and the divert-disabled case (no Eco segment, divert value ignored). Put this helper in a `.js` module so it's inside coverage.
- **Component test** for `ChargeControls`: renders 4 segments when `divertEnabled`, 3 when not; emits `onsegment` with the right key on click; renders the locked box (and hides segments) when `locked`, with the owner label; modifiers dimmed/disabled when locked; Shaper hidden when `!shaperEnabled`.
- Full suite (`npm test`) stays green; no regression in existing dashboard tests.

---

## Out of scope

- Power ring, session chart internals, Stat chips, Charge-limit card/modal, Status line, Vehicle SoC bar — unchanged.
- OhmConnect / schedule / any net-new dashboard switch.
- Rate pill widget (only its disabled-on-Eco behavior is reused, already present).
- Boost timer/override-restore logic (reused verbatim).
