<!-- src/routes/MonitoringLazy.svelte -->
<script>
  // Monitoring is entirely charts. In the JuiceBox build (VITE_CHARTS=false)
  // the import() is eliminated and we redirect home; the route is also in the
  // Router's `blocked` set (separate task), so this redirect is belt-and-suspenders.
  import { redirect } from '../lib/router.js'

  let Page = $state(null)
  if (import.meta.env.VITE_CHARTS !== 'false') {
    import('./Monitoring.svelte').then((m) => (Page = m.default))
  } else {
    redirect('/')
  }
</script>

{#if Page}
  <Page />
{/if}
