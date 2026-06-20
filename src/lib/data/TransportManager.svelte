<!-- src/lib/data/TransportManager.svelte -->
<script>
  // Polling is the always-on baseline; a live WebSocket suppresses it.
  //  - No /ws (JuiceBox): `live` stays false → Poller runs the whole session.
  //  - ESP32: `live` flips true within ~1 s → Poller no-ops, WS drives.
  // Both feed status_store via a shallow merge, so the brief handshake overlap
  // on the ESP32 is harmless.
  import WebSocket from './WebSocket.svelte'
  import Poller from './Poller.svelte'

  let live = $state(false)
</script>

<WebSocket bind:live />
<Poller active={!live} />
