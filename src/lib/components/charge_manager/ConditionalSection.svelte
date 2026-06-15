<script>
  import { _ } from 'svelte-i18n'
  import RuleCard from './RuleCard.svelte'

  let {
    rules = [],
    removingId = null,
    busy = false,
    onedit = () => {},    // called with rule object
    ondelete = () => {},  // called with rule object
  } = $props()
</script>

<div class="mb-4">
  <div class="mb-2 flex items-baseline justify-between">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-text-dim">
      {$_('charge_manager.conditional_section')}
    </h2>
  </div>

  {#if rules.length === 0}
    <p class="text-sm text-text-dim">{$_('charge_manager.conditional_empty')}</p>
  {:else}
    {#each rules as rule (rule.id)}
      <RuleCard
        {rule}
        removing={removingId === rule.id}
        disabled={busy}
        onedit={() => onedit(rule)}
        ondelete={() => ondelete(rule)}
      />
    {/each}
  {/if}
</div>
