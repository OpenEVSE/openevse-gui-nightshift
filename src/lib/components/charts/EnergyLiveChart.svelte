<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../stores/config.js'
  import UplotChart from './UplotChart.svelte'
  import { readChartTheme } from './chartTheme.js'

  /** @type {{ samples: Array<{ts:number,a:number,t:number,e:number}> }} */
  let { samples = [] } = $props()

  let data = $derived.by(() => {
    const x = samples.map((s) => s.ts)
    const a = samples.map((s) => s.a)
    const t = samples.map((s) => (s.t > 0 ? s.t : null))
    return [x, a, t]
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
      height: 280,
      cursor: { drag: { x: false, y: false } },
      legend: { show: true },
      scales: {
        x: { time: true },
        a: { range: [0, ampMax] },
        t: { range: [-20, 80] },
      },
      axes: [
        { stroke: theme.axisText, grid: { stroke: theme.grid, width: 1 } },
        { scale: 'a', label: $_('monitoring.energy.axis.current'), stroke: theme.charging, grid: { stroke: theme.grid, width: 1 } },
        { side: 1, scale: 't', label: $_('monitoring.energy.axis.temperature'), stroke: theme.warning, grid: { show: false } },
      ],
      series: [
        {},
        { label: 'A', scale: 'a', stroke: theme.charging, width: 2, fill: theme.charging + '22' },
        { label: '°C', scale: 't', stroke: theme.warning, width: 2 },
      ],
    }
  })
</script>

{#if samples.length === 0}
  <div class="py-12 text-center text-sm text-text-dim">{$_('monitoring.energy.no_samples')}</div>
{:else}
  <UplotChart {opts} {data} />
{/if}
