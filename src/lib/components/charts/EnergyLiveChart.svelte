<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../stores/config.js'
  import UplotChart from './UplotChart.svelte'
  import { readChartTheme } from './chartTheme.js'
  import { socOrNull } from '../../dashboard/sessionChart.js'

  /** @type {{ samples: Array<{ts:number,a:number,t:number,e:number,s:number}> }} */
  let { samples = [] } = $props()

  // Only draw the SOC axis/line when a vehicle source actually reported it,
  // so devices without vehicle integration don't get an empty green axis.
  let hasSoc = $derived(samples.some((s) => socOrNull(s) != null))

  // On a phone the chart can't afford a second right-hand axis: temperature
  // and SOC stacked there crush the plot. When narrow we keep the SOC line
  // (and its legend read-out) but drop its dedicated axis. Seed synchronously
  // so the first paint already has the right axes, then track viewport changes.
  const NARROW_MQ = '(max-width: 640px)'
  const matchesNarrow = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(NARROW_MQ).matches
      : false
  let narrow = $state(matchesNarrow())
  $effect(() => {
    const mq = window.matchMedia(NARROW_MQ)
    const sync = () => (narrow = mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  })

  let data = $derived.by(() => {
    const x = samples.map((s) => s.ts)
    const a = samples.map((s) => s.a)
    const t = samples.map((s) => (s.t > 0 ? s.t : null))
    const base = [x, a, t]
    return hasSoc ? [...base, samples.map(socOrNull)] : base
  })

  let opts = $derived.by(() => {
    const theme = readChartTheme()
    // Headroom that survives broken config: never below 40 A, always above the
    // highest observed sample. max_current_hard reports 0 on some firmware
    // builds (and the mock fixture), which would otherwise crush the trace.
    const hardCap = $config_store?.max_current_hard
    const peak = samples.length ? Math.max(...samples.map((s) => s.a ?? 0)) : 0
    const ampMax = Math.max(40, peak + 5, (hardCap || 0) + 5)
    return {
      cursor: { drag: { x: false, y: false } },
      legend: { show: true },
      scales: {
        x: { time: true },
        a: { range: [0, ampMax] },
        t: { range: [-20, 80] },
        ...(hasSoc ? { soc: { range: [0, 100] } } : {}),
      },
      axes: [
        { stroke: theme.axisText, grid: { stroke: theme.grid, width: 1 } },
        { scale: 'a', label: $_('monitoring.energy.axis.current'), stroke: theme.charging, grid: { stroke: theme.grid, width: 1 } },
        { side: 1, scale: 't', label: $_('monitoring.energy.axis.temperature'), stroke: theme.warning, grid: { show: false } },
        ...(hasSoc && !narrow
          ? [{ side: 1, scale: 'soc', label: $_('monitoring.energy.axis.soc'), stroke: theme.success, grid: { show: false } }]
          : []),
      ],
      series: [
        {},
        { label: 'A', scale: 'a', stroke: theme.charging, width: 2, fill: theme.charging + '22' },
        { label: '°C', scale: 't', stroke: theme.warning, width: 2 },
        ...(hasSoc ? [{ label: 'SOC %', scale: 'soc', stroke: theme.success, width: 2 }] : []),
      ],
    }
  })
</script>

{#if samples.length === 0}
  <div class="py-12 text-center text-sm text-text-dim">{$_('monitoring.energy.no_samples')}</div>
{:else}
  <UplotChart {opts} {data} fill />
{/if}
