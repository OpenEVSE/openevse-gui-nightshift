# OpenEVSE GUI v3 — Schedule Screen

**Date:** 2026-05-21
**Status:** Approved design (autonomous build — designed directly from v2 + the locked v3 Aurora language per the AUTONOMOUS-RUNBOOK)
**Repo:** `/home/rar/openevse-gui-v3`
**Builds on:** the v3 foundation and Dashboard, both merged to `main`.

## Summary

The Schedule screen is v3's `/schedule` route, currently a placeholder. It lets the
user manage the OpenEVSE device's recurring charge **timers** — each timer turns the
EVSE active or disabled at a set time on chosen days of the week. It replaces v2's
"Scheduler" screen (`src/routes/Schedule.svelte` → `Timers.svelte` + `TimerModal.svelte`).

This is the third of five v3 plans. It depends only on the merged foundation +
Dashboard; it adds the Schedule route, four Schedule components, and one pure-logic
module. It reuses Dashboard's UI primitives (`Card`, `SegmentedControl`, `Modal`,
`Button`, `IconButton`, `Icon`) and adds no new device API surface.

## Goals

- List every configured timer, each showing its time, enabled/disabled state, and
  the days it runs.
- Add a new timer, edit an existing timer, and delete a timer.
- A timer editor (modal) with a 7-day picker (plus select-all), a time input, and an
  active/disabled selector — matching v2's editor feature-for-feature.
- Reproduce v2's rules exactly: at least one day must be selected; the device caps at
  50 timers; new-timer id = highest existing id + 1 (or 1 when the list is empty).
- Every piece independently testable; only the route talks to stores.

## Non-Goals (deferred / out of scope)

- The scheduled-**plan** view (`/schedule/plan`, the `plan_store`). v2's Scheduler
  screen does not render the plan; the `plan_store` feeds only the Dashboard's
  "Waiting · <time>" reason. The Schedule screen stays timers-only — see Decisions.
- Per-timer charge-current / limit fields. The device's timer record is
  `{id, state, time, days}` only; v2 exposes nothing more, and neither does v3.
- The Monitoring and History screens (their own plans).

## Data model

The `schedule_store` (already ported, identical to v2) holds an **array** of timer
objects. Each timer:

```js
{
  id: 3,                       // integer, unique within the list
  state: "active",             // "active" | "disabled"
  time: "07:30",               // "HH:MM" (download() slices the device's seconds off)
  days: ["monday", "tuesday"], // lowercase English day names, Monday-first
}
```

Store methods (all already exist):
- `download()` → `GET /schedule`, populates the array, returns `true`/`false`.
- `upload(timer)` → `POST /schedule` with the JSON timer, returns `true` on `msg:"done"`.
- `remove(id)` → `DELETE /schedule/<id>`, returns `true` on `msg:"done"`.

The device bumps `schedule_version` in `status_store` after a successful write;
`DataManager` re-downloads the store. The route also re-downloads immediately after a
write for instant feedback (mirrors how `Dashboard.svelte` re-downloads `limit_store`).

## Visual Design

Aurora theme (dark default / light), brand teal accent. Mobile-first, inside the
existing route content area. Mirrors the Dashboard's spacing and card idiom.

### Screen layout (top → bottom)

1. **Header row** — the screen title (`screen.schedule`) on the left; a small count
   (`"3 / 50"`) in `text-text-dim` on the right.
2. **Timer list** — a vertical stack of timer cards. When the list is empty, a
   centered empty-state card: a calendar icon, `schedule.empty` text.
3. **Add-timer button** — a full-width primary `Button` ("+ New timer") below the
   list. Disabled (40% opacity) when the list already holds 50 timers.

### Timer card (`TimerRow`)

A `Card` (`bg-surface-2`, rounded-2xl), comfortable touch height, horizontal layout:

- **Left:** the time, large and bold (`text-2xl font-extrabold text-text`), formatted
  via `displayTime` from `utils.js` (respects 12/24h). Below it, a small **state
  badge** — a pill: teal-tinted "Active" or muted "Disabled".
