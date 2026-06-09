# Desktop Layout Design

**Date:** 2026-06-09
**Status:** Approved (brainstormed interactively with visual mockups)

## Problem

The app is mobile-first. The only desktop adaptation today is the bottom nav
becoming an 80px icon rail at `sm:` (≥640px). Every page then renders as a
single column stretching the full remaining width — on a 1920px monitor the
dashboard ring, SOC bar, settings forms, and lists sprawl edge to edge.

## Goals

- Content never stretches edge-to-edge on desktop; every page centers at a
  comfortable max width.
- Use the width where it earns its keep (dashboard and monitoring become
  two-column) rather than uniformly shrinking a phone layout.
- Mobile (<640px) renders **exactly as today** — same DOM order, same visuals.
- The `sm:` tier (640–1023px) also stays exactly as today.

## Non-goals

- No dashboard rethink (no multi-panel status/schedule/history mashup).
- No new components, routes, or dependencies; no design-token changes.
- No changes to the Wizard (already centered at `max-w-md`) or modals.

## Breakpoint model

| Tier | Range | Behavior |
|------|-------|----------|
| mobile | <640px | unchanged: bottom nav, single column |
| `sm:` | 640–1023px | unchanged: 80px icon rail, single column |
| `lg:` | ≥1024px | new desktop layouts described below |

Implementation is Tailwind `lg:` utilities only.

## Nav rail (`BottomNav.svelte`)

At `lg:` the rail widens to `13rem` (`lg:w-52`) and each item becomes a
horizontal icon + label row, left-aligned (`lg:flex-row lg:justify-start
lg:gap-3 lg:px-5`, label text bumps from `text-[10px]` to `lg:text-sm`).
Active state remains `text-accent`; everything below `lg:` is untouched.

## Dashboard (`Dashboard.svelte`)

At `lg:` the section centers at `max-w-5xl` and lays out as a two-column grid
(`lg:grid lg:grid-cols-2 lg:gap-x-6 lg:items-start`):

- **Left column (act):** StatusLine, PowerRing + RatePill, ThrottleBadge,
  ChargeControls.
- **Right column (observe):** StatChips.
- **ChargeLimitCard (SOC bar + limits):** spans the full content width below
  the columns (`lg:col-span-2`) — the bar benefits from the horizontal room.
- **Chart hero:** when the Labs hero is active (`dev_features` on + charging —
  the *same* gating as today, unchanged), it spans the full content width
  above the columns (`lg:col-span-2`). When Labs is off or idle, the columns
  render without it.

Mobile DOM order must be preserved (StatusLine, ring, throttle, chips,
controls, limit card). Column grouping is CSS-only — wrapper divs with
`max-lg:contents` plus `max-lg:order-*` utilities on the blocks (or an
equivalent CSS-only mechanism) keep the mobile visual order identical while
letting `lg:` place blocks into the two columns.

## Settings

- **Index (`Settings.svelte`):** at `lg:` the section centers at `max-w-4xl`
  and the section cards flow into a 2-column grid (`lg:grid lg:grid-cols-2
  lg:gap-x-4 lg:items-start` — vertical rhythm comes from the cards' own
  `mb-4`). The Support card spans both columns at the
  bottom (`lg:col-span-2`).
- **Config pages (`ConfigPage.svelte`):** the shared wrapper constrains its
  content to a centered column at `lg:` (`lg:max-w-2xl lg:mx-auto`). This
  fixes all 17 settings pages in one place; individual pages don't change.

## Monitoring (`Monitoring.svelte` + tabs)

- The section centers at `max-w-5xl` at `lg:`.
- **Data tab:** metric-group cards flow into a 2-column grid (`lg:grid
  lg:grid-cols-2 lg:gap-x-3 lg:items-start` — `items-start` so an expanded
  card doesn't stretch its collapsed neighbor; vertical rhythm from the
  cards' own `mb-2`).
- **Safety / Manager tabs:** each is a single card of label/value rows (not a
  card list), so no grid — instead the card constrains to `lg:max-w-3xl
  lg:mx-auto lg:w-full` so rows don't stretch label-to-value across ~1000px.
- **Energy tab:** the chart keeps the full content width (no column split).
  uPlot already resizes via ResizeObserver; no chart code changes.

## Schedule & History

Both sections center at `lg:max-w-3xl lg:mx-auto`. No structural changes.

## Testing

- The full existing suite must pass unchanged — mobile markup and DOM order
  are untouched, so no existing assertions should need edits. If an existing
  test fails, the change broke the mobile contract; fix the change, not the
  test.
- Add light class-presence assertions (jsdom can't do responsive rendering):
  - BottomNav renders the five labels and carries the `lg:` rail classes.
  - Dashboard root carries the `lg:grid` classes; hero wrapper carries
    `lg:col-span-2` when shown.
  - ConfigPage wrapper carries the `lg:max-w-2xl` constraint.
  - Settings index grid carries `lg:grid-cols-2`; Support card
    `lg:col-span-2`.
- Manual verification on the mock dev server (`npm run dev:mock`) at 1280px
  and 1920px widths, plus a mobile-width regression eyeball.

## Risks / notes

- `max-lg:contents` + order utilities is the one structurally delicate piece
  (Dashboard). If it turns out fragile in practice, the fallback is
  duplicating nothing but accepting a *minor* mobile order change — that
  requires explicit sign-off; the default contract is "mobile unchanged".
- The Energy live chart on `sm:`/`lg:` already handles its SOC-axis
  responsiveness via a 640px media query; the desktop pass doesn't touch it.
