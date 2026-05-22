<!-- src/lib/components/config/ConfigSection.svelte -->
<script>
  import Card from '../ui/Card.svelte'
  let { title = '', children } = $props()
</script>

<Card class="mb-4">
  {#if title}
    <h2 class="mb-1 text-sm font-semibold text-text-dim">{title}</h2>
  {/if}
  {@render children?.()}
</Card>
