<script>
  import { _ } from 'svelte-i18n'
  import { untrack } from 'svelte'
  import Card from '../ui/Card.svelte'
  import Icon from '../../icons/Icon.svelte'
  import { cToF } from '../../temperature.js'

  let {
    title    = null,      // card heading (defaults to "Temperature Protection")
    throttle = 65,        // temp_throttle_setpoint °C (lower thumb)
    panic    = 72,        // over_temp_shutdown °C (upper thumb)
    min      = 40,
    max      = 82,
    gap      = 2,         // panic must stay at least `gap` °C above throttle
    busy     = false,
    checksAllOn  = null,  // null = hide banner; true/false = show on/off banner
    temperature  = null,  // current EVSE temperature °C (marker on the track)
    unit     = 'c',       // display unit for the labels: 'c' | 'f' (device is always °C)
    onThrottleChange = () => {},   // (°C) => void
    onPanicChange    = () => {},   // (°C) => void
  } = $props()

  // The device stores/streams every temperature in °C — only the *labels* here
  // follow the user's uisettings.temp_unit preference. The slider itself keeps
  // working in °C (setpoints, bounds, commit callbacks), so only the displayed
  // numbers are converted.
  let isF = $derived(unit === 'f')
  let unitLabel = $derived(isF ? $_('units.fahrenheit') : $_('units.celsius'))
  const disp = (c) => Math.round(isF ? cToF(c) : c)

  // Live thumb positions during a drag (committed on change). Same prop-mirror
  // pattern as Slider.svelte / LimitSliderBar.
  let lo = $state(untrack(() => throttle))
  let hi = $state(untrack(() => panic))
  $effect(() => { lo = throttle })
  $effect(() => { hi = panic })

  let loPct = $derived(max > min ? ((lo - min) / (max - min)) * 100 : 0)
  let hiPct = $derived(max > min ? ((hi - min) / (max - min)) * 100 : 0)

  // EVSE temperature marker, clamped to the slider's range.
  let hasTemp = $derived(typeof temperature === 'number' && Number.isFinite(temperature))
  let tempPct = $derived(
    hasTemp ? Math.min(100, Math.max(0, ((temperature - min) / (max - min)) * 100)) : 0
  )
  // Reading pill offset — shifted by -pillShift% of its own width (clamped 20–80%,
  // the same treatment as the limit sliders' value pill) so a reading near the
  // rails doesn't spill past the card edge. Placing the stem at pillShift% across
  // the shifted pill cancels the offset, so it still points at the true tempPct.
  let pillShift = $derived(Math.min(80, Math.max(20, tempPct)))

  // Lower thumb may not cross within `gap` of the upper, and vice-versa.
  // Instead of stopping the dragged thumb at the gap, push the other thumb
  // along (within [min, max]) so the two can never cross.
  function handleLoInput(e) {
    lo = Math.min(Number(e.currentTarget.value), max - gap)
    if (hi < lo + gap) hi = lo + gap
  }
  function handleHiInput(e) {
    hi = Math.max(Number(e.currentTarget.value), min + gap)
    if (lo > hi - gap) lo = hi - gap
  }
  // Commit reads the event value (not just the live `lo`/`hi` state) so a
  // change event that didn't fire input still emits the pushed values, and
  // emits both thumbs when the push moved the other one.
  function commitLo(e) {
    const v = Math.min(Number(e.currentTarget.value), max - gap)
    lo = v
    const newHi = Math.max(hi, v + gap)
    hi = newHi
    if (v !== throttle) onThrottleChange(v)
    if (newHi !== panic) onPanicChange(newHi)
  }
  function commitHi(e) {
    const v = Math.max(Number(e.currentTarget.value), min + gap)
    hi = v
    const newLo = Math.min(lo, v - gap)
    lo = newLo
    if (v !== panic) onPanicChange(v)
    if (newLo !== throttle) onThrottleChange(newLo)
  }
</script>

