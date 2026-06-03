<script>
  import { _ } from 'svelte-i18n'
  import UplotChart from '../charts/UplotChart.svelte'
  import { readChartTheme } from '../charts/chartTheme.js'
  import {
    clipToSession,
    toChartData,
    kwAxisMax,
    buildSessionOpts,
  } from '../../dashboard/sessionChart.js'

  /** @type {{ samples: Array<{ts:number,a:number,t:number,e:number,s:number}>, voltage:number, target:number|null, sessionElapsed:number }} */
  let { samples = [], voltage = 0, target = null, sessionElapsed = 0 } = $props()

  // Size the chart to the viewport so it grows on taller windows: ~42% of the
  // window height, clamped to 150–520px. Passed straight to uPlot as a pixel
  // height (more reliable than a percentage-height/flex chain, which doesn't
  // resolve through the dashboard's flex layout).
  let winH = $state(0)
  let height = $derived(Math.round(Math.min(520, Math.max(150, winH * 0.42))))

  let clipped = $derived(clipToSession(samples, sessionElapsed))
  let data = $derived(toChartData(clipped, voltage)) // [x, soc, kw]
  // Keep kwMax (the right-axis ceiling) as its own number-valued derived so it
  // only changes when the rounded peak changes. opts then keeps a stable
  // reference across the 10s data poll, so UplotChart takes the cheap setData
  // path instead of a full rebuild — a rebuild collapses the canvas for a frame
  // and makes iOS Safari jump the scroll position to the top on every redraw.
  let kwMax = $derived(kwAxisMax(data[2]))
  let opts = $derived.by(() =>
    buildSessionOpts({ theme: readChartTheme(), target, kwMax, height }),
  )
</script>

<svelte:window bind:innerHeight={winH} />

{#if clipped.length < 2}
  <div class="grid place-items-center text-sm text-text-dim" style="height: {height}px">
    {$_('dashboard.session.collecting')}
  </div>
{:else}
  <UplotChart {opts} {data} />
{/if}
