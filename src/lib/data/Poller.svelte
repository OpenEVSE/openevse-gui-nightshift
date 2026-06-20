<!-- src/lib/data/Poller.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte'
  import { uistates_store } from '../stores/uistates.js'
  import { status_store } from '../stores/status.js'
  import { httpAPI } from '../api/httpAPI.js'

  // No /ws on the JuiceBox firmware, so the dashboard stays live by polling
  // GET /status. ~1.5 s is plenty for EVSE state and leaves the single-
  // threaded device room to breathe. `active` is false while a WebSocket is
  // live (TransportManager): the interval keeps ticking but each poll no-ops,
  // so we never double-fetch.
  let { active = true } = $props()

  const POLL_MS = 1500
  let timer = null
  let inflight = false

  onMount(() => {
    poll()
    timer = setInterval(poll, POLL_MS)
  })
  onDestroy(() => { clearInterval(timer) })

  async function poll() {
    if (!active || inflight) return // never overlap; stay quiet while WS drives
    inflight = true
    try {
      const res = await httpAPI('GET', '/status')
      const ok = res && res !== 'error' && res.msg !== 'error'
      // Shallow-merge like WebSocket.svelte — frames may be partial.
      if (ok) status_store.update((cur) => ({ ...(cur || {}), ...res }))
      // reuse ws_connected: same "device reachable" UX as the WebSocket path
      uistates_store.update((u) => ({ ...u, ws_connected: ok }))
    } finally {
      inflight = false
    }
  }
</script>
