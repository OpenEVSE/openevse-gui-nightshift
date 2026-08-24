<script>
  import { _ } from 'svelte-i18n'

  // Whether a vehicle is plugged in (derived from the firmware `vehicle` flag —
  // see vehicleConnected() in lib/dashboard/state.js). Styled to mirror the
  // RatePill shell so the two pills read as a balanced pair framing the ring.
  let { connected = false } = $props()
</script>

<div
  class="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-2.5 py-1
         text-[13px] font-bold {connected ? 'text-success' : 'text-text-dim'}"
>
  <span class="h-2 w-2 rounded-full {connected ? 'bg-success' : 'border border-text-dim'}"></span>
  <span>{$_(connected ? 'dashboard.plug.connected' : 'dashboard.plug.disconnected')}</span>
</div>
