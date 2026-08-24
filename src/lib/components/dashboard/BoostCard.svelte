<script>
  // Boost surface: pick a dimension (time / energy / soc / range) and a value,
  // then arm a device-side "charge NOW until target" claim. The firmware owns
  // the countdown — this component never runs a client timer as the source of
  // truth; it only interpolates the *time* remaining by the wall-seconds since
  // the last device read (reset on every read), so a reboot that clears the
  // boost can't leave a phantom counting down.
  import { _ } from 'svelte-i18n'
  import Button from '../ui/Button.svelte'

  let {
    active = null,          // live boost {type, value, remaining, started} or null
    hasSoc = false,
    canRange = false,
    soc = 0,                // current battery %, to floor the soc target
    range = null,           // current range, to floor the range target
    estMaxRange = null,     // range estimate, ceilings the range slider
    rangeMiles = false,
    maxEnergyKwh = 100,
    disabled = false,
    onarm = () => {},       // ({type, value}) — value already in device units
    oncancel = () => {},
  } = $props()

  const rangeUnit = $derived($_(rangeMiles ? 'units.miles' : 'units.km'))

  // ── dimension selection ────────────────────────────────────────────────
  let dims = $derived([
    { id: 'time', labelKey: 'dashboard.boost.type_time' },
    { id: 'energy', labelKey: 'dashboard.boost.type_energy' },
    ...(hasSoc ? [{ id: 'soc', labelKey: 'dashboard.boost.type_soc' }] : []),
    ...(canRange ? [{ id: 'range', labelKey: 'dashboard.boost.type_range' }] : []),
  ])
  let userPick = $state('time')
  let selected = $derived(dims.some((d) => d.id === userPick) ? userPick : 'time')

  // The picker stays collapsed behind a single "Boost" button until tapped, so
  // the resting dashboard isn't a second wall of dimension pills next to the
  // charge-limit card. The active Boosting strip shows independently.
  let expanded = $state(false)

  // ── per-dimension value state (in the slider's own units) ───────────────
  let timeMin = $state(30) // minutes → seconds on submit
  let energyKwh = $state(5) // kWh → Wh on submit
  let socTarget = $state(80) // percent, absolute
  let rangeVal = $state(160) // absolute distance in the configured unit

  // Floor the soc target just above the current level (5-point steps) so the
  // slider can't arm an already-met target. Clamp the stored pick up too.
  let socMin = $derived(Math.min(95, Math.max(5, Math.ceil((soc + 1) / 5) * 5)))
  $effect(() => {
    if (socTarget < socMin) socTarget = socMin
  })
  let energyMax = $derived(Math.max(5, Math.round(maxEnergyKwh)))
  let rangeMax = $derived(
    Number.isFinite(estMaxRange) && estMaxRange > 0 ? Math.ceil(estMaxRange / 10) * 10 : 400,
  )
  // Floor the range target just above the current range (10-unit steps), the
  // same guard socMin gives soc — otherwise an already-met range target arms,
  // returns 201, and silently reconciles to nothing with no user explanation.
  // Kept a step below the ceiling so the slider always has a usable span.
  let rangeMin = $derived.by(() => {
    const floor = Number.isFinite(range) && range > 0 ? Math.ceil((range + 1) / 10) * 10 : 10
    return Math.max(10, Math.min(floor, rangeMax - 10))
  })
  $effect(() => {
    if (rangeVal < rangeMin) rangeVal = rangeMin
  })

  // Active slider config for the selected dimension.
  let cfg = $derived.by(() => {
    switch (selected) {
      case 'energy':
        return { min: 1, max: energyMax, step: 1, get: () => energyKwh, set: (v) => (energyKwh = v) }
      case 'soc':
        return { min: socMin, max: 100, step: 5, get: () => socTarget, set: (v) => (socTarget = v) }
      case 'range':
        return { min: rangeMin, max: rangeMax, step: 10, get: () => rangeVal, set: (v) => (rangeVal = v) }
      default: // time
        return { min: 15, max: 480, step: 15, get: () => timeMin, set: (v) => (timeMin = v) }
    }
  })

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec))
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }
  function fmtMins(min) {
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
    return `${m} min`
  }

  // Live readout of the arm slider's current pick.
  let valueLabel = $derived.by(() => {
    if (selected === 'time') return fmtMins(timeMin)
    if (selected === 'energy') return `${energyKwh} ${$_('units.kwh')}`
    if (selected === 'soc') return `${socTarget}${$_('units.percent')}`
    return `${rangeVal} ${rangeUnit}`
  })

  function onSlide(e) {
    cfg.set(Number(e.currentTarget.value))
  }

  function arm() {
    if (disabled) return
    if (selected === 'time') onarm({ type: 'time', value: timeMin * 60 })
    else if (selected === 'energy') onarm({ type: 'energy', value: energyKwh * 1000 })
    else if (selected === 'soc') onarm({ type: 'soc', value: socTarget })
    else onarm({ type: 'range', value: rangeVal })
    // Collapse back to the button once armed; the active strip takes over.
    // A rejected arm (rare — soc/range are pre-gated) still collapses, and the
    // alert explains why; re-open to adjust.
    expanded = false
  }

  // ── active-boost readout (device-owned) ─────────────────────────────────
  // Interpolate only the time countdown. base resets whenever the device
  // reports a fresh `remaining`, keeping the device authoritative.
  let now = $state(Date.now())
  let base = $state(null)
  $effect(() => {
    if (active && active.type === 'time' && typeof active.remaining === 'number') {
      base = { remaining: active.remaining, at: Date.now() }
    } else {
      base = null
    }
  })
  $effect(() => {
    if (!base) return
    const id = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(id)
  })
  let liveRemaining = $derived(
    base ? Math.max(0, base.remaining - Math.floor((now - base.at) / 1000)) : (active?.remaining ?? 0),
  )

  let targetText = $derived.by(() => {
    if (!active) return ''
    if (active.type === 'time') return $_('dashboard.boost.for', { values: { value: fmtDur(active.value) } })
    if (active.type === 'energy')
      return $_('dashboard.boost.add', { values: { value: `${(active.value / 1000).toFixed(1)} ${$_('units.kwh')}` } })
    if (active.type === 'soc')
      return $_('dashboard.boost.until', { values: { value: `${active.value}${$_('units.percent')}` } })
    return $_('dashboard.boost.until', { values: { value: `${active.value} ${rangeUnit}` } })
  })
  let remainingText = $derived.by(() => {
    if (!active) return ''
    const left = $_('dashboard.limit.left')
    if (active.type === 'time') return `${fmtDur(liveRemaining)} ${left}`
    if (active.type === 'energy') return `${(active.remaining / 1000).toFixed(1)} ${$_('units.kwh')} ${left}`
    if (active.type === 'soc') return `${active.remaining}${$_('units.percent')} ${left}`
    return `${active.remaining} ${rangeUnit} ${left}`
  })
