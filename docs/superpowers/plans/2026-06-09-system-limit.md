# System Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a System Limit editor (config `limit_default_type`/`limit_default_value`) to the EVSE settings page, and make the dashboard show an active system limit (`GET /limit` → `auto_release: false`) without any delete affordance.

**Architecture:** Pure additions following existing idioms — a `ConfigSection` on the EVSE page using `createConfigForm` save-on-change, a `clearable` prop on `ChargeLimitCard`, and a `systemLimit` derived guard on the Dashboard's three limit-delete paths. Spec: `docs/superpowers/specs/2026-06-09-system-limit-design.md`.

**Tech Stack:** Svelte 5 runes, svelte-i18n (en/es/fr/hu, parity enforced), Vitest + @testing-library/svelte.

**Conventions for every task:**
- Work from `/home/rar/openevse-gui-nightshift`. Run a single test file with `npx vitest run <path>`; full gate `npm test` before each commit (currently 673 green — existing tests are a shipped contract: if one fails, fix the change, not the test).
- Commit messages: conventional commits, body ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Device contract recap: time = minutes, energy = **Wh** (UI shows kWh), soc = %, range = km/miles per `mqtt_vehicle_range_miles`; unset `limit_default_type` may be `""`; remove = write `"none"`; an applied default reports `auto_release: false` on `GET /limit`.

---

### Task 1: i18n keys (all four locales)

