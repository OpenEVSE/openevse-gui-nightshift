<!-- src/lib/components/config/FormField.svelte -->
<script>
  import Icon from '../../icons/Icon.svelte'

  let { label = '', description = '', status = 'idle', children } = $props()
</script>

<div class="py-3">
  <div class="flex items-center justify-between gap-3">
    <span class="text-sm text-text">{label}</span>
    {#if status === 'saving'}
      <Icon icon="mdi:loading" size={16} class="animate-spin text-text-dim" />
    {:else if status === 'saved'}
      <Icon icon="mdi:check" size={16} class="text-accent" />
    {:else if status === 'error'}
      <Icon icon="mdi:alert-circle-outline" size={16} class="text-error" />
    {/if}
  </div>
  <div class="mt-1.5">{@render children?.()}</div>
  {#if description}
    <p class="mt-1 text-xs text-text-dim">{description}</p>
  {/if}
</div>