</script>

<div class="mt-2 space-y-2">
  {#if active}
    <div
      data-boost-active
      class="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3"
    >
      <div class="min-w-0">
        <div class="text-sm font-semibold text-accent">{$_('dashboard.boost.active_prefix')}</div>
        <div class="truncate text-xs text-text-dim">{targetText} · {remainingText}</div>
      </div>
      <div class="shrink-0">
        <Button label={$_('dashboard.boost.cancel_active')} variant="ghost" {disabled} onclick={oncancel} />
      </div>
    </div>
  {/if}

  {#if !expanded}
    <!-- Resting state: a single button. "Replace boost" while one is active,
         otherwise "Boost". Tapping reveals the picker below. -->
    <Button
      label={active ? $_('dashboard.boost.replace') : $_('dashboard.boost.label')}
      variant="ghost"
      {disabled}
      onclick={() => (expanded = true)}
    />
  {:else}
    <div class="rounded-xl bg-surface-2 px-3 py-3">
      <!-- header: current pick on the left, dimension pills on the right -->
      <div class="mb-3 flex items-center justify-between gap-2 text-xs">
        <span class="min-w-0 truncate text-text">{valueLabel}</span>
        <div
          role="radiogroup"
          aria-label={$_('dashboard.boost.pills_aria')}
          class="flex shrink-0 flex-wrap justify-end gap-1.5"
        >
          {#each dims as dim}
            <button
              type="button"
              role="radio"
              aria-checked={selected === dim.id}
              {disabled}
              onclick={() => (userPick = dim.id)}
              class="rounded-full border px-3 py-1 text-[11px] font-semibold transition
                     disabled:cursor-not-allowed disabled:opacity-40
                     {selected === dim.id ? 'border-accent text-accent' : 'border-border text-text-dim'}"
            >
              {$_(dim.labelKey)}
            </button>
          {/each}
        </div>
      </div>

      <input
        type="range"
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={cfg.get()}
        {disabled}
        aria-label={$_(`dashboard.boost.type_${selected}`)}
        oninput={onSlide}
        class="w-full cursor-pointer accent-accent disabled:cursor-not-allowed"
      />

      <div class="mt-3 flex gap-2">
        <div class="flex-[2]">
          <Button
            label={active ? $_('dashboard.boost.replace') : $_('dashboard.boost.arm')}
            {disabled}
            onclick={arm}
          />
        </div>
        <div class="flex-1">
          <Button label={$_('dashboard.boost.close')} variant="ghost" onclick={() => (expanded = false)} />
        </div>
      </div>
    </div>
  {/if}
</div>
