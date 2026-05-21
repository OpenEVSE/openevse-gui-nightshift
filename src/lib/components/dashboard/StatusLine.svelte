<script>
  import { _ } from 'svelte-i18n'

  let { display = 'starting' } = $props()

  const color = {
    starting: 'text-text-dim',
    idle: 'text-text-dim',
    connected: 'text-warning',
    charging: 'text-accent',
    error: 'text-error',
  }
  const dot = {
    starting: 'bg-text-dim',
    idle: 'bg-text-dim',
    connected: 'bg-warning',
    charging: 'bg-accent',
    error: 'bg-error',
  }
</script>

<div class="flex items-center gap-2 py-1 text-[11px] font-semibold tracking-wide {color[display]}">
  <span class="h-[7px] w-[7px] rounded-full {dot[display]}"></span>
  <span>{$_(`dashboard.status.${display}`)}</span>
  {#if display === 'charging'}
    <span class="text-text-dim">· {$_('dashboard.car_connected')}</span>
  {/if}
</div>
