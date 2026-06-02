<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'
  import { socBarSegments, isCapped, hmsShort } from '../../dashboard/soc.js'

  let {
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    limitActive = false,
    disabled = false,
    onchange = () => {},
    onclear = () => {},
  } = $props()

  // Live position during a drag; resyncs whenever the committed target changes.
  // Initialise from the prop so the first paint is correct (matches Slider.svelte);
  // the $effect re-syncs on later prop changes. The warning is a false positive here.
  // svelte-ignore state_referenced_locally
  let current = $state(target)
  $effect(() => {
    current = target
  })

  function handleInput(e) {
    current = Number(e.currentTarget.value)
  }
  function handleChange(e) {
    onchange(Number(e.currentTarget.value))
  }

  let seg = $derived(socBarSegments({ soc, target: current, vehicleLimit }))
  let capped = $derived(isCapped(current, vehicleLimit))
  let toFull = $derived(charging ? hmsShort(timeToFull) : '')
  let rangeUnit = $derived(rangeMiles ? $_('units.miles') : $_('units.km'))
  // The target line is dimmed when it's not an active limit, or when capped.
  let dim = $derived(!limitActive || capped)
</script>

<div class="mt-3 rounded-xl bg-surface-2 px-3 py-3">
  <!-- header -->
  <div class="mb-7 flex items-baseline justify-between">
    <span class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.vehicle.label')}</span>
    <span class="text-xs text-text">
      {#if range != null}{range}&nbsp;{rangeUnit} · {/if}{$_('dashboard.vehicle.charging_to', {
        values: { pct: Math.round(seg.zoneEndPct) },
      })}{#if toFull} · {$_('dashboard.vehicle.to_full', { values: { time: toFull } })}{/if}
    </span>
  </div>

  <!-- bar -->
  <div class="relative h-[34px]">
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
    <!-- unreachable region when capped -->
    {#if capped}
      <div
        class="absolute inset-y-0"
        style="left: {seg.hatchStartPct}%; width: {seg.hatchEndPct - seg.hatchStartPct}%;
               background: repeating-linear-gradient(45deg, rgba(251,191,36,.10) 0 4px, transparent 4px 8px)"
      ></div>
    {/if}
    <!-- SOC % label inside the fill -->
    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#04121d]">
      {Math.round(soc)}%
    </div>

    <!-- vehicle-limit marker: thin amber line, label below -->
    {#if vehicleLimit != null}
      <div class="absolute -top-1.5 -bottom-6 w-0" style="left: {vehicleLimit}%">
        <div class="absolute left-1/2 top-0 bottom-[18px] w-0.5 -translate-x-1/2 bg-amber-400"></div>
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-amber-400">
          {$_('dashboard.vehicle.vehicle_limit', { values: { pct: Math.round(vehicleLimit) } })}
        </div>
      </div>
    {/if}

    <!-- target: wide white line, bubble label above -->
    <div class="absolute -top-[34px] -bottom-2 w-0" style="left: {current}%; opacity: {dim ? 0.55 : 1}">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-text">
        {$_('dashboard.vehicle.target', { values: { pct: Math.round(current) } })}
      </div>
      <div class="absolute top-[26px] bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-[3px] bg-text"></div>
    </div>

    <!-- invisible, accessible drag control over the whole bar -->
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

    <!-- clear the soc limit (only when one is active) -->
    {#if limitActive}
      <button
        type="button"
        aria-label={$_('dashboard.vehicle.clear')}
        onclick={onclear}
        class="absolute -right-1 -top-7 rounded-full p-1 text-text-dim hover:text-error"
      >
        <Icon icon="mdi:close" size={16} />
      </button>
    {/if}
  </div>

  <!-- cap note -->
  {#if capped}
    <div class="mt-2 flex items-center gap-1.5 text-[11.5px] text-amber-400">
      <Icon icon="mdi:alert" size={14} />
      <span>{$_('dashboard.vehicle.cap_note', { values: { pct: Math.round(vehicleLimit) } })}</span>
    </div>
  {/if}
</div>
