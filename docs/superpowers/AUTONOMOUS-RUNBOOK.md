# v3 Autonomous Build Runbook — Schedule, Monitoring, History

> **You (a post-compaction Claude) are executing this unattended while the user sleeps.**
> The user explicitly authorized autonomous design + build of the remaining three v3
> screens and two follow-ups. Work continuously. Do not wait for input. Follow this
> runbook end to end, then post a summary.

## Mission

Build the three remaining OpenEVSE GUI v3 screens — **Schedule**, **Monitoring**,
**History** — and fold in **two follow-ups** (Eco/Shaper handler wiring; failed-write
revert + AlertBox). Each lands on `main` when green.

## Locked decisions (from the user — do NOT revisit)

1. **Design basis:** each screen faithfully reproduces v2's feature set, rebuilt in the
   locked v3 Aurora design language + architecture. No features added or dropped.
2. **On ambiguity:** pick the option most consistent with v2 and existing v3 patterns,
   record the decision + rationale in the spec's "Decisions" section, and continue.
3. **Merge strategy:** each screen goes spec → plan → build → final review →
   (tests + build green) → merge to `main`. Same as Foundation and Dashboard.
4. **Follow-ups:** wire the Eco/Shaper handlers and add failed-write revert + AlertBox.
   Included in this run (4th work item).

## Where things stand

- Repo: `/home/rar/openevse-gui-v3`, branch `main`. Foundation + Dashboard merged.
  239 tests passing, clean build.
- v2 reference repo: `/home/rar/openevse-gui-v2` (the functional spec for these screens).
- Stack: Svelte 5 (runes), Vite 8, Tailwind 4, `svelte-i18n`, Vitest +
  `@testing-library/svelte`. Design: Aurora dark(default)/light, brand teal, keyhole gear.

## The reference exemplar — copy this pattern

Before each screen, read the Dashboard spec and plan and mirror their structure,
task granularity, and conventions:
- `docs/superpowers/specs/2026-05-21-dashboard-screen-design.md`
- `docs/superpowers/plans/2026-05-21-dashboard.md`

The Dashboard's code (`src/routes/Dashboard.svelte`, `src/lib/dashboard/state.js`,
`src/lib/components/dashboard/*`, `src/lib/components/ui/*`) is the architectural
template.

## Architecture rules (non-negotiable)

- The **route component is the only store-aware unit.** Sub-components take plain props
  and emit callbacks; they never import stores.
- **Pure logic** (state derivation, formatting, mapping) goes in a `src/lib/<screen>/`
  module and is fully unit-tested.
- New **UI primitives** are built just-in-time in `src/lib/components/ui/`.
- **Screen components** live in `src/lib/components/<screen>/`.
- All device writes go through `serialQueue` (`src/lib/queue.js`).
- **i18n:** every user-facing string via `$_()`. Add a screen block to
  `src/lib/i18n/en.json` as the first task of each plan.
- **Styling:** Tailwind theme tokens only (`bg-surface`, `bg-surface-2`, `text-text`,
  `text-text-dim`, `text-accent`, `border-border`, `text-error`, `text-warning`) —
  never raw hex.
- **Svelte 5 runes** throughout (`$props`, `$state`, `$derived`, `$effect`,
  `{@render children?.()}`).
- **TDD:** write the failing test, run it red, implement, run it green, commit.
  Frequent small commits.

## Key technical facts & gotchas

- **Field interpretation** (confirmed against a live device): `status.power` = watts
  (kW = `/1000`); `status.amp` = milliamps (A = `/1000`); `status.session_energy` = Wh
  (kWh = `/1000`); `status.temp` = tenths of °C (use `temp_round` from `utils.js`);
  `voltage`, `pilot` used directly; `total_day`, `total_energy` = kWh.
- **Vite 8:** every `import` path — including `vi.mock()` targets in tests — must
  resolve to a file that exists on disk. If a test mocks a not-yet-created module,
  the module must exist first (or create a stub).
- `httpAPI` lives at `src/lib/api/httpAPI.js`; in dev it prefixes request URLs with
  `/api`. Stores import `httpAPI` from `../api/httpAPI.js`.
- **Read each store file** (`src/lib/stores/*.js`) before using it — confirm the exact
  export name and method signatures and what `download()` treats as success. Note:
  the certificates store exports `certificate_store` (singular).
- **Test i18n mock pattern** (used in every component test):
  ```js
  vi.mock('svelte-i18n', () => {
    const t = (k) => k
    t.subscribe = (fn) => { fn(t); return () => {} }
    return { _: t }
  })
  ```
- **Commits:** plain `git commit` — NO `-c user.name/user.email` override (the machine
  identity is correct). End every commit message with:
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- `getStateDesc`/`state2icon` in `utils.js` return v2-era Bulma class names and the
  `logs-states.*` i18n keys (those keys now exist in `en.json`). Monitoring/History may
  surface these — re-style as needed for v3.

## Process per screen (do Schedule, then Monitoring, then History)

