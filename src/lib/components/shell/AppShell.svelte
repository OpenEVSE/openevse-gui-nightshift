<script>
  import { currentPath } from '../../router.js'
  import { routes, NotFound } from '../../routes.js'
  import { status_store } from '../../stores/status.js'
  import { uistates_store } from '../../stores/uistates.js'
  import Router from '../Router.svelte'
  import Header from './Header.svelte'
  import BottomNav from './BottomNav.svelte'
  import ConnectionBanners from './ConnectionBanners.svelte'

  let deviceName = $derived($status_store?.name || 'OpenEVSE')
  let evseConnected = $derived($status_store?.evse_connected ?? true)
  let wsConnected = $derived($uistates_store?.ws_connected ?? true)
  let error = $derived($uistates_store?.error ?? false)

  // Without scroll restoration, navigating between long pages (e.g. Settings
  // index → Firmware) would land the user wherever the previous page was
  // scrolled to. Reset the main scroll container's position whenever the
  // route changes.
  let mainEl
  $effect(() => {
    $currentPath
    if (mainEl) mainEl.scrollTop = 0
  })
</script>

<div class="flex h-full flex-col sm:flex-row-reverse">
  <div class="flex min-h-0 flex-1 flex-col">
    <Header {deviceName} {wsConnected} {evseConnected} />
    <ConnectionBanners {wsConnected} {evseConnected} {error} />
    <main bind:this={mainEl} class="min-h-0 flex-1 overflow-y-auto">
      <Router {routes} fallback={NotFound} />
    </main>
  </div>
  <BottomNav path={$currentPath} />
</div>
