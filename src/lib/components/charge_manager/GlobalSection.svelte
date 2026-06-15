<script>
  import { _ } from 'svelte-i18n'
  import GlobalFeatureCard from './GlobalFeatureCard.svelte'

  let {
    enabledFeatures = [],
    limit = { type: 'none', value: 0, auto_release: true },
    removingKey = null,
    busy = false,
    onedit = () => {},    // called with featureKey
    onremove = () => {},  // called with featureKey
  } = $props()
</script>

<div class="mb-6">
  <div class="mb-2">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-text-dim">
      {$_('charge_manager.global_section')}
    </h2>
  </div>

  {#if enabledFeatures.length === 0}
    <p class="text-sm text-text-dim">{$_('charge_manager.global_empty')}</p>
  {:else}
    {#each enabledFeatures as key (key)}
      <GlobalFeatureCard
        featureKey={key}
        {limit}
        {busy}
        removing={removingKey === key}
        onedit={() => onedit(key)}
        onremove={() => onremove(key)}
      />
    {/each}
  {/if}
</div>
