<script>
  import { _ } from 'svelte-i18n'
  import GlobalFeatureCard from './GlobalFeatureCard.svelte'
  import TempProtectionCard from './TempProtectionCard.svelte'

  let {
    enabledFeatures = [],
    limit = { type: 'none', value: 0, auto_release: true },
    removingKey = null,
    busy = false,
    // Temperature protection (rendered at the top when throttling is enabled).
    tempProtection = null, // { throttle, panic, min, max } | null
    onedit = () => {},    // called with featureKey
    onremove = () => {},  // called with featureKey
    onThrottleChange = () => {},  // (°C) => void
    onPanicChange = () => {},     // (°C) => void
  } = $props()
</script>

<div class="mb-6">
  <div class="mb-2">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-text-dim">
      {$_('charge_manager.global_section')}
    </h2>
  </div>

  {#if tempProtection}
    <TempProtectionCard
      title={$_('charge_manager.safety')}
      throttle={tempProtection.throttle}
      panic={tempProtection.panic}
      min={tempProtection.min}
      max={tempProtection.max}
      checksAllOn={tempProtection.checksAllOn}
      temperature={tempProtection.temperature}
      {busy}
      {onThrottleChange}
      {onPanicChange}
    />
  {/if}

  {#if enabledFeatures.length === 0 && !tempProtection}
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
