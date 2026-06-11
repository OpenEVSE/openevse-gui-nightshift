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
    // optional snippet rendered at the header's right edge (the card's pills)
    headerEnd = null,
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
  // Pill is outlined in the knob colour (not filled) over an opaque surface bg
  // so the stem tucks behind it; border + text use the knob colour to read as
  // one marker.
  let labelClass = $derived(
    above ? 'border border-error text-error bg-surface' : 'border border-text text-text bg-surface',
  )
  let knobOpacity = $derived(atRest && !above ? 0.55 : 1)
  // The pill shifts to stay in view (translateX of its own width), but the
  // fixed-width stem sits at the exact value. Clamping the shift keeps the
  // stem from poking out the pill's edge near 0/100% — the pill instead spills
  // a few px into the card padding.
  let pillShift = $derived(Math.min(90, Math.max(10, current)))
</script>

<div>
  <!-- header: info line left, the card's pills (when provided) right. The
       "to full" note shares the line only where there's room; on phones it
       moves to a caption under the bar instead of colliding with the pills. -->
  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="min-w-0 truncate text-xs text-text">
      <!-- ml-1, not a leading space: Svelte collapses the whitespace away -->
      {progress}{#if toFull}<span class="ml-1 max-sm:hidden">· {$_('dashboard.vehicle.to_full', { values: { time: toFull } })}</span>{/if}
    </span>
    {@render headerEnd?.()}
  </div>

  <!-- bar block — percent geometry; labels via fmt() -->
  <div class="relative h-[72px]">
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
      <!-- Vehicle's own charge limit. The amber line runs through the bar (the
           slider sits on top there, so dragging still works) and pokes a little
           below it. The hover target (peer) lives entirely BELOW the bar floor
           so it never covers the slider; hovering it reveals the tooltip. The
           tooltip is positioned like a label pill (translateX of its own offset)
           so a wide multi-line tip can't run off the card edge. -->
      <div class="pointer-events-none absolute top-[28px] w-0" style="left: {vehicleLimit}%">
        <div class="absolute top-0 left-1/2 h-[34px] w-0.5 -translate-x-1/2 bg-amber-400"></div>
      </div>
      <div
        class="peer absolute top-[62px] z-10 h-[16px] w-5 -translate-x-1/2 cursor-help"
        style="left: {vehicleLimit}%"
        aria-label={$_('dashboard.vehicle.vehicle_limit_tip', { values: { value: fmt(vehicleLimit) } })}
      ></div>
      <div
        role="tooltip"
        class="pointer-events-none absolute top-[74px] z-10 max-w-[300px] whitespace-normal rounded-md border border-amber-400 bg-surface px-2 py-1 text-[10px] font-semibold leading-snug text-amber-400 opacity-0 shadow-lg transition-opacity duration-150 peer-hover:opacity-100"
        style="left: {vehicleLimit}%; transform: translateX(-{vehicleLimit}%)"
      >
        {$_('dashboard.vehicle.vehicle_limit_tip', { values: { value: fmt(vehicleLimit) } })}
      </div>
    {/if}

    <!-- Pill + stem share one opacity layer so the overlap doesn't compound
         (two dimmed same-colour layers would otherwise read darker). The stem
         comes first so the opaque pill renders on top, hiding the stem's top
         edge — the marker reads as one solid pin. -->
    <div class="pointer-events-none absolute inset-0" style="opacity: {knobOpacity}">
      <div class="absolute top-[28px] w-0" style="left: {current}%">
        <div class="absolute -top-2.5 left-1/2 h-[48px] w-2.5 -translate-x-1/2 rounded-b-[3px] {lineClass}"></div>
      </div>
      <div
        class="absolute top-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold {labelClass}"
        style="left: {current}%; transform: translateX(-{pillShift}%)"
      >
        {$_('dashboard.vehicle.evse_limit', { values: { value: fmt(current) } })}
      </div>
    </div>
  </div>

  {#if toFull}
    <!-- phone slot for the "to full" note (the header shows it from sm: up) -->
    <div class="mt-1 text-[10px] text-text-dim sm:hidden">
      {$_('dashboard.vehicle.to_full', { values: { time: toFull } })}
    </div>
  {/if}
</div>