**Files:**
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/es.json`, `src/lib/i18n/fr.json`, `src/lib/i18n/hu.json`

These files mix inline and multi-line JSON objects — NEVER parse-and-reserialize them (noisy diffs). Use the anchored-regex script below; it validates with `JSON.parse` after editing.

- [ ] **Step 1: Add the 8 `config.evse` keys per locale** — run this script from the repo root:

```bash
node -e '
const fs = require("fs");
// limit_none/time/energy reuse each locale dashboard.limit.type_* values so
// the two surfaces stay consistent; soc/range/system_limit/limit_type/
// limit_value are new strings.
const NEW = {
  en: { system_limit: "System limit", limit_type: "Limit type", limit_value: "Value", limit_soc: "SOC", limit_range: "Range" },
  es: { system_limit: "Límite del sistema", limit_type: "Tipo de límite", limit_value: "Valor", limit_soc: "SOC", limit_range: "Autonomía" },
  fr: { system_limit: "Limite système", limit_type: "Type de limite", limit_value: "Valeur", limit_soc: "SOC", limit_range: "Autonomie" },
  hu: { system_limit: "Rendszerkorlát", limit_type: "Korlát típusa", limit_value: "Érték", limit_soc: "SOC", limit_range: "Hatótáv" },
};
for (const l of ["en", "es", "fr", "hu"]) {
  const f = "src/lib/i18n/" + l + ".json";
  let s = fs.readFileSync(f, "utf8");
  const o = JSON.parse(s);
  const t = o.dashboard.limit; // type_none / type_time / type_energy exist in all locales
  const n = NEW[l];
  const block =
    `      "system_limit": ${JSON.stringify(n.system_limit)},\n` +
    `      "limit_type": ${JSON.stringify(n.limit_type)},\n` +
    `      "limit_value": ${JSON.stringify(n.limit_value)},\n` +
    `      "limit_none": ${JSON.stringify(t.type_none)},\n` +
    `      "limit_time": ${JSON.stringify(t.type_time)},\n` +
    `      "limit_energy": ${JSON.stringify(t.type_energy)},\n` +
    `      "limit_soc": ${JSON.stringify(n.limit_soc)},\n` +
    `      "limit_range": ${JSON.stringify(n.limit_range)},\n`;
  // Anchor: the "sensor" key opens the last sub-group of config.evse in every locale.
  const before = s;
  s = s.replace(/(      "sensor": ")/, block.replace(/\$/g, "$$$$") + "$1");
  if (s === before) throw new Error("sensor anchor not found in " + f);
  JSON.parse(s); // validate
  fs.writeFileSync(f, s);
}
console.log("added 8 keys to 4 locales");
'
```

- [ ] **Step 2: Verify parity and values**

```bash
for l in en es fr hu; do node -e "
const o = require('./src/lib/i18n/$l.json');
const c = (x) => Object.values(x).reduce((n, v) => n + (v && typeof v === 'object' ? c(v) : 1), 0);
console.log('$l', c(o), o.config.evse.system_limit, o.config.evse.limit_range)"; done
```

Expected: all four locales report the SAME total count (previous count + 8) and print their `system_limit` / `limit_range` strings.

- [ ] **Step 3: Full suite + commit**

```bash
npm test
git add src/lib/i18n/
git commit -m "feat(i18n): system limit strings for the EVSE page"
```

---

### Task 2: EVSE page — System limit section

**Files:**
- Modify: `src/routes/settings/Evse.svelte`
- Test: `src/routes/settings/__tests__/Evse.test.js`

- [ ] **Step 1: Write the failing tests** — append inside `describe('EVSE page', ...)`. The existing `BASE` fixture (top of file) deliberately omits `default_state`/`is_threephase`/`button_enabled`, so the page renders exactly **two** comboboxes with these props: service first, the new limit-type select last. Number inputs by display value (`scale: 220` etc. keep them unique).

```js
  it('renders the system limit section', () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    const { getByText } = render(Evse)
    expect(getByText('config.evse.system_limit')).toBeInTheDocument()
    expect(getByText('config.evse.limit_type')).toBeInTheDocument()
  })

  it('saves type with a zeroed value when picking a system limit type', async () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    const { getAllByRole } = render(Evse)
    const selects = getAllByRole('combobox')
    const typeSelect = selects[selects.length - 1] // system-limit select is the page's last combobox
    await fireEvent.change(typeSelect, { target: { value: 'energy' } })
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config',
      JSON.stringify({ limit_default_type: 'energy', limit_default_value: 0 }),
    )
  })

  it('shows the energy value in kWh and saves it in Wh', async () => {
    config_store.set({ ...BASE, limit_default_type: 'energy', limit_default_value: 10000 })
    const { getByDisplayValue } = render(Evse)
    const input = getByDisplayValue('10') // 10000 Wh shown as 10 kWh
    await fireEvent.input(input, { target: { value: '12' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config',
      JSON.stringify({ limit_default_value: 12000 }),
    )
  })

  it('saves a non-energy value unconverted', async () => {
    config_store.set({ ...BASE, limit_default_type: 'time', limit_default_value: 120 })
    const { getByDisplayValue } = render(Evse)
    const input = getByDisplayValue('120')
    await fireEvent.input(input, { target: { value: '90' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config',
      JSON.stringify({ limit_default_value: 90 }),
    )
  })

  it('removes the system limit by writing type none', async () => {
    config_store.set({ ...BASE, limit_default_type: 'energy', limit_default_value: 10000 })
    const { getAllByRole } = render(Evse)
    const selects = getAllByRole('combobox')
    await fireEvent.change(selects[selects.length - 1], { target: { value: 'none' } })
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config',
      JSON.stringify({ limit_default_type: 'none' }),
    )
  })

  it('hides the value field when no system limit type is set', () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    const { queryByText } = render(Evse)
    expect(queryByText('config.evse.limit_value')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run — expect the 6 new tests to FAIL**

Run: `npx vitest run src/routes/settings/__tests__/Evse.test.js`

- [ ] **Step 3: Implement** — in `src/routes/settings/Evse.svelte`.

Append to the `<script>` block (after the `serviceOptions` declaration):

```js
  // System limit: the persistent default the firmware applies to every
  // session (config limit_default_type / limit_default_value). The device
  // stores energy in Wh; the field shows kWh. Unset type arrives as "".
  let sysType = $derived($config_store?.limit_default_type || 'none')
  let sysValue = $derived(Number($config_store?.limit_default_value ?? 0))
  let limitTypeOptions = $derived([
    { value: 'none', label: $_('config.evse.limit_none') },
    { value: 'time', label: $_('config.evse.limit_time') },
    { value: 'energy', label: $_('config.evse.limit_energy') },
    { value: 'soc', label: $_('config.evse.limit_soc') },
    { value: 'range', label: $_('config.evse.limit_range') },
  ])
  let sysUnitLabel = $derived(
    sysType === 'time'
      ? $_('dashboard.limit.minutes')
      : sysType === 'energy'
        ? $_('units.kwh')
        : sysType === 'soc'
          ? $_('units.percent')
          : sysType === 'range'
            ? ($config_store?.mqtt_vehicle_range_miles ? $_('units.miles') : $_('units.km'))
            : '',
  )

  function saveSystemLimitType(t) {
    // Value resets on type change — units differ per type (matches gui-v2).
    if (t === 'none') return form.saveField('limit_default_type', 'none')
    return form.saveFields({ limit_default_type: t, limit_default_value: 0 })
  }
  function saveSystemLimitValue(v) {
    const raw = sysType === 'energy' ? Math.round((v ?? 0) * 1000) : (v ?? 0)
    return form.saveField('limit_default_value', raw)
  }
```

Insert this `ConfigSection` between the Behaviour section's closing `</ConfigSection>` and the `<ConfigSection title={$_('config.evse.sensor')}>` line:

```svelte
  <ConfigSection title={$_('config.evse.system_limit')}>
    <FormField label={$_('config.evse.limit_type')} status={$ss.limit_default_type ?? 'idle'}>
      <Select options={limitTypeOptions} value={sysType} onchange={saveSystemLimitType} />
    </FormField>
    {#if sysType !== 'none'}
      <FormField
        label={$_('config.evse.limit_value')}
        description={sysUnitLabel}
        status={$ss.limit_default_value ?? 'idle'}
      >
        <NumberInput
          value={sysType === 'energy' ? sysValue / 1000 : sysValue}
          min={0}
          max={sysType === 'soc' ? 100 : undefined}
          step={sysType === 'time' ? 5 : sysType === 'range' ? 10 : 1}
          revert={form.revert}
          onchange={saveSystemLimitValue}
        />
      </FormField>
    {/if}
  </ConfigSection>
```

(`form.saveFields` already exists in `createConfigForm` — `src/routes/settings/Vehicle.svelte` uses it. All imports used here are already in the file.)

- [ ] **Step 4: Run — expect ALL PASS** (existing + 6 new): `npx vitest run src/routes/settings/__tests__/Evse.test.js`

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/routes/settings/Evse.svelte src/routes/settings/__tests__/Evse.test.js
git commit -m "feat(evse): system limit editor on the EVSE settings page"
```

---

### Task 3: ChargeLimitCard — `clearable` prop

**Files:**
- Modify: `src/lib/components/dashboard/ChargeLimitCard.svelte`
- Test: `src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js`

- [ ] **Step 1: Write the failing test** — append inside `describe('ChargeLimitCard', ...)`:

```js
  it('hides the clear button (and the set button) when not clearable', () => {
    const { getByText, queryByLabelText, queryByText } = render(ChargeLimitCard, {
      props: {
        hasSoc: false,
        limit: { type: 'energy', value: 10000 },
        summary: '10 kWh',
        clearable: false,
      },
    })
    expect(getByText('10 kWh')).toBeInTheDocument() // summary still shows
    expect(queryByLabelText('dashboard.limit.clear')).not.toBeInTheDocument()
    expect(queryByText('dashboard.limit.set')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js`

- [ ] **Step 3: Implement** — two edits in `ChargeLimitCard.svelte`.

Add the prop to the destructuring (after `onclear = () => {},`):

```js
    onclear = () => {},
    // false for a system (default) limit — it shows but can't be cleared here.
    clearable = true,
```

Change the row's button block from:

```svelte
    {#if rowActive}
      <button
        type="button"
        aria-label={$_('dashboard.limit.clear')}
        onclick={onclear}
        class="rounded-full p-1 text-text-dim hover:text-error"
      >
        <Icon icon="mdi:close" size={18} />
      </button>
    {:else}
```

to:

```svelte
    {#if rowActive}
      {#if clearable}
        <button
          type="button"
          aria-label={$_('dashboard.limit.clear')}
          onclick={onclear}
          class="rounded-full p-1 text-text-dim hover:text-error"
        >
          <Icon icon="mdi:close" size={18} />
        </button>
      {/if}
    {:else}
```

- [ ] **Step 4: Run — expect ALL PASS** (same command; the existing `onclear` test passes because `clearable` defaults to `true`).

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/lib/components/dashboard/ChargeLimitCard.svelte src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js
git commit -m "feat(dashboard): clearable prop on the charge-limit row"
```

---

### Task 4: Dashboard — system limits lose the three delete paths

**Files:**
- Modify: `src/routes/Dashboard.svelte` (script: one derived + two guards; template: one prop)
- Test: `src/routes/__tests__/Dashboard.test.js`

- [ ] **Step 1: Write the failing tests** — append inside `describe('Dashboard', ...)`. (`limit_store`, `claims_target_store`, `EvseClients`, `httpAPI` are already imported; `beforeEach` resets `limit_store` to `{ type: 'none', ... }`.)

```js
  it('hides the limit clear button for a system (default) limit', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'energy', value: 10000, auto_release: false })
    const { queryByLabelText, getByText } = render(Dashboard)
    expect(getByText('dashboard.limit.or_limit_by')).toBeDefined // row renders (sanity)
    expect(queryByLabelText('dashboard.limit.clear')).not.toBeInTheDocument()
  })

  it('keeps the limit clear button for a user limit', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'energy', value: 10000, auto_release: true })
    const { getByLabelText } = render(Dashboard)
    expect(getByLabelText('dashboard.limit.clear')).toBeInTheDocument()
  })

  it('does not DELETE a system limit when forcing On past a trip', async () => {
    status_store.set({ state: 254, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.limit.id } })
    limit_store.set({ type: 'energy', value: 10000, auto_release: false })
    const { getByText } = render(Dashboard)
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalled() // the override write happened
    })
    expect(httpAPI).not.toHaveBeenCalledWith('DELETE', '/limit')
  })
```

- [ ] **Step 2: Run — expect the first and third new tests to FAIL** (clear button currently always renders; On currently deletes)

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`

- [ ] **Step 3: Implement** — four edits in `src/routes/Dashboard.svelte`.

(a) Add the derived flag right after the `let socRangeLimit = ...` line (~line 50):

```js
  // A default limit applied by the firmware (config limit_default_*) reports
  // auto_release: false on /limit — it's config-driven, so the dashboard
  // shows it but offers no way to delete it.
  let systemLimit = $derived($limit_store?.auto_release === false)
```

(b) In `setSegment`, change the tripped-limit removal condition from:

```js
        if (ok && seg === 'on' && limitTripped) {
          ok = await serialQueue.add(() => limit_store.remove())
        }
```

to:

```js
        // A system limit can't be cleared (the firmware would reapply it).
        if (ok && seg === 'on' && limitTripped && !systemLimit) {
          ok = await serialQueue.add(() => limit_store.remove())
        }
```

(c) In `setTarget`, change the at/above-ceiling branch from:

```js
      if (pct >= socCeiling(vehicleLimit)) {
        ok = barLimitActive ? await serialQueue.add(() => limit_store.remove()) : true
      } else {
```

to:

```js
      if (pct >= socCeiling(vehicleLimit)) {
        if (barLimitActive && systemLimit) {
          // A system (default) limit can't be cleared from the bar — snap the
          // knob back to the configured limit instead of deleting it.
          socNonce++
          ok = true
        } else {
          ok = barLimitActive ? await serialQueue.add(() => limit_store.remove()) : true
        }
      } else {
```

(d) In the template, pass the prop to `ChargeLimitCard` (add one line to its props, after `disabled={busy}`):

```svelte
            disabled={busy}
            clearable={!systemLimit}
```

- [ ] **Step 4: Run — expect ALL PASS**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
All pre-existing Dashboard tests must pass unchanged — they all use `auto_release: true` or no limit, so behavior is identical for them.

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/routes/Dashboard.svelte src/routes/__tests__/Dashboard.test.js
git commit -m "feat(dashboard): system limits show without delete affordances"
```

---

### Task 5: Verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full gates**

```bash
npm test                                                  # all green
npm run build 2>&1 | grep -c "state_referenced_locally"   # expect: 0
```

- [ ] **Step 2: Manual check on the mock server**

```bash
npm run dev:mock -- --host 0.0.0.0
```

- Settings → EVSE: the **System limit** section sits between Behaviour and Sensor. Pick *Energy*, enter a value — watch the saved checkmark; the value field shows kWh. Switch to *None* — the value field disappears.
- Dashboard: the mock `/limit` won't report a default limit by itself, so the no-delete behavior is covered by the unit tests; visually confirm the normal user-limit flow (set via "+ Set", clear via ×) is unchanged.
- Mobile width: EVSE page renders the new section normally.

- [ ] **Step 3: Report** — verified results + anything odd flagged, not silently fixed.

---

## Self-review notes (already applied)

- Spec coverage: device contract (Task 2 conversions + Task 4 discriminator), EVSE section (Task 2), all three dashboard delete paths (Task 4 a–d), i18n ×4 locales (Task 1), tests for each spec bullet (Tasks 2–4), suite green (every task + Task 5). The spec's "value resets on type change" line was aligned with gui-v2 before planning.
- Type consistency: `clearable` prop (Task 3) matches the Dashboard pass-through (Task 4d); `systemLimit` derived name used in all three guards; i18n keys referenced in Task 2 (`config.evse.limit_*`) are exactly the 8 added in Task 1.
- Test selectors verified against the real files: `BASE` omits the conditional selects so the limit-type select is `comboboxes[last]`; `getByDisplayValue('10')`/`'120'` are unique against BASE values (24, 32, 6, 0, 220, 0).
