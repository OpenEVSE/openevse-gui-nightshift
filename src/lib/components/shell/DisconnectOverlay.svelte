<script>
  import { _ } from 'svelte-i18n'
  import { DateTime } from 'luxon'
  import { uistates_store } from '../../stores/uistates.js'
  import Modal from '../ui/Modal.svelte'
  import Button from '../ui/Button.svelte'

  // The thin inline banner (ConnectionBanners) shows the instant the socket
  // drops. This blocking modal only escalates after a grace period so brief
  // weak-WiFi blips — which the reconnect loop heals in 1–2s — never nag the
  // user. It reappears/clears purely from ws_connected; the grace timer and
  // the once-a-second "last seen" ticker are owned here, not in the store.
  const GRACE_MS = 6000

  let wsConnected = $derived($uistates_store?.ws_connected ?? true)
  let lastSeen = $derived($uistates_store?.ws_last_seen ?? 0)

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

  // Address the socket is retrying — surfaced so an IP change (the device
  // rejoining WiFi on a new DHCP lease) is diagnosable from the dialog.
  let address = $derived.by(() => {
    if (typeof window === 'undefined') return ''
    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
    return `${proto}${window.location.host}/ws`
  })

  function retryNow() {
    // Bump the nonce WebSocket.svelte watches; it forces an immediate
    // teardown+reconnect, skipping the up-to-30s backoff.
    $uistates_store.ws_retry_request = ($uistates_store.ws_retry_request ?? 0) + 1
  }

  function reloadPage() {
    if (typeof window !== 'undefined') window.location.reload()
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
    <div class="flex justify-between gap-4">
      <dt class="text-text-dim">{$_('connection.offline_address')}</dt>
      <dd class="truncate font-mono text-xs text-text">{address}</dd>
    </div>
  </dl>

  <div class="mt-5 flex gap-2">
    <Button label={$_('connection.offline_retry')} onclick={retryNow} />
    <Button label={$_('connection.offline_reload')} variant="ghost" onclick={reloadPage} />
  </div>
</Modal>
