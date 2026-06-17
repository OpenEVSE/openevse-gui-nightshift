<script>
  import { onMount, onDestroy } from 'svelte'
  import { DateTime } from 'luxon'
  import { uistates_store } from '../stores/uistates.js'
  import { status_store } from '../stores/status.js'
  import { JSONTryParse } from '../utils.js'

  // `live` drives transport selection: TransportManager gates the Poller on it
  // (Poller runs while !live). This component only ever reports ws_connected =
  // true (on open); it never writes false. The Poller owns the false case so a
  // failed handshake / dropped socket just hands back to polling without
  // flashing the "connection lost" banner.
  let { live = $bindable(false) } = $props()

  let socket
  let timerId
  let lastmsg
  let ping_cnt = 0

  // Exponential backoff: doubles on each failed reconnect attempt, capped at
  // RECONNECT_MAX. Reset to RECONNECT_MIN after a successful open. Keeps the
  // tab from tight-looping reconnect attempts while offline.
  const RECONNECT_MIN = 1000
  const RECONNECT_MAX = 30000
  let reconnectDelay = RECONNECT_MIN
  let reconnectTimer

  // Probe give-up: a reduced-capability device (JuiceBox/lite) has no /ws, so
  // without this it would retry the handshake forever. After MAX_PROBE_ATTEMPTS
  // connects that have NEVER opened, conclude the device is poll-only, stop
  // probing, and let the Poller carry the session. Once we've opened even once
  // we know it speaks WS, so we keep reconnecting through transient drops
  // regardless. A full page reload re-probes from scratch.
  const MAX_PROBE_ATTEMPTS = 3
  let everOpened = false
  let failedConnects = 0
  let wsUnsupported = false

  onMount(() => {
    connect2socket()
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      document.addEventListener('visibilitychange', handleVisibility)
    }
  })
  onDestroy(() => {
    if (socket) socket.close()
    socket = null
    cancelKeepAlive()
    cancelReconnect()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  })

  function connect2socket() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
    const s = new globalThis.WebSocket(proto + window.location.host + '/ws')
    socket = s
    // Every handler guards with `s !== socket`: when teardownAndReconnect()
    // (or any other path) replaces the active socket, the stale events
    // from the old one become no-ops instead of clobbering the new
    // socket's connection state.
    s.addEventListener('open', () => {
      if (s !== socket) return
      $uistates_store.ws_connected = true
      live = true
      everOpened = true
      failedConnects = 0
      reconnectDelay = RECONNECT_MIN
      keepAlive(s)
    })
    s.addEventListener('message', (e) => {
      if (s !== socket) return
      lastmsg = DateTime.now().toUnixInteger()
      if (parseMessage(e.data.toString())) ping_cnt = 0
    })
    s.addEventListener('error', () => {
      if (s !== socket) return
      lastmsg = DateTime.now().toUnixInteger()
      // Don't flip ws_connected here: a failed/closed socket only means we
      // dropped to polling (live=false). The Poller is the source of truth for
      // "device reachable" — it re-activates on live=false and sets
      // ws_connected on its next tick. Reporting false on every probe failure
      // would flash the "connection lost" banner during the initial handshake.
      live = false
      cancelKeepAlive()
    })
    s.addEventListener('close', () => {
      if (s !== socket) return
      lastmsg = DateTime.now().toUnixInteger()
      cancelKeepAlive()
      live = false // hand back to the Poller; it owns ws_connected (see 'error')
      failedConnects += 1
      if (!everOpened && failedConnects >= MAX_PROBE_ATTEMPTS) {
        // Device never spoke WebSocket — stop probing, the Poller drives.
        wsUnsupported = true
        return
      }
      scheduleReconnect()
    })
  }

  function scheduleReconnect() {
    cancelReconnect()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect2socket()
    }, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX)
  }

  function cancelReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  // Replace whatever socket we have with a fresh one. iOS PWA quirk: after a
  // background suspend the socket can come back in a "OPEN but actually dead"
  // state — readyState lies, no close event fires, sends silently drop. So
  // we don't trust readyState and don't probe; we just tear down and
  // reconnect from scratch. The old socket's eventual close/error events
  // are ignored thanks to the `s !== socket` guards above.
  function teardownAndReconnect() {
    if (wsUnsupported) return // poll-only device this session; don't restart WS churn
    cancelReconnect()
    cancelKeepAlive()
    reconnectDelay = RECONNECT_MIN
    ping_cnt = 0
    const old = socket
    socket = null
    if (old) try { old.close() } catch { /* already closed */ }
    connect2socket()
  }

  function handleOnline() {
    teardownAndReconnect()
  }

  function handleVisibility() {
    if (document.visibilityState !== 'visible') return
    teardownAndReconnect()
  }

  function parseMessage(msg) {
    const jsondata = JSONTryParse(msg)
    if (!jsondata) return false
    lastmsg = DateTime.now().toUnixInteger()
    if (!jsondata.pong) {
      status_store.update((cur) => ({ ...(cur || {}), ...jsondata }))
    }
    return true
  }

  function keepAlive(s) {
    if (s !== socket) return // stale recursion from a torn-down socket
    const now = DateTime.now().toUnixInteger()
    const timing = now - lastmsg
    if ((!ping_cnt && timing >= 5) || (ping_cnt && ping_cnt <= 3)) {
      if (s && s.readyState === s.OPEN) {
        s.send('{"ping": 1}')
        ping_cnt += 1
      }
    } else if (ping_cnt > 3 && timing >= 5) {
      ping_cnt = 0
      live = false // stalled socket: drop to polling, Poller re-evaluates reachability
      s.close()
      lastmsg = DateTime.now().toUnixInteger()
      cancelKeepAlive()
      return
    }
    timerId = setTimeout(() => keepAlive(s), ping_cnt ? 1000 : 5000)
  }

  function cancelKeepAlive() {
    if (timerId) clearTimeout(timerId)
  }
</script>