1. **Explore** v2's equivalent screen (files listed below). Understand the full feature
   set and the stores/endpoints it uses.
2. **Write the design spec** → `docs/superpowers/specs/2026-05-22-<screen>-screen-design.md`
   (use the actual current date). Cover: goals, non-goals, visual design (describe it —
   no mockups, the user is asleep; reuse the Aurora language and the Dashboard's
   conventions), architecture (components, data flow, pure-logic module), controls,
   error handling, testing, and a **Decisions** section recording any judgment calls.
   Self-review: placeholders, internal consistency, scope, ambiguity. Commit to `main`.
   **Skip the interactive brainstorming skill and visual companion** — the user
   pre-authorized designing directly from v2 + the locked v3 language.
3. **Write the plan** — invoke the `superpowers:writing-plans` skill. Output to
   `docs/superpowers/plans/2026-05-22-<screen>.md`. Bite-sized TDD tasks, complete code
   in every step, exact file paths. Self-review against the spec. Commit to `main`.
4. **Create a `<screen>` git branch.**
5. **Execute** — invoke `superpowers:subagent-driven-development`. One implementer
   subagent per task (model: `sonnet`). Controller-verify each task (tests pass).
   Dispatch a reviewer for the route/integration task and a final comprehensive review
   (model: `opus`). Fix review issues before merge.
6. **Finish** — invoke `superpowers:finishing-a-development-branch`. The user chose
   "merge to main when green": merge, verify tests on the merged result, delete branch.
   (You may execute the merge directly per the locked decision — do not pause to ask
   the 4-option menu; the user already answered it.)
7. **Visual check** — start `npm run dev:mock`, drive it with Playwright (the harness
   at `/tmp/pw-verify/` with `playwright-core` + chromium is already installed; reuse
   the `dash.mjs` script pattern: goto, wait, screenshot, report console errors).
   Confirm the screen renders with no console/page errors.

## v2 source files per screen

- **Schedule:** `src/routes/Schedule.svelte`, `src/components/blocks/scheduler/Timers.svelte`,
  `src/components/blocks/scheduler/TimerModal.svelte`. Stores: `schedule`, `plan`.
- **Monitoring:** `src/routes/Monitoring.svelte`,
  `src/components/blocks/monitoring/Data.svelte`, `Manager.svelte`, `Safety.svelte`.
  Store: `status` (live WebSocket data) + `config`.
- **History:** `src/routes/History.svelte`, `src/components/blocks/history/Logs.svelte`.
  Store: `history` (paged via `GET /logs/<index>`).

The v3 placeholder routes already exist (`src/routes/Schedule.svelte`,
`Monitoring.svelte`, `History.svelte`) and are wired into `src/lib/routes.js` — each
plan replaces its placeholder.

## The two follow-ups (4th work item — own spec + plan + branch, after the 3 screens)

**A. Eco/Shaper handlers.** `src/routes/Dashboard.svelte` passes `onEco`/`onShaper` as
no-op stubs. Wire them: see v2 `src/components/blocks/main/Manual.svelte` —
`setShaper` does `httpAPI("POST","/shaper","shaper=0|1","text")`; `setDivertMode` does
`httpAPI("POST","/divertmode","divertmode=1|2","text")`. Route through `serialQueue`.

**B. Failed-write revert + AlertBox.** Control writes are currently optimistic. Add:
when a store write fails, revert the control to the store's confirmed value and surface
the global `AlertBox` via `uistates_store.alertbox`. This is cross-cutting — apply it to
the Dashboard's controls and the new screens' controls. Consider a small shared helper
in `src/lib/` so each screen uses one pattern.

## Mock fixtures

`dev/fixtures/` holds real device captures; `dev/mock-plugin.js` serves the 7 startup
endpoints + a mock WebSocket. Screens needing data the current fixtures lack must add it:
- **History** needs `GET /api/logs/<index>` — add that route to the mock plugin and a
  representative log fixture.
- **Schedule** uses `/schedule` and `/schedule/plan` (already served) — enrich the
  `schedule.json` fixture with representative timers so the screen is viewable.
Capture from the real device at `10.75.1.144` where possible (it may be unreachable or
in any state — fall back to hand-built representative fixtures that match v2's response
shapes).

## Verification gate before each merge

- `npm test` — all tests pass.
- `npm run build` — succeeds; all JS/CSS assets gzipped (no plain `.js`/`.css` in
  `dist/assets/` except `sw.js`).
- Playwright visual check renders the screen with no console/page errors.

## Genuinely-blocked conditions (rare — document clearly, then move to the next screen)

- A v2 behavior depends on a device endpoint the mock cannot represent AND the real
  device is unreachable.
- A spec-level contradiction unresolvable from v2.

Everything else: decide per locked-decision #2, document, proceed.

## Task tracking

Re-create a task list (TaskCreate) per screen plan as you start it. The old task IDs
from Foundation/Dashboard are stale — ignore them.

## On completion

Post a summary for the user: which screens + follow-ups merged, final test counts,
every documented judgment call, anything skipped or flagged, and the state of `main`.
