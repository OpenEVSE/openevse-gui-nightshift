# Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `lg:` (≥1024px) desktop tier — labeled nav rail, two-column dashboard, centered max-width content on every page — while mobile and the `sm:` tier render exactly as today.

**Architecture:** Pure Tailwind `lg:` utility additions per the spec (`docs/superpowers/specs/2026-06-09-desktop-layout-design.md`). The only structural change is the Dashboard template, which gains CSS-only column wrappers (`max-lg:contents` + `max-lg:order-*` so mobile DOM/visual order is preserved). No new components, stores, or dependencies.

**Tech Stack:** Svelte 5 (runes), Tailwind v4, Vitest + @testing-library/svelte (jsdom — responsive behavior is asserted via class presence, not rendering).

**Conventions for every task:**
- Run a single test file: `npx vitest run <path>` from `/home/rar/openevse-gui-nightshift`.
- Full gate before each commit: `npm test` (all files green) — the existing suite is the mobile contract; if an existing test fails, fix the change, not the test.
- jsdom can't apply media queries, so "tests" here assert that the `lg:` classes are present in the markup. Visual correctness is verified once at the end on the mock dev server (Task 7).

---

### Task 1: Labeled nav rail at `lg:`

**Files:**
- Modify: `src/lib/components/shell/BottomNav.svelte`
- Test: `src/lib/components/shell/__tests__/BottomNav.test.js`

- [ ] **Step 1: Write the failing test** — append inside the existing `describe('BottomNav', ...)` block:

```js
  it('carries the desktop labeled-rail classes', () => {
    const { container, getAllByRole } = render(BottomNav, { props: { path: '/' } })
    expect(container.querySelector('nav').className).toContain('lg:w-52')
    for (const link of getAllByRole('link')) {
      expect(link.className).toContain('lg:flex-row')
    }
  })
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/lib/components/shell/__tests__/BottomNav.test.js`
Expected: the new test fails (`lg:w-52` not found); the 2 existing tests pass.

- [ ] **Step 3: Implement** — in `BottomNav.svelte`, change only the two `class` attributes.

The `<nav>` class becomes:

```
  class="flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-stretch border-t border-border bg-surface-2
         pb-[env(safe-area-inset-bottom)]
         pl-[env(safe-area-inset-left)]
         pr-[env(safe-area-inset-right)]
         sm:h-full sm:w-20 sm:flex-col sm:border-r sm:border-t-0
         sm:pb-0 sm:pl-0 sm:pr-0
         lg:w-52"
```

The `<a>` class becomes:

```
      class="flex flex-1 flex-col items-center justify-center gap-1 text-[10px]
             sm:flex-none sm:py-4
             lg:flex-row lg:justify-start lg:gap-3 lg:px-5 lg:py-3 lg:text-sm
             {isActive(item, path) ? 'text-accent' : 'text-text-dim'}"
```

(No other changes — items, icons, `isActive` stay as-is. `items-center` already centers the icon+label row vertically at `lg:`.)

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/components/shell/__tests__/BottomNav.test.js`
Expected: 3 passed.

- [ ] **Step 5: Full suite + commit**

```bash
npm test   # all green
git add src/lib/components/shell/BottomNav.svelte src/lib/components/shell/__tests__/BottomNav.test.js
git commit -m "feat(desktop): labeled nav rail at lg breakpoint"
```

---

### Task 2: ConfigPage centered form column (fixes all 17 settings pages)

**Files:**
- Modify: `src/lib/components/config/ConfigPage.svelte:9`
- Test: `src/lib/components/config/__tests__/ConfigPage.test.js`

- [ ] **Step 1: Write the failing test** — append inside `describe('ConfigPage', ...)`:

```js
  it('constrains the form to a centered column on desktop', () => {
    const { container } = render(ConfigPage, { title: 'Network', children: body })
    const cls = container.querySelector('section').className
    expect(cls).toContain('lg:max-w-2xl')
    expect(cls).toContain('lg:mx-auto')
  })
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/lib/components/config/__tests__/ConfigPage.test.js`

- [ ] **Step 3: Implement** — change line 9 of `ConfigPage.svelte`:

```svelte
<section class="p-4 lg:mx-auto lg:max-w-2xl">
```

- [ ] **Step 4: Run tests — expect PASS** (same command).

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/lib/components/config/ConfigPage.svelte src/lib/components/config/__tests__/ConfigPage.test.js
git commit -m "feat(desktop): center settings forms in a max-w-2xl column"
```

---

### Task 3: Settings index — two-column card grid

