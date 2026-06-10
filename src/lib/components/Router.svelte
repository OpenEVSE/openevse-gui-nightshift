<script>
  import { currentPath, redirect } from '../router.js'
  let { routes = {}, fallback, aliases = {} } = $props()

  // A legacy path renders nothing for the one tick it takes the redirect
  // to land — never the fallback, which would flash a 404.
  let Component = $derived(
    routes[$currentPath] ?? (aliases[$currentPath] ? null : fallback),
  )

  $effect(() => {
    const target = aliases[$currentPath]
    if (target) redirect(target)
  })
</script>

{#if Component}
  <Component />
{/if}
