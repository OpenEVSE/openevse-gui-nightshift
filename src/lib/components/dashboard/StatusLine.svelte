<script>
  import { _ } from 'svelte-i18n'

  let { display = 'starting' } = $props()

  // A connected-but-paused car is a normal resting state, not a caution —
  // keep its label neutral. The power ring still shows amber for "paused".
  const color = {
    starting: 'text-text-dim',
    idle: 'text-text-dim',
    connected: 'text-text-dim',
    sleeping: 'text-text-dim',
    off: 'text-text-dim',
    charging: 'text-accent',
    error: 'text-error',
  }
  const dot = {
    starting: 'bg-text-dim',
    idle: 'bg-text-dim',
    connected: 'bg-text-dim',
    sleeping: 'bg-text-dim',
    off: 'bg-text-dim',
    charging: 'bg-accent',
    error: 'bg-error',
  }
</script>

<div class="flex items-center gap-2 py-1 text-[11px] font-semibold tracking-wide {color[display]}">
  <span class="h-[7px] w-[7px] rounded-full {dot[display]}"></span>
  <span>{$_(`dashboard.status.${display}`)}</span>
</div>
