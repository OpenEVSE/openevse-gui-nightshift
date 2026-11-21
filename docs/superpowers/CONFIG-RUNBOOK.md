# v3 Autonomous Build Runbook — Configuration / Settings Pages

> **You (a post-compaction Claude) are executing this unattended.** The user
> authorized an autonomous design + build of v3's entire Settings area. Work
> continuously through the batches. Do not wait for input. Follow this runbook end to
> end, then post a summary.

## Mission

Build v3's **Settings** area — a `/settings` hub plus **17 configuration pages**,
ported from v2's `/configuration` screens. Land each batch on `main` when green.

## Where things stand

- Repo `/home/rar/openevse-gui-v3`, branch `main`, clean. The five core screens
  (Foundation, Dashboard, Schedule, Monitoring, History) and the write-feedback
  follow-ups are all built, reviewed, and merged. **332 tests pass; clean build.**
- v2 reference repo: `/home/rar/openevse-gui-v2`. The config pages live in
  `src/components/blocks/configuration/*.svelte` (one block per page); the hub is
  `src/routes/Configuration.svelte`; routes in `src/lib/routes.js`.
- The v3 **Schedule / Monitoring / History** screens are the architectural exemplars
  to copy. The prior screen runbook (`docs/superpowers/AUTONOMOUS-RUNBOOK.md`) holds
  the shared rules — read it for the architecture/commit/Vite details, summarized
  below.

## Locked decisions (from the user — do NOT revisit)

1. **Scope:** all 17 config pages. Build the straightforward form pages first; the
   three with non-form device flows — **Firmware OTA update, Dev/Terminal console,
   Certificates management** — come last (the System batch) and get extra care.
2. **Navigation:** add a **5th bottom-nav item, "Settings"** (a gear icon), opening
   the `/settings` hub. The bottom nav currently has Home / Schedule / Monitoring /
   History.
3. **Hub layout:** the hub groups the pages under **section headings** —
   Connectivity / Charger / Energy / System — not a flat list.
4. **Build structure:** **grouped batch plans.** One comprehensive design spec up
   front, then one implementation plan per batch (Config Foundation, then the four
   themed batches). Each batch: plan → branch → subagent build → final review →
   merge to `main`.
5. **On ambiguity** (carried from the prior runbook): pick the option most
   consistent with v2 and the existing v3 patterns, record it in the spec's
   "Decisions" section, and continue. Never block.

## The pages, grouped (17 pages → 4 batches + foundation)

| Batch | Pages | v3 routes |
|---|---|---|
| **Config Foundation** | the hub + nav + shared form primitives | `/settings` |
| **Connectivity** | Network, HTTP, MQTT, OCPP | `/settings/network`, `/http`, `/mqtt`, `/ocpp` |
| **Charger** | EVSE, Safety, Time, RFID, Vehicle | `/settings/evse`, `/safety`, `/time`, `/rfid`, `/vehicle` |
| **Energy** | Self-production (solar divert), Shaper, EmonCMS, OhmConnect | `/settings/solar`, `/shaper`, `/emoncms`, `/ohmconnect` |
| **System** | Firmware, Certificates, Dev/Terminal, About | `/settings/firmware`, `/certificates`, `/terminal`, `/about` |

v2 source blocks per page are in `src/components/blocks/configuration/` — same name
(e.g. `Network.svelte`, `Mqtt.svelte`, `SelfProduction.svelte`, `Dev.svelte` +
`Terminal.svelte`, `Firmware.svelte` + `FirmwareUpdateModal.svelte`,
`Certificates.svelte` + `CertificatesModal.svelte`).

## Architecture rules (non-negotiable — same as the screens)

- **The route component is the only store-aware unit.** Sub-components take plain
  props and emit callbacks; they never import stores.
- **Pure logic** (field definitions, validation, dirty/derive helpers) goes in
  `src/lib/config/` modules and is fully unit-tested.
