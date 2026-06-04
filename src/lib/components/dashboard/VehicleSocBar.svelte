<script>
  import { _ } from 'svelte-i18n'
  import { socBarSegments, isCapped, socCeiling, hmsShort } from '../../dashboard/soc.js'

  let {
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    disabled = false,
    unit = 'percent',
    estMaxRange = null,
    onchange = () => {},
    onunit = () => {},
  } = $props()

  // Live knob position during a drag (percent). Initialise from the prop so the
  // first paint is correct; the $effect re-syncs on later prop changes, including
  // the snap back to the ceiling after the limit is cleared.
  // svelte-ignore state_referenced_locally
  let current = $state(target)
  $effect(() => {
    current = target
  })

  function handleInput(e) {
    current = Number(e.currentTarget.value)
  }
  function handleChange(e) {
    const v = Number(e.currentTarget.value)
    if (v >= ceiling) current = ceiling // at/above the vehicle limit = no limit
    onchange(v)
  }

  let seg = $derived(socBarSegments({ soc, target: current, vehicleLimit }))
  let ceiling = $derived(socCeiling(vehicleLimit))
  let above = $derived(isCapped(current, vehicleLimit))
  let atRest = $derived(current >= ceiling)
  let toFull = $derived(charging ? hmsShort(timeToFull) : '')
  let rangeUnitLabel = $derived(rangeMiles ? $_('units.miles') : $_('units.km'))
  let showUnitToggle = $derived(Number.isFinite(estMaxRange))
  let rangeMode = $derived(unit === 'range' && Number.isFinite(estMaxRange))

  // Format a bar percentage in the active unit: "60%" or "167 km".
  function fmt(pct) {
    if (rangeMode) return `${Math.round((pct / 100) * estMaxRange)} ${rangeUnitLabel}`
    return `${Math.round(pct)}%`
  }

  // "74% → 80%" / "206 → 223 km" while charging toward the target; collapses to
  // just the current value once SOC has reached/passed the effective target.
  function rangeAt(pct) {
    return Math.round((pct / 100) * estMaxRange)
  }
  let progress = $derived.by(() => {
    if (rangeMode) {
      const cur = range ?? rangeAt(soc)
      const tgt = rangeAt(seg.zoneEndPct)
      return cur >= tgt ? `${cur} ${rangeUnitLabel}` : `${cur} → ${tgt} ${rangeUnitLabel}`
    }
    const cur = Math.round(soc)
    const tgt = Math.round(seg.zoneEndPct)
    return cur >= tgt ? `${cur}%` : `${cur}% → ${tgt}%`
  })

  let lineClass = $derived(above ? 'bg-error' : 'bg-text')
  let labelClass = $derived(above ? 'border-error text-error' : 'border-border text-text')
  let knobOpacity = $derived(atRest && !above ? 0.55 : 1)
</script>

<div>
  <!-- header: info line + (when range known) the % / unit toggle -->
  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="min-w-0 truncate text-xs text-text">
      {progress}{#if toFull} · {$_('dashboard.vehicle.to_full', { values: { time: toFull } })}{/if}
    </span>
    {#if showUnitToggle}
      <div
        role="group"
        aria-label={$_('dashboard.vehicle.unit_aria')}
        class="flex shrink-0 overflow-hidden rounded-full border border-border text-[10px] font-bold"
      >
        <button
          type="button"
          aria-pressed={unit === 'percent'}
          onclick={() => onunit('percent')}
          class="px-2 py-0.5 {unit === 'percent' ? 'bg-accent text-surface' : 'text-text-dim'}"
        >%</button>
        <button
          type="button"
          aria-pressed={unit === 'range'}
          onclick={() => onunit('range')}
          class="px-2 py-0.5 {unit === 'range' ? 'bg-accent text-surface' : 'text-text-dim'}"
        >{rangeUnitLabel}</button>
      </div>
    {/if}
  </div>

  <!-- bar block — percent geometry; labels via fmt() -->
  <div class="relative h-[84px]">
    <div class="absolute inset-x-0 top-[28px] h-[34px]">
      <div class="absolute inset-0 rounded-full bg-surface-3"></div>
      <div
        class="absolute inset-y-0 left-0 rounded-l-full {charging
          ? 'soc-shimmer'
          : 'bg-gradient-to-r from-accent to-cyan-400'}"
        style="width: {seg.fillPct}%"
      ></div>
      {#if seg.zoneEndPct > seg.fillPct}
        <div
          class="absolute inset-y-0 bg-accent/30"
          style="left: {seg.fillPct}%; width: {seg.zoneEndPct - seg.fillPct}%"
        ></div>
      {/if}
      <div class="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#04121d]">
        {fmt(soc)}
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={current}
        {disabled}
        aria-label={$_('dashboard.vehicle.target_aria')}
        oninput={handleInput}
        onchange={handleChange}
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>

    {#if vehicleLimit != null}
      <div class="pointer-events-none absolute top-[28px] w-0" style="left: {vehicleLimit}%">
        <div class="absolute top-0 left-1/2 h-[34px] w-0.5 -translate-x-1/2 bg-amber-400"></div>
      </div>
      <div
        class="pointer-events-none absolute top-[66px] whitespace-nowrap text-[10px] font-semibold text-amber-400"
        style="left: {vehicleLimit}%; transform: translateX(-{vehicleLimit}%)"
      >
        {$_('dashboard.vehicle.vehicle_limit', { values: { value: fmt(vehicleLimit) } })}
      </div>
    {/if}

    <div
      class="pointer-events-none absolute top-0 whitespace-nowrap rounded-md border bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold {labelClass}"
      style="left: {current}%; transform: translateX(-{current}%); opacity: {knobOpacity}"
    >
      {$_('dashboard.vehicle.evse_limit', { values: { value: fmt(current) } })}
    </div>
    <div class="pointer-events-none absolute top-[28px] w-0" style="left: {current}%; opacity: {knobOpacity}">
      <div class="absolute -top-1.5 left-1/2 h-[40px] w-2.5 -translate-x-1/2 rounded-[3px] {lineClass}"></div>
    </div>
  </div>
</div>
