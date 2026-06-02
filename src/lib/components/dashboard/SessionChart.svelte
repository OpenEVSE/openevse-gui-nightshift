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

  let clipped = $derived(clipToSession(samples, sessionElapsed))
  let data = $derived(toChartData(clipped, voltage)) // [x, soc, kw]
  // kwAxisMax reads data[2] (the kW array) to size the right axis.
  let opts = $derived.by(() =>
    buildSessionOpts({ theme: readChartTheme(), target, kwMax: kwAxisMax(data[2]) }),
  )
</script>

{#if clipped.length < 2}
  <div class="grid h-[150px] place-items-center text-sm text-text-dim">
    {$_('dashboard.session.collecting')}
  </div>
{:else}
  <UplotChart {opts} {data} />
{/if}