- **Shared config UI** (form primitives, the page layout) lives in
  `src/lib/components/ui/` (primitives) and `src/lib/components/config/` (config-
  specific components). Each config page component lives in
  `src/lib/components/config/<page>/` or is small enough to be the route itself.
- All device writes go through `serialQueue` (`src/lib/queue.js`).
- A failed write surfaces the global alert via the existing
  `showWriteError()` helper (`src/lib/alerts.js`); the control reverts to the
  store's confirmed value. Reuse this — do not reinvent it.
- **i18n:** every user-facing string via `$_()`. Add a `config` i18n block,
  extended per batch, to `src/lib/i18n/en.json`.
- **Styling:** Tailwind theme tokens only (`bg-surface`, `bg-surface-2`,
  `bg-surface-3`, `text-text`, `text-text-dim`, `text-accent`, `border-border`,
  `text-error`, `text-warning`) — never raw hex.
- **Svelte 5 runes** throughout (`$props`, `$state`, `$derived`, `$effect`,
  `{@render children?.()}`).
- **TDD:** failing test → red → implement → green → commit. Frequent small commits.

## Key technical facts & gotchas

- **The v3 router is exact-match** (`src/lib/components/Router.svelte` — a plain
  `routes[$currentPath]` lookup, no params). Every config page is therefore a
  **static route key** in `src/lib/routes.js` (e.g. `'/settings/network'`). No
  param/nested routing exists or is needed.
- **`config_store`** (`src/lib/stores/config.js`) already has `download()`,
  `upload(data)` (POST `/config`, returns boolean — true on `msg:"done"` or
  `"no change"`), and `saveParam(name, val)` (uploads one field, updates the store
  on success, returns boolean). Per-field save is the device's natural granularity.
- **Save model:** mirror v2 — save each field on change/blur via
  `config_store.saveParam`, routed through `serialQueue`, with a brief inline
  per-field status (idle / saving / saved / error). On failure call
  `showWriteError()` and revert the field to the store value. The design spec
  finalizes the exact interaction.
- **Read each store before using it.** Besides `config_store`: `status_store`
  (read-only device state shown on several pages — network mode/IP/MAC, firmware
  version, etc.), `certificate_store` (singular — TLS certs, for the Certificates
  page). Confirm method names and return contracts.
- `src/lib/utils.js` has helpers ported from v2 — check it for `validateFormData`
  and form helpers before writing new ones; `getTZ`/`createTzObj` for the Time
  page (timezone DB is the `library/posix_tz_db` git submodule).
- **Vite 8:** every `import` path — including `vi.mock()` targets in tests — must
  resolve to a file on disk.
- **Test i18n mock** (every component test):
  ```js
  vi.mock('svelte-i18n', () => {
    const t = (k) => k
    t.subscribe = (fn) => { fn(t); return () => {} }
    return { _: t }
  })
  ```
- **Commits:** plain `git commit` (no `-c` user override). End every message with:
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

## The Config Foundation batch delivers

1. The **5th bottom-nav item** ("Settings", gear icon) in
   `src/lib/components/shell/BottomNav.svelte`, with a `nav.settings` i18n key.
2. The **`/settings` route + hub** (`src/routes/Settings.svelte`) — grouped sections
   (Connectivity / Charger / Energy / System), each a card listing its pages with an
   icon + name, linking to the page routes. Placeholder routes for all 17 pages so
   the hub links resolve (each batch then replaces its placeholders).
3. **Shared form primitives** in `src/lib/components/ui/` — built just-in-time:
   a themed `TextInput`, `PasswordInput`, `NumberInput` (`Select`, `Toggle`,
   `Slider`, `Button`, `Card` already exist). Plus config components in
   `src/lib/components/config/`: a `ConfigPage` layout (back-to-hub link + title +
   slot), a `FormField` (labelled row wrapping a control + per-field save status),
   and a `ReadOnlyRow` (label + value, for device info).