- **Middle:** a wrapping row of seven tiny **day chips** (Mon…Sun). A day that the
  timer runs renders filled (`bg-accent/15 text-accent`); a day it skips renders
  muted (`text-text-dim`). This gives an at-a-glance week pattern without a tooltip.
- **Right:** two `IconButton`s — edit (pencil) and delete (trash/×). The delete
  button shows a brief loading state while the `DELETE` is in flight.

Tapping the card body (anywhere outside the two buttons) also opens the editor —
a larger touch target than v2's tiny pencil link.

### Timer editor (`TimerModal`)

A `Modal`. Title: "New timer" or "Edit timer". Contents top → bottom:

1. **Day picker** (`DayPicker`) — seven toggle chips in a row (Mon-first), each a
   rounded button; selected = `bg-accent text-surface`, unselected =
   `bg-surface-3 text-text-dim`. Below them a single "Select all / Clear all"
   text button that flips with the current state.
2. **Time** — a labelled native `<input type="time">`, themed (border-border,
   bg-surface-2, text-text), full width.
3. **State** — a two-segment `SegmentedControl`: Active / Disabled.
4. **Validation message** — if the user tries to save with zero days selected, an
   inline `text-error` line appears: `schedule.error_no_day`.
5. **Actions** — a primary "Save" `Button` and a ghost "Cancel" `Button`. Save shows
   a loading state while the `POST` is in flight.

## Architecture

### Components

```
src/routes/Schedule.svelte                    composes the screen; the only store-aware unit
src/lib/components/schedule/
  TimerList.svelte                             the list of TimerRows, or the empty state
  TimerRow.svelte                              one timer card (time, state, day chips, edit/delete)
  TimerModal.svelte                            add/edit editor (DayPicker + time + state)
  DayPicker.svelte                             7 day-toggle chips + select-all/clear-all
src/lib/schedule/timers.js                     pure helpers (see Pure Logic)
```

Reused as-is: `Card`, `SegmentedControl`, `Modal`, `Button`, `IconButton`, `Icon`.
No new UI primitive is required — the day chips and the time input are plain themed
markup local to `DayPicker`/`TimerModal`.

Every Schedule component receives plain props and emits callbacks; none imports a
store. `Schedule.svelte` alone subscribes to `schedule_store`, passes the timer array
down, and routes add/edit/delete callbacks back to the store through `serialQueue`.

### Pure logic — `src/lib/schedule/timers.js`

All fully unit-tested, no store/DOM access:

- `DAYS` — the ordered array `['monday','tuesday',…,'sunday']` (Monday-first; the
  single source of truth for day order, used by the picker and the formatter).
