<script>
  import { _ } from 'svelte-i18n'
  import { DateTime } from 'luxon'
  import { uistates_store } from '../../stores/uistates.js'
  import { status_store } from '../../stores/status.js'
  import { signalPercent } from '../../config/wifi.js'
  import Modal from '../ui/Modal.svelte'
  import Button from '../ui/Button.svelte'

  // The thin inline banner (ConnectionBanners) shows the instant the socket
  // drops. This blocking modal only escalates after a grace period so brief
  // weak-WiFi blips — which the reconnect loop heals in 1–2s — never nag the
  // user. It reappears/clears purely from ws_connected; the grace timer and
  // the once-a-second "last seen" ticker are owned here, not in the store.
  const GRACE_MS = 6000
  // A last reading at or below this is weak enough that distance/interference
  // is the likely cause of the drop, so the coaching tip earns its place.
  const WEAK_RSSI = -70

  let wsConnected = $derived($uistates_store?.ws_connected ?? true)
  let lastSeen = $derived($uistates_store?.ws_last_seen ?? 0)
  let dbg = $derived($uistates_store?.ws_debug ?? {})
  let srssi = $derived($status_store?.srssi)

  let escalated = $state(false)
  let now = $state(DateTime.now().toUnixInteger())

  let graceTimer
  let ticker

  // Escalate to / retract from the blocking modal as the connection state
  // changes. Cleared on teardown so a disconnected unmount leaves no timer.
  $effect(() => {
    if (wsConnected) {
      clearTimeout(graceTimer)
      graceTimer = undefined
      escalated = false
    } else if (!escalated && graceTimer === undefined) {
      graceTimer = setTimeout(() => {
        graceTimer = undefined
        escalated = true
      }, GRACE_MS)
    }
    return () => {
      clearTimeout(graceTimer)
      graceTimer = undefined
    }
  })

  // Tick once a second while the modal is up so the "last seen" reading stays
  // live. No interval runs while connected.
  $effect(() => {
    if (!escalated) return
    now = DateTime.now().toUnixInteger()
    ticker = setInterval(() => (now = DateTime.now().toUnixInteger()), 1000)
    return () => clearInterval(ticker)
  })

  function formatAgo(seconds) {
    const s = Math.max(0, seconds)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${String(s % 60).padStart(2, '0')}s`
  }

  let agoText = $derived(lastSeen ? formatAgo(now - lastSeen) : '—')

  // Last WiFi reading (from before the drop — status_store is frozen while
  // offline). Shown as a stat; the coaching tip only appears when it's weak.
  let signalText = $derived.by(() => {
    if (!Number.isFinite(srssi)) return null
    return `${signalPercent(srssi)}% (${srssi} dBm)`
  })
  let signalWeak = $derived(Number.isFinite(srssi) && srssi <= WEAK_RSSI)

  // Address the socket is retrying — surfaced so an IP change (the device
  // rejoining WiFi on a new DHCP lease) is diagnosable from the dialog.
  let address = $derived.by(() => {
    if (typeof window === 'undefined') return ''
    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
    return `${proto}${window.location.host}/ws`
  })

  let stateText = $derived(
    dbg.ever_connected || lastSeen
      ? $_('connection.offline_state_dropped')
      : $_('connection.offline_state_never'),
  )
  let closeText = $derived(
    dbg.close_code != null ? `${dbg.close_code}${dbg.close_reason ? ` (${dbg.close_reason})` : ''}` : '—',
  )

  function retryNow() {
    // Bump the nonce WebSocket.svelte watches; it forces an immediate
    // teardown+reconnect, skipping the up-to-30s backoff.
    $uistates_store.ws_retry_request = ($uistates_store.ws_retry_request ?? 0) + 1
  }

  function reloadPage() {
    if (typeof window !== 'undefined') window.location.reload()
  }

  // Active reachability probe: the WebSocket close code is almost always 1006
  // and tells us nothing, so hit the device's HTTP endpoint directly. A real
  // status code means "device up, socket is the problem"; a thrown error means
  // the host is unreachable (off-net or IP changed). Same origin as the app,
  // so no CORS; /api prefix only in the dev proxy.
  let probing = $state(false)
  let probeResult = $state('')
  async function testConnection() {
    if (probing) return
    probing = true
    probeResult = ''
    let url = '/status'
    if (import.meta.env.DEV && !url.startsWith('http')) url = '/api' + url
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'X-Requested-With': 'OpenEVSE' },
      })
      probeResult = `${$_('connection.offline_probe_http')} ${res.status}`
    } catch {
      probeResult = $_('connection.offline_probe_fail')
    } finally {
      clearTimeout(t)
      probing = false
    }
  }
</script>

<Modal visible={escalated} closable={false}>
  <h2 class="text-base font-semibold text-text">{$_('connection.offline_title')}</h2>
  <p class="mt-2 text-sm text-text-dim">{$_('connection.offline_reason')}</p>

  <dl class="mt-4 space-y-1 text-sm">
    <div class="flex justify-between gap-4">
      <dt class="text-text-dim">{$_('connection.offline_last_seen')}</dt>
      <dd class="font-medium text-text">{agoText}</dd>
    </div>
    {#if signalText}
      <div class="flex justify-between gap-4">
        <dt class="text-text-dim">{$_('connection.offline_signal')}</dt>
        <dd class="font-medium text-text">{signalText}</dd>
      </div>
    {/if}
    <div class="flex justify-between gap-4">
      <dt class="text-text-dim">{$_('connection.offline_address')}</dt>
      <dd class="truncate font-mono text-xs text-text">{address}</dd>
    </div>
  </dl>

  {#if signalWeak}
    <p class="mt-3 rounded-xl bg-warning/15 px-3 py-2 text-xs text-warning">
      {$_('connection.offline_signal_weak')}
    </p>
  {/if}

  <div class="mt-5 flex gap-2">
    <Button label={$_('connection.offline_retry')} onclick={retryNow} />
    <Button label={$_('connection.offline_reload')} variant="ghost" onclick={reloadPage} />
  </div>

  <details class="mt-4 text-sm">
    <summary class="cursor-pointer text-text-dim">{$_('connection.offline_details')}</summary>
    <dl class="mt-2 space-y-1">
      <div class="flex justify-between gap-4">
        <dt class="text-text-dim">{$_('connection.offline_state')}</dt>
        <dd class="text-text">{stateText}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-text-dim">{$_('connection.offline_attempts')}</dt>
        <dd class="text-text">{dbg.attempts ?? 0}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-text-dim">{$_('connection.offline_close')}</dt>
        <dd class="font-mono text-xs text-text">{closeText}</dd>
      </div>
    </dl>
    <div class="mt-3 flex items-center gap-3">
      <button
        type="button"
        onclick={testConnection}
        disabled={probing}
        class="rounded-xl border border-border px-3 py-1.5 text-xs text-text
               transition disabled:opacity-40"
      >
        {probing ? $_('connection.offline_testing') : $_('connection.offline_test')}
      </button>
      {#if probeResult}<span class="text-xs text-text-dim">{probeResult}</span>{/if}
    </div>
  </details>
</Modal>