**Files:**
- Modify: `src/routes/Settings.svelte` (template only)
- Test: `src/routes/__tests__/Settings.test.js`

- [ ] **Step 1: Write the failing test** — append inside `describe('Settings hub', ...)`:

```js
  it('lays the section cards out as a two-column grid on desktop', () => {
    const { container, getByText } = render(Settings)
    expect(container.querySelector('section').className).toContain('lg:max-w-4xl')
    expect(container.querySelector('[class*="lg:grid-cols-2"]')).toBeTruthy()
    const supportCard = getByText('config.sections.support').closest('[class*="lg:col-span-2"]')
    expect(supportCard).toBeTruthy()
  })
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/routes/__tests__/Settings.test.js`

- [ ] **Step 3: Implement** — in `Settings.svelte`:

1. Section wrapper (line 30) becomes:

```svelte
<section class="p-4 lg:mx-auto lg:max-w-4xl">
```

2. Wrap the `{#each groups ...}` loop **and** the Support card together in a grid div, and give the Support card `lg:col-span-2`. The template after the `<h1>` becomes:

```svelte
  <div class="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4">
    {#each groups as group}
      <Card class="mb-4 p-4">
        <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
          {$_('config.sections.' + group.section)}
        </h2>
        <ul class="divide-y divide-border">
          {#each group.pages as page}
            <li>
              <a
                href="#{page.route}"
                class="flex items-center gap-3 py-3 text-text hover:text-accent"
              >
                <Icon icon={page.icon} size={20} class="text-text-dim" />
                <span class="flex-1 text-sm">{$_(page.labelKey)}</span>
                <Icon icon="mdi:chevron-right" size={18} class="text-text-dim" />
              </a>
            </li>
          {/each}
        </ul>
      </Card>
    {/each}

    <Card class="mb-4 p-4 lg:col-span-2">
      <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
        {$_('config.sections.support')}
      </h2>
      <ul class="divide-y divide-border">
        {#each supportLinks as link}
          <li>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-3 py-3 text-text hover:text-accent"
            >
              <Icon icon={link.icon} size={20} class="text-text-dim" />
              <span class="flex-1 text-sm">{$_(link.labelKey)}</span>
              <Icon icon="mdi:open-in-new" size={18} class="text-text-dim" />
            </a>
          </li>
        {/each}
      </ul>
    </Card>
  </div>
```

(The card markup is unchanged except the wrapper div and `lg:col-span-2` on the Support card. Vertical rhythm comes from the existing `mb-4`, so the grid only needs `gap-x-4`. The `<script>` block is untouched.)

- [ ] **Step 4: Run tests — expect PASS** (same command; the 3 existing Settings tests must also still pass — link count and Support assertions are unaffected).

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/routes/Settings.svelte src/routes/__tests__/Settings.test.js
git commit -m "feat(desktop): two-column settings index grid"
```

---

### Task 4: Schedule & History — centered columns

**Files:**
- Modify: `src/routes/Schedule.svelte:66`, `src/routes/History.svelte:108`

No new tests — these are single-class changes covered by the final manual check; existing route tests assert behavior and must stay green.

- [ ] **Step 1: Implement** — `Schedule.svelte` line 66:

```svelte
<section class="p-4 lg:mx-auto lg:max-w-3xl">
```

`History.svelte` line 108:

```svelte
<section class="p-4 lg:mx-auto lg:max-w-3xl">
```

- [ ] **Step 2: Full suite + commit**

```bash
npm test
git add src/routes/Schedule.svelte src/routes/History.svelte
git commit -m "feat(desktop): center schedule and history at max-w-3xl"
```

---

### Task 5: Monitoring — centered content, two-column Data tab, constrained Safety/Manager

**Files:**
- Modify: `src/routes/Monitoring.svelte:62-77`, `src/lib/components/monitoring/MetricsTab.svelte:7`
- Test: `src/lib/components/monitoring/__tests__/MetricsTab.test.js`

- [ ] **Step 1: Write the failing test** — append inside `describe('MetricsTab', ...)`:

```js
  it('flows groups into a two-column grid on desktop', () => {
    const { container } = render(MetricsTab, { props: { groups } })
    const cls = container.firstElementChild.className
    expect(cls).toContain('lg:grid-cols-2')
    expect(cls).toContain('lg:items-start')
  })
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/lib/components/monitoring/__tests__/MetricsTab.test.js`

- [ ] **Step 3: Implement** — `MetricsTab.svelte` line 7 (`MetricGroup` cards already carry `mb-2`, so the grid only adds horizontal gap; `items-start` keeps an expanded card from stretching its collapsed neighbor):

```svelte
<div class="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-3">
```

Then in `Monitoring.svelte`: the `<section>` (line 62) becomes

```svelte
<section class="flex h-full min-h-0 flex-col p-4 lg:mx-auto lg:w-full lg:max-w-5xl">
```

and the Safety/Manager branches get a width-constraining wrapper (single cards of label/value rows — rows shouldn't stretch ~1000px):

```svelte
    {:else if activeId === 'safety'}
      <div class="lg:mx-auto lg:w-full lg:max-w-3xl">
        <SafetyTab data={safety} />
      </div>
    {:else}
      <div class="lg:mx-auto lg:w-full lg:max-w-3xl">
        <ManagerTab rows={claims} />
      </div>
    {/if}