- `nextTimerId(timers)` → highest `id` in the array + 1, or `1` when empty
  (reproduces v2's `TimerModal` id logic).
- `daysToFlags(days)` → `boolean[7]`, indexed Monday…Sunday, from a `days` array.
- `flagsToDays(flags)` → `string[]` of day names, from a `boolean[7]` array.
- `hasAnyDay(flags)` → `true` if at least one flag is set (the save-validation rule).
- `formatDayChips(days)` → `[{ key, label, on }]` for all seven days, for `TimerRow`'s
  chip strip. `label` is the 3-letter i18n abbreviation; `on` reflects membership.

### Data flow

`Schedule.svelte`:
- Reads `$schedule_store` (the timer array).
- Local `$state`: `editorOpen`, `editingTimer` (the timer object being edited, or
  `null` for a new one), `busy` (a write is in flight).
- **Add:** opens the editor with `editingTimer = null`.
- **Edit:** opens the editor with `editingTimer = <the row's timer>`.
- **Save** (from the modal's `onsave`): builds the timer object — for a new timer,
  assigns `id = nextTimerId($schedule_store)` — then
  `serialQueue.add(() => schedule_store.upload(timer))`. On success, closes the
  editor and `serialQueue.add(() => schedule_store.download())` to refresh. On
  failure, surfaces the global `AlertBox` via `uistates_store` and keeps the editor
  open.
- **Delete:** `serialQueue.add(() => schedule_store.remove(id))`. On success,
  re-downloads. On failure, surfaces the `AlertBox`.

### Controls / write rules

- All writes go through `serialQueue` (the device web server is single-threaded).
- While any write is in flight, `busy` is `true`; the add button, row buttons, and
  the modal's Save are disabled to prevent overlapping commands.
- New-timer id assignment and the "≥ 50 → add disabled" cap reproduce v2 exactly.

## Error Handling

- A failed `upload` or `remove` surfaces the global `AlertBox` (title
  `schedule.error_title`, body `schedule.error_body`) through
  `uistates_store.setAlertBox(...)`, and the store array is left untouched — the UI
  never shows a timer the device did not confirm. (This is the failed-write/AlertBox
  pattern; the cross-cutting shared helper is the separate follow-up work item.)
- Saving with zero days selected never reaches the device — `TimerModal` blocks it
  and shows the inline validation message.
- `schedule_store` undefined/empty at first paint resolves to the empty-state card;
  all reads use optional chaining / default to `[]`.

## Testing

- **`src/lib/schedule/timers.js`** — pure functions unit-tested: `nextTimerId`
  (empty list, gaps, unsorted ids), `daysToFlags`/`flagsToDays` round-trip,
  `hasAnyDay`, `formatDayChips` (order, abbreviations, on/off).
- **`DayPicker`** — toggling a chip fires `onchange` with the updated flags;
  select-all/clear-all flips every flag.
- **`TimerRow`** — renders time, state badge, day chips; edit/delete/body callbacks
  fire.
- **`TimerModal`** — closed renders nothing; open pre-fills from `editingTimer` (and
  defaults for a new timer); zero-day save is blocked with the inline message; a
  valid save fires `onsave` with the correct `{id?, state, time, days}`.
- **`TimerList`** — empty array → empty state; non-empty → one row per timer.
- **`Schedule.svelte`** — integration test with a mocked `schedule_store`: the list
  renders the timers; opening the editor and saving invokes `schedule_store.upload`;
  delete invokes `schedule_store.remove`.
- Vitest + `@testing-library/svelte`; coverage scoped to `src/lib`.

## Mock fixture

`dev/fixtures/schedule.json` is currently `[]`. Enrich it with 2–3 representative
timers (varied times, states, and day sets) so the screen is viewable via
`npm run dev:mock`. Shape must match the store's post-`download()` array (`time` as
`"HH:MM"`). `/api/schedule` is already served by `dev/mock-plugin.js`.

## Decisions (judgment calls — per locked decision #2, recorded here)

1. **Plan view excluded.** v2's Scheduler screen renders only the timer list
   (`Timers.svelte`); it never touches `/schedule/plan`. The `plan_store` exists in
   v3 solely for the Dashboard's "Waiting" reason. Adding a plan/next-event panel
   would be a *new* feature, which locked decision #1 forbids. Schedule stays
   timers-only.
2. **Day chips replace v2's calendar-icon tooltip.** v2 showed an `ion:calendar`
   icon with the day list hidden in a hover tooltip — invisible on touch devices.
   v3 renders all seven days as inline chips (filled/muted). This is the same
   information presented in the locked Aurora visual language, not a new feature.
3. **State control is a 2-segment `SegmentedControl`,** not v2's `<select>` — it
   matches the Dashboard's `ModeSelector` idiom and the existing v3 primitive set.
   The underlying values stay the device's `"active"`/`"disabled"` strings.
4. **Whole-card tap opens the editor,** in addition to the explicit edit icon. v2's
   editor was reachable only via a small pencel link; a full-card touch target is
   the v3-consistent, mobile-first choice and adds no feature.
5. **Day order is Monday-first,** matching v2's `default_timer.days` order and the
   v2 editor's checkbox order.
6. **After a successful write the route re-downloads `schedule_store`** rather than
   locally splicing/pushing the array (v2 did both). Re-download is the single
   source of truth and matches `Dashboard.svelte`'s `limit_store` pattern.

## Open Questions

None. All design decisions for this screen are resolved.
