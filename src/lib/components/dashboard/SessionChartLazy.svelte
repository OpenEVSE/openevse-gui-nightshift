<!-- src/lib/components/dashboard/SessionChartLazy.svelte -->
<script>
  // Loads the uplot-backed SessionChart on demand. The inlined env check lets
  // the JuiceBox build (VITE_CHARTS=false) dead-code-eliminate the import() so
  // uplot never enters the bundle.
  let { samples = [], voltage = 0, phases = 1, target = null, sessionElapsed = 0 } = $props()

  let Chart = $state(null)
  if (import.meta.env.VITE_CHARTS !== 'false') {
    import('./SessionChart.svelte').then((m) => (Chart = m.default))
  }
</script>

{#if Chart}
  <Chart {samples} {voltage} {phases} {target} {sessionElapsed} />
{/if}
