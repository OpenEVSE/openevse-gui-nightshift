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
    onchange = () => {},
  } = $props()

  // Live knob position during a drag. Initialise from the prop so the first paint
  // is correct (matches Slider.svelte); the $effect re-syncs on later prop changes
  // — including the snap back to the ceiling after the limit is cleared.
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
    // At/above the vehicle limit there is no limit — snap the knob back to the
    // line right away. We can't rely on the parent re-syncing `target`, because
    // when nothing was set the parent's value doesn't change (it's a no-op).
    if (v >= ceiling) current = ceiling
    onchange(v)
  }

  let seg = $derived(socBarSegments({ soc, target: current, vehicleLimit }))
  let ceiling = $derived(socCeiling(vehicleLimit))
  // Above the vehicle limit (shown red, only ever transient — release snaps back).
  let above = $derived(isCapped(current, vehicleLimit))
  // Knob resting at/above the ceiling means no OpenEVSE limit.
  let atRest = $derived(current >= ceiling)

  let toFull = $derived(charging ? hmsShort(timeToFull) : '')
  let rangeUnit = $derived(rangeMiles ? $_('units.miles') : $_('units.km'))

  let lineClass = $derived(above ? 'bg-error' : 'bg-text')
  let labelClass = $derived(above ? 'border-error text-error' : 'border-border text-text')
  // Dimmed when resting (no limit); solid when an active limit is set, or red above.
  let knobOpacity = $derived(atRest && !above ? 0.55 : 1)
</script>

<div class="mt-3 rounded-xl bg-surface-2 px-3 py-3">
  <!-- header -->
  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="shrink-0 text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.vehicle.label')}</span>
    <span class="min-w-0 truncate text-xs text-text">
      {#if range != null}{range}&nbsp;{rangeUnit} · {/if}{$_('dashboard.vehicle.charging_to', {
        values: { pct: Math.round(seg.zoneEndPct) },
      })}{#if toFull} · {$_('dashboard.vehicle.to_full', { values: { time: toFull } })}{/if}
    </span>
  </div>

  <!-- bar block — reserves room above (EVSE-limit bubble) and below (vehicle-limit
       label) so neither overflows the card or collides with the header -->
  <div class="relative h-[84px]">
    <!-- track row, centred in the reserved space -->
    <div class="absolute inset-x-0 top-[28px] h-[34px]">
      <!-- track -->
      <div class="absolute inset-0 rounded-full bg-surface-3"></div>
      <!-- SOC fill: rounded left, flat right -->
      <div
        class="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-accent to-cyan-400"
        style="width: {seg.fillPct}%"
      ></div>
      <!-- "will charge to" zone -->
      {#if seg.zoneEndPct > seg.fillPct}
        <div
          class="absolute inset-y-0 bg-accent/30"
          style="left: {seg.fillPct}%; width: {seg.zoneEndPct - seg.fillPct}%"
        ></div>
      {/if}
      <!-- SOC % label inside the fill -->
      <div class="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#04121d]">
        {Math.round(soc)}%
      </div>
      <!-- invisible, accessible drag control over the track -->
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

    <!-- vehicle-limit marker: amber line over the track; label clamped to the bar -->
    {#if vehicleLimit != null}
      <div class="pointer-events-none absolute top-[28px] w-0" style="left: {vehicleLimit}%">
        <div class="absolute top-0 left-1/2 h-[34px] w-0.5 -translate-x-1/2 bg-amber-400"></div>
      </div>
      <div
        class="pointer-events-none absolute top-[66px] whitespace-nowrap text-[10px] font-semibold text-amber-400"
        style="left: {vehicleLimit}%; transform: translateX(-{vehicleLimit}%)"
      >
        {$_('dashboard.vehicle.vehicle_limit', { values: { pct: Math.round(vehicleLimit) } })}
      </div>
    {/if}

    <!-- EVSE-limit knob: bubble above (clamped so it never runs off the edge),
         wide line over the track. Red while above the vehicle limit. -->
    <div
      class="pointer-events-none absolute top-0 whitespace-nowrap rounded-md border bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold {labelClass}"
      style="left: {current}%; transform: translateX(-{current}%); opacity: {knobOpacity}"
    >
      {$_('dashboard.vehicle.evse_limit', { values: { pct: Math.round(current) } })}
    </div>
    <div class="pointer-events-none absolute top-[28px] w-0" style="left: {current}%; opacity: {knobOpacity}">
      <div class="absolute top-0 left-1/2 h-[34px] w-1.5 -translate-x-1/2 rounded-[3px] {lineClass}"></div>
    </div>
  </div>
</div>
