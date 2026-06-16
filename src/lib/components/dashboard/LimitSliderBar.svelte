<!-- src/lib/components/dashboard/LimitSliderBar.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { hmsShort } from '../../dashboard/soc.js'

  let {
    kind = 'time', // 'time' | 'energy'
    value = 0, // device units: minutes (time) | Wh (energy); 0 = no limit
    progress = 0, // session elapsed seconds | session energy Wh
    charging = false,
    disabled = false,
    onchange = () => {}, // device units; 0 = clear
    maxEnergyKwh = 100, // top of the energy scale, in kWh (user-configurable)
    // optional snippet rendered at the header's right edge (the card's pills)
    headerEnd = null,
  } = $props()

  // The slider operates in tick space — each notch is an equal drag distance,
  // but the time stops coarsen as they grow (15-min steps to 4 h, 30-min to
  // 8 h, then hourly to 24 h) so the common short limits keep fine control
  // without making a 24 h track twitchy. Energy stays a 1:1 kWh scale, but its
  // ceiling is user-configurable — a narrower max gives finer control for
  // small packs; a wider one covers >100 kWh batteries.
  const TIME_STOPS = []
  for (let m = 0; m <= 240; m += 15) TIME_STOPS.push(m)
  for (let m = 270; m <= 480; m += 30) TIME_STOPS.push(m)
  for (let m = 540; m <= 1440; m += 60) TIME_STOPS.push(m)
  let kwhMax = $derived(Math.max(1, Math.round(maxEnergyKwh || 100)))
  let kwhStops = $derived(Array.from({ length: kwhMax + 1 }, (_, i) => i))

  let stops = $derived(kind === 'time' ? TIME_STOPS : kwhStops)
  let maxTick = $derived(stops.length - 1)
  // A limit set elsewhere can exceed the scale: clamp the knob render; the
  // header still shows the true remaining.
  let display = $derived(
    kind === 'time'
      ? Math.min(value, TIME_STOPS[TIME_STOPS.length - 1])
      : Math.min(Math.round(value / 1000), kwhMax),
  )
  let active = $derived(value > 0)

  /** Display value -> fractional tick position (for the fill + off-stop limits). */
  function fracTick(v) {
    if (!(v > 0)) return 0
    if (v >= stops[maxTick]) return maxTick
    let i = 0
    while (stops[i + 1] <= v) i++
    return i + (v - stops[i]) / (stops[i + 1] - stops[i])
  }

  // Live knob position during a drag (tick index) — same prop-mirroring
  // pattern as VehicleSocBar.
  // svelte-ignore state_referenced_locally
  let current = $state(Math.round(fracTick(display)))
  $effect(() => {
    current = Math.round(fracTick(display))
  })

  function fmt(v) {
    if (kind === 'time') return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
    return `${v} ${$_('units.kwh')}`
  }

  function handleInput(e) {
    current = Number(e.currentTarget.value)
  }
  function handleChange(e) {
    const v = stops[Number(e.currentTarget.value)]
    // No-change commits never emit (an idle editor must not clear) — except a
    // 0-commit while a limit is genuinely active: a sub-step limit (e.g.
    // 400 Wh) displays as 0 but must still be clearable.
    if (v === display && (v !== 0 || !active)) return
    onchange(kind === 'time' ? v : v * 1000)
  }

  // Progress toward the limit (tick fraction of the bar, capped at the knob
  // so the fill meets the pin exactly when the limit trips).
  let fillPct = $derived.by(() => {
    if (!active || display === 0) return 0
    const prog = kind === 'time' ? progress / 60 : progress / 1000
    return (Math.min(fracTick(prog), fracTick(display)) / maxTick) * 100
  })
  let knobPct = $derived((current / maxTick) * 100)
  let knobOpacity = $derived(current === 0 ? 0.55 : 1)
  let remaining = $derived.by(() => {
    if (!active) return ''
    if (kind === 'time') return hmsShort(Math.max(0, value * 60 - progress))
    return `${(Math.max(0, value - progress) / 1000).toFixed(1)} ${$_('units.kwh')}`
  })
  // Same mechanism as the SOC bar, but clamped tighter (20/80 vs 10/90): the
  // stem sits pillShift% across the pill's own width, and these pills are
  // narrow ("0:00"), so 10% of pill width is less than half the stem — the
  // stem would poke out of the pill's edge at the rails.
  let pillShift = $derived(Math.min(80, Math.max(20, knobPct)))
</script>

<div>
  <!-- header: remaining / hint on the left; the card's pills (when provided)
       take the right edge, otherwise the scale max shows there. -->
  <div class="mb-3 flex items-center justify-between gap-2 text-xs">
    <span class="min-w-0 truncate text-text">
      {#if active && remaining}
        {remaining} {$_('dashboard.limit.left')}
      {:else if !active}
        <span class="text-text-dim">{$_('dashboard.limit.drag_to_set')}</span>
      {/if}
    </span>
    {#if headerEnd}
      {@render headerEnd()}
    {:else}
      <span class="shrink-0 text-[10px] text-text-dim">{fmt(stops[maxTick])}</span>
    {/if}
  </div>

  <!-- bar block — same geometry family as VehicleSocBar -->
  <div class="relative h-[72px]">
    <div class="absolute inset-x-0 top-[28px] h-[34px]">
      <div class="absolute inset-0 rounded-full bg-surface-3"></div>
      <div
        data-fill
        class="absolute inset-y-0 left-0 rounded-l-full {charging && active
          ? 'soc-shimmer'
          : 'bg-gradient-to-r from-accent to-cyan-400'}"
        style="width: {fillPct}%"
      ></div>
      <input
        type="range"
        min="0"
        max={maxTick}
        step="1"
        value={current}
        {disabled}
        aria-label={$_(kind === 'time' ? 'dashboard.limit.type_time' : 'dashboard.limit.type_energy')}
        oninput={handleInput}
        onchange={handleChange}
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>

    <!-- knob pin + value pill (one opacity layer, like the SOC bar) -->
    <div class="pointer-events-none absolute inset-0" style="opacity: {knobOpacity}">
      <div data-knob class="absolute top-[28px] w-0" style="left: {knobPct}%">
        <div class="absolute -top-2.5 left-1/2 h-[48px] w-2.5 -translate-x-1/2 rounded-b-[3px] bg-text"></div>
      </div>
      <div
        data-pill
        class="absolute top-0 rounded-md border border-text bg-surface px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-text"
        style="left: {knobPct}%; transform: translateX(-{pillShift}%)"
      >
        {fmt(stops[current])}
      </div>
    </div>
  </div>
</div>
