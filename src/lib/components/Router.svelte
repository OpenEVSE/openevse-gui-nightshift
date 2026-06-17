<script>
  import { currentPath, redirect } from '../router.js'
  let { routes = {}, fallback, aliases = {}, blocked = [] } = $props()

  // A legacy path or a blocked (capability-gated) path renders nothing for the
  // one tick it takes the redirect to land — never the fallback, which would
  // flash a 404.
  let isBlocked = $derived(blocked.includes($currentPath))
  let Component = $derived(
    isBlocked ? null : routes[$currentPath] ?? (aliases[$currentPath] ? null : fallback),
  )

  $effect(() => {
    if (isBlocked) { redirect('/'); return }
    const target = aliases[$currentPath]
    if (target) redirect(target)
  })
</script>

{#if Component}
  <Component />
{/if}