4. A pure `src/lib/config/` helper module for field save-status state and any
   shared validation, fully unit-tested.
5. The base `config` i18n block.

## Process per batch (Foundation, then Connectivity, Charger, Energy, System)

1. **(Once, before Foundation)** Write **one comprehensive design spec** —
   `docs/superpowers/specs/2026-05-22-config-system-design.md` — covering the whole
   Settings area: the hub, nav, the shared form primitives + `ConfigPage` layout,
   the save model, the page grouping, the per-page feature summary (what each of the
   17 pages does, gathered from its v2 block), error handling, testing, and a
   Decisions section. Self-review for placeholders/consistency/ambiguity. Commit to
   `main`.
2. **Per batch:** explore the batch's v2 page blocks → invoke
   `superpowers:writing-plans` → output `docs/superpowers/plans/2026-05-22-config-
   <batch>.md` (bite-sized TDD tasks, complete code, exact paths). Self-review
   against the spec. Commit the plan to `main`.
3. **Create a `config-<batch>` git branch.**
4. **Execute** — invoke `superpowers:subagent-driven-development`. One implementer
   subagent per task (model `sonnet`). Controller-verify each task (run the tests).
   A reviewer (model `opus`) for the route/integration tasks and a final
   comprehensive review per batch. Fix review issues before merge.
5. **Finish** — merge the branch to `main` (the user pre-authorized "merge when
   green"; do not pause for the menu), verify the full suite on the merged result,
   delete the branch.
6. **Visual check** — `npm run dev:mock`, drive with Playwright (harness at
   `/tmp/pw-verify/`, reuse the existing `*.mjs` scripts as templates: goto, wait,
   screenshot, report console errors). Confirm the hub and the batch's pages render
   with no console/page errors.

Do the batches in order: **Foundation → Connectivity → Charger → Energy → System.**

## The three complex System pages — extra care

- **Firmware** — shows the running firmware version/build; checks for and uploads new
  firmware (OTA). v2: `Firmware.svelte` + `FirmwareUpdateModal.svelte`. Involves a
  file upload to a device update endpoint and a progress flow.
- **Dev / Terminal** — a debug console: connects to the device `/debug` channel and
  sends RAPI commands. v2: `Dev.svelte` + `Terminal.svelte`.
- **Certificates** — lists / adds / deletes TLS certificates via `certificate_store`.
  v2: `Certificates.svelte` + `CertificatesModal.svelte`.

For each: if a device endpoint genuinely cannot be represented by the dev mock AND
the real device (`192.168.1.50`) is unreachable, build the UI against v2's known
response shapes, document the assumption in the spec/plan, and proceed — do not
block. Add mock routes to `dev/mock-plugin.js` where feasible.

## Mock fixtures

`dev/fixtures/config.json` already holds a full real-device config capture — the
form pages read it as-is. Pages needing data the current fixtures lack (e.g.
Certificates needs a `/certificates` list, Firmware a version-check response) must
add a route to `dev/mock-plugin.js` + a representative fixture. Capture from
`192.168.1.50` where possible; otherwise hand-build to match v2's response shapes.

## Verification gate before each merge

- `npm test` — all tests pass.
- `npm run build` — succeeds; all JS/CSS assets gzipped in `dist/assets/` (no plain
  `.js`/`.css` except `sw.js`).
- Playwright visual check — the batch's pages render with no console/page errors.

## Genuinely-blocked conditions (rare — document, then move on)

- A v2 page depends on a device endpoint the mock cannot represent AND the real
  device is unreachable → build to v2's response shape, document, continue.
- A spec-level contradiction unresolvable from v2 → pick the v2-consistent option,
  document, continue.

## On completion

Post a summary: which batches + pages merged, final test counts, every documented
judgment call, anything skipped or flagged (especially in the three complex pages),
and the state of `main`.
