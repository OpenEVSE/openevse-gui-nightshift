<script>
  import { currentPath } from '../router.js'
  let { routes = {}, fallback } = $props()
  let Component = $derived(routes[$currentPath] ?? fallback)
</script>

{#if Component}
  <Component />
{/if}
