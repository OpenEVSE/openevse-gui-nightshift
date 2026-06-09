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
    // optional snippet rendered at the header's right edge (the card's pills)
    headerEnd = null,
  } = $props()

  // Slider geometry is in display units: minutes for time, kWh for energy.
  let max = $derived(kind === 'time' ? 480 : 100)
  let step = $derived(kind === 'time' ? 15 : 1)
  // A limit set elsewhere can exceed the scale (e.g. a 12h system default):
  // clamp the knob render; the header still shows the true remaining.
  let display = $derived(
    kind === 'time' ? Math.min(value, 480) : Math.min(Math.round(value / 1000), 100),
  )
  let active = $derived(value > 0)

  // Live knob position during a drag (display units) — same prop-mirroring
  // pattern as VehicleSocBar.
  // svelte-ignore state_referenced_locally
  let current = $state(display)
  $effect(() => {
    current = display
  })

  function fmt(v) {
    if (kind === 'time') return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
    return `${v} ${$_('units.kwh')}`
  }

  function handleInput(e) {
    current = Number(e.currentTarget.value)
  }
  function handleChange(e) {
    const v = Number(e.currentTarget.value)
    // No-change commits never emit (an idle editor must not clear) — except a
    // 0-commit while a limit is genuinely active: a sub-step limit (e.g.
    // 400 Wh) displays as 0 but must still be clearable.
    if (v === display && (v !== 0 || !active)) return
    onchange(kind === 'time' ? v : v * 1000)
  }

  // Progress toward the limit (display-unit fraction of the bar, capped).
  let fillPct = $derived.by(() => {
    if (!active || display === 0) return 0
    const prog = kind === 'time' ? progress / 60 : progress / 1000
    return Math.min(100, (prog / display) * 100) * (display / max)
  })
  let knobPct = $derived((current / max) * 100)
  // Render the marker inset ~7% from each rail so the pin never hangs off the
  // rounded track ends (the slider rests at 0, unlike the SOC bar whose values
  // rarely rail). The committed value still spans the full 0..max.
  let knobRenderPct = $derived(Math.min(93, Math.max(7, knobPct)))
  let knobOpacity = $derived(current === 0 ? 0.55 : 1)
  let remaining = $derived.by(() => {
    if (!active) return ''
    if (kind === 'time') return hmsShort(Math.max(0, value * 60 - progress))
    return `${(Math.max(0, value - progress) / 1000).toFixed(1)} ${$_('units.kwh')}`
  })
  let pillShift = $derived(Math.min(90, Math.max(10, knobPct)))
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
      <span class="shrink-0 text-[10px] text-text-dim">{fmt(max)}</span>
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
        {max}
        {step}
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
      <div data-knob class="absolute top-[28px] w-0" style="left: {knobRenderPct}%">
        <div class="absolute -top-2.5 left-1/2 h-[48px] w-2.5 -translate-x-1/2 rounded-b-[3px] bg-text"></div>
      </div>
      <div
        class="absolute top-0 rounded-md border border-text bg-surface px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-text"
        style="left: {knobRenderPct}%; transform: translateX(-{pillShift}%)"
      >
        {fmt(current)}
      </div>
    </div>
  </div>
</div>