<Card class="mb-3 p-4">
  <!-- Title · safety-checks banner -->
  <div class="mb-3 flex items-center justify-between gap-2">
    <div class="text-sm font-semibold text-text">{title ?? $_('charge_manager.temp_protection')}</div>
    {#if checksAllOn !== null}
      {#if checksAllOn}
        <span class="truncate text-xs font-semibold text-success">{$_('config.safety.all_on')}</span>
      {:else}
        <span class="truncate text-xs font-semibold text-warning">{$_('config.safety.warning')}</span>
      {/if}
    {/if}
  </div>

  <!-- Legend -->
  <div class="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-wide text-text-dim">
    <span>
      {$_('config.safety.temp_throttle')}
      <span class="font-semibold normal-case text-accent">{disp(lo)}{unitLabel}</span>
    </span>
    <span>
      {$_('config.safety.temp_panic')}
      <span class="font-semibold normal-case text-warning">{disp(hi)}{unitLabel}</span>
    </span>
  </div>

  <!-- Dual-thumb range: two overlaid inputs, thumbs grabbable, track shows the
       throttle→panic band. The enforced gap means the thumbs never overlap.
       pt-6 leaves room for the live EVSE-temperature marker above the track. -->
  <div class="relative pt-6">
    {#if hasTemp}
      <div
        class="pointer-events-none absolute top-0 z-10 flex items-center gap-0.5 whitespace-nowrap rounded bg-surface-3 px-1 py-0.5 text-[10px] font-semibold text-text ring-1 ring-border"
        style="left: {tempPct}%; transform: translateX(-{pillShift}%)"
      >
        <Icon icon="mdi:thermometer" size={11} />
        {disp(temperature)}{unitLabel}
        <!-- Stem points down at the reading on the track. At pillShift% across the
             edge-clamped pill it lands on the true tempPct (the shift cancels). -->
        <span
          class="absolute top-full h-2 w-px -translate-x-1/2 bg-text-dim"
          style="left: {pillShift}%"
        ></span>
      </div>
    {/if}

  <div class="dual relative h-6">
    <div class="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-3"></div>
    <div
      class="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-accent to-warning"
      style="left: {loPct}%; width: {hiPct - loPct}%"
    ></div>

    <input
      class="thumb thumb-lo"
      type="range"
      {min} {max} step="1"
      value={lo}
      disabled={busy}
      aria-label={$_('config.safety.temp_throttle')}
      oninput={handleLoInput}
      onchange={commitLo}
    />
    <input
      class="thumb thumb-hi"
      type="range"
      {min} {max} step="1"
      value={hi}
      disabled={busy}
      aria-label={$_('config.safety.temp_panic')}
      oninput={handleHiInput}
      onchange={commitHi}
    />
  </div>
  </div>

  <div class="mt-1 flex justify-between text-[10px] text-text-dim">
    <span>{disp(min)}{unitLabel}</span>
    <span>{disp(max)}{unitLabel}</span>
  </div>
</Card>

<style>
  /* Two range inputs stacked: the track is transparent (drawn by the divs
     above), only the thumbs receive pointer events so both stay grabbable. */
  .dual .thumb {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    background: transparent;
    pointer-events: none;
    -webkit-appearance: none;
    appearance: none;
  }
  .dual .thumb-lo { z-index: 3; }
  .dual .thumb-hi { z-index: 4; }
  .dual .thumb:disabled { opacity: 0.4; }

  .dual .thumb::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    height: 1.25rem;
    width: 1.25rem;
    border-radius: 9999px;
    background: var(--color-accent);
    border: 2px solid var(--color-surface, #fff);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }
  .dual .thumb-hi::-webkit-slider-thumb { background: var(--color-warning); }

  .dual .thumb::-moz-range-thumb {
    pointer-events: auto;
    height: 1.25rem;
    width: 1.25rem;
    border-radius: 9999px;
    background: var(--color-accent);
    border: 2px solid var(--color-surface, #fff);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }
  .dual .thumb-hi::-moz-range-thumb { background: var(--color-warning); }
  .dual .thumb::-moz-range-track { background: transparent; }
</style>
