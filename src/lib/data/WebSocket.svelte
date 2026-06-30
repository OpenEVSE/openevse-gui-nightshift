<script>
  import { onMount, onDestroy } from 'svelte'
  import { DateTime } from 'luxon'
  import { uistates_store } from '../stores/uistates.js'
  import { status_store } from '../stores/status.js'
  import { JSONTryParse } from '../utils.js'

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

  // This device's HTTPS listener only sustains one concurrent TLS session.
  // The wss:// connection below holds that slot for as long as it's open,
  // which starves any other HTTPS request (e.g. a firmware upload) of a
  // handshake entirely. Callers that need the slot for themselves set
  // uistates_store.ws_paused — we drop the socket while that's true and
  // reconnect as soon as it clears. No-op (just an unnecessary reconnect
  // cycle) over plain HTTP, where there's no such limit.
  let wsPaused = false

  $effect(() => {
    const shouldPause = !!$uistates_store.ws_paused
    if (shouldPause && !wsPaused) {
      wsPaused = true
      cancelReconnect()
      cancelKeepAlive()
      const old = socket
      socket = null
      if (old) try { old.close() } catch { /* already closed */ }
    } else if (!shouldPause && wsPaused) {
      wsPaused = false
      connect2socket()
    }
  })

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
      $uistates_store.ws_connected = false
      cancelKeepAlive()
    })
    s.addEventListener('close', () => {
      if (s !== socket) return
      lastmsg = DateTime.now().toUnixInteger()
      cancelKeepAlive()
      $uistates_store.ws_connected = false
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
      $uistates_store.ws_connected = false
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