```

(Energy and Data branches stay as direct children — Energy keeps the full content width by design.)

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/components/monitoring/__tests__/MetricsTab.test.js src/routes/__tests__/Monitoring.test.js`
(If `src/routes/__tests__/Monitoring.test.js` doesn't exist, run the monitoring component tests folder instead: `npx vitest run src/lib/components/monitoring/`.)

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/routes/Monitoring.svelte src/lib/components/monitoring/MetricsTab.svelte src/lib/components/monitoring/__tests__/MetricsTab.test.js
git commit -m "feat(desktop): monitoring two-column data grid and centered tabs"
```

---

### Task 6: Dashboard — two-column act/observe grid

**Files:**
- Modify: `src/routes/Dashboard.svelte:396-493` (template only; `<script>` untouched)
- Test: `src/routes/__tests__/Dashboard.test.js`

**Mechanism (read before editing):** the section becomes `flex flex-col` on mobile (verified: every dashboard block uses single-direction `mt-*` margins only, so block→flex renders identically) and a 2-column grid at `lg:`. Two wrapper divs group the columns; on mobile they're `max-lg:contents` so their children participate directly in the section's flex layout, and `max-lg:order-*` utilities preserve today's exact visual order (status → ring/hero → throttle → chips → controls → limit card). The Labs chart hero (`showChart`, gating unchanged) spans both columns at `lg:`.

- [ ] **Step 1: Write the failing test** — append inside `describe('Dashboard', ...)`:

```js
  it('carries the desktop two-column grid classes', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { container } = render(Dashboard)
    const section = container.querySelector('section')
    expect(section.className).toContain('lg:grid-cols-2')
    // two column wrappers that dissolve on mobile
    expect(container.querySelectorAll('section > [class*="max-lg:contents"]')).toHaveLength(2)
  })
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
Expected: the new test fails; the 10 existing Dashboard tests pass.

- [ ] **Step 3: Implement** — replace the entire template (everything from `<section ...>` through `</section>`, currently lines 396–493) with the following. **All component props are byte-for-byte identical to today** — only wrappers and classes change:

```svelte
<section
  class="flex flex-col px-4 pb-4 lg:mx-auto lg:grid lg:w-full lg:max-w-5xl
         lg:grid-cols-2 lg:items-start lg:gap-x-6"
>
  {#if showChart}
    <!-- Labs chart hero: full content width on desktop, first block on mobile -->
    <div class="max-lg:order-1 lg:col-span-2" in:fade={{ duration: 150 }}>
      <ChargingHero
        {kw}
        soc={hasSoc ? ($status_store?.battery_level ?? null) : null}
        target={socTarget}
        {hasSoc}
        amps={chargeAmps}
        {maxAmps}
        {rateClaimedBy}
        {rateNonce}
        samples={$energy_store.raw.samples}
        voltage={$status_store?.voltage ?? 0}
        sessionElapsed={$status_store?.session_elapsed ?? 0}
        chartError={$energy_store.error.raw}
        rateDisabled={busy || ecoOn || display === 'error'}
        onrate={setChargeAmps}
      />
    </div>
  {/if}

  <!-- Act column: status, ring + rate, throttle, mode controls.
       max-lg:contents dissolves the wrapper on mobile; max-lg:order-* on the
       children preserves today's visual order in the section's flex-col. -->
  <div class="max-lg:contents lg:flex lg:flex-col">
    {#if !showChart}
      <div class="max-lg:order-1"><StatusLine {display} /></div>
      <div class="relative max-lg:order-2" in:fade={{ duration: 150 }}>
        <div class="absolute right-3 top-1 z-10">
          {#key rateNonce}
            <RatePill
              amps={chargeAmps}
              min={6}
              max={maxAmps}
              claimedBy={rateClaimedBy}
              disabled={busy || ecoOn || display === 'error'}
              onchange={setChargeAmps}
            />
          {/key}
        </div>
        <PowerRing
          {display}
          {fill}
          {kw}
          maxKw={charging ? maxKw : ''}
          reasonKey={reason.key}
          reasonValues={reason.values}
          faultText={getStateDesc($status_store?.state) ?? ''}
        />
      </div>
    {/if}

    <div class="max-lg:order-3"><ThrottleBadge /></div>

    <!-- Unified charge controls: segmented mode + Shaper/Boost modifiers.
         Stays visible (disabled) during a fault so the layout doesn't reflow. -->
    <div class="max-lg:order-5">
      <ChargeControls
        segment={chargeSegment}
        divertEnabled={showEco}
        shaperEnabled={showShaper}
        {shaperOn}
        locked={modeLocked}
        lockLabel={modeLockLabel}
        disabled={busy || display === 'error'}
        {boostEndsAt}
        onsegment={setSegment}
        onshaper={setShaper}
        onboost={boost}
        oncancelboost={cancelBoost}
      />
    </div>
  </div>

  <!-- Observe column: stat chips, SOC / charge-limit card -->
  <div class="max-lg:contents lg:flex lg:flex-col">
    <div class="max-lg:order-4"><StatChips {charging} {live} {summary} {sessionCost} /></div>

    {#if display !== 'error'}
      <div class="max-lg:order-6">
        {#key socNonce}
          <ChargeLimitCard
            {hasSoc}
            soc={$status_store?.battery_level ?? 0}
            {vehicleLimit}
            target={socTarget}
            range={$status_store?.battery_range ?? null}
            rangeMiles={!!$config_store?.mqtt_vehicle_range_miles}
            timeToFull={$status_store?.time_to_full_charge ?? 0}
            {charging}
            unit={limitUnit}
            estMaxRange={maxRange}
            disabled={busy}
            ontarget={setTarget}
            onunit={(u) => (userUnit = u)}
            limit={$limit_store}
            summary={limitSummary}
            onopen={() => (limitModalOpen = true)}
            onclear={clearLimit}
          />
        {/key}
      </div>
    {/if}
  </div>
</section>
```

Leave `<ChargeLimitModal ...>` after the section exactly as it is.

**Order sanity check** (mobile, `max-lg:order-*`): chart-off → status(1), ring(2), throttle(3), chips(4), controls(5), limit(6) — today's order. Chart-on → hero(1), throttle(3), chips(4), controls(5), limit(6) — today's order.

- [ ] **Step 4: Run the Dashboard tests — expect ALL PASS (11)**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
The 10 pre-existing tests passing is the proof that behavior (mode locks, limit reasons, SOC bar, uploads) survived the re-wrap.

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/routes/Dashboard.svelte src/routes/__tests__/Dashboard.test.js
git commit -m "feat(desktop): two-column act/observe dashboard grid"
```

---

### Task 7: Verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full gates**

```bash
npm test            # expect: 122 files / ~673 tests, all green
npm run build 2>&1 | grep -c "state_referenced_locally"   # expect: 0
```

- [ ] **Step 2: Manual check on the mock server**

```bash
npm run dev:mock    # http://localhost:5173 (or --host for remote)
```

Verify in a real browser:
- **~1280px and ~1920px:** labeled rail; dashboard two columns (ring/controls left, chips/SOC right); Settings index 2-col with full-width Support card; a config page (e.g. Solar) centered ~670px; Monitoring Data tab 2-col, Energy full width, Safety/Manager centered; Schedule/History centered.
- **Labs on + charging (mock):** chart hero spans both dashboard columns.
- **Mobile width (~390px, devtools):** every page renders pixel-identical to before — especially dashboard block order: status → ring → throttle → chips → controls → limit card.
- **640–1023px:** unchanged icon rail + single column.

- [ ] **Step 3: Report** — summarize what was verified; flag any visual oddity for follow-up rather than silently tweaking beyond the spec.

---

## Self-review notes (already applied)

- Spec coverage: nav (T1), settings forms (T2), settings index (T3), schedule/history (T4), monitoring incl. Safety/Manager constraint + Energy full width (T5), dashboard incl. hero span + order preservation (T6), tests/manual (spread + T7). No gaps.
- The Dashboard `flex-col` switch was pre-verified safe: all six blocks use single-direction `mt-*` margins, so no margin-collapse differences vs. today's block layout.
- jsdom limitation acknowledged: class-presence assertions only; visual truth comes from Task 7.
