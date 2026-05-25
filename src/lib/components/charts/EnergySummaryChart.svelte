<script>
  import { _ } from 'svelte-i18n'
  import uPlot from 'uplot'
  import UplotChart from './UplotChart.svelte'
  import { readChartTheme } from './chartTheme.js'

  /**
   * @typedef {Object} Row
   * @property {string} label  X-axis label (e.g. "2026-05-24", "May", "2025")
   * @property {number} kwh    Energy total for the bucket
   */
  /** @type {{ rows: Row[] }} */
  let { rows = [] } = $props()

  let data = $derived.by(() => {
    // Use ordinal x positions (0..n-1) and emit string labels via splits/values.
    const xs = rows.map((_r, i) => i)
    const ys = rows.map((r) => r.kwh)
    return [xs, ys]
  })

  let opts = $derived.by(() => {
    const theme = readChartTheme()
    return {
      height: 260,
      legend: { show: false },
      cursor: { drag: { x: false, y: false } },
      scales: {
        x: { time: false, range: (_u, _min, _max) => [-0.5, Math.max(0, rows.length - 0.5)] },
      },
      axes: [
        {
          stroke: theme.axisText,
          grid: { stroke: theme.grid, width: 1 },
          splits: () => rows.map((_r, i) => i),
          values: () => rows.map((r) => r.label),
        },
        {
          stroke: theme.axisText,
          grid: { stroke: theme.grid, width: 1 },
          label: 'kWh',
        },
      ],
      series: [
        {},
        {
          label: 'kWh',
          stroke: theme.accent,
          fill: theme.accent + '55',
          width: 1,
          paths: uPlot.paths.bars({ size: [0.65, 60] }),
          points: { show: false },
        },
      ],
    }
  })
</script>

{#if rows.length === 0}
  <div class="py-12 text-center text-sm text-text-dim">{$_('monitoring.energy.no_samples')}</div>
{:else}
  <UplotChart {opts} {data} />
{/if}
