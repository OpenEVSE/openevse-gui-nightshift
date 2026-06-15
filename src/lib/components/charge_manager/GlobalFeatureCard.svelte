<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import Icon from '../../icons/Icon.svelte'

  let {
    featureKey = '',
    limit = { type: 'none', value: 0, auto_release: true },
    busy = false,
    removing = false,
    onedit = () => {},
    onremove = () => {},
  } = $props()

  function formatLimitValue(limit) {
    if (limit.type === 'time') {
      const mins = limit.value
      return mins >= 60 ? `${Math.round(mins / 60)} h` : `${mins} min`
    }
    if (limit.type === 'energy') return `${Math.round(limit.value / 1000)} kWh`
    return String(limit.value)
  }

  let valueDesc = $derived(
    featureKey === 'session_limit'
      ? formatLimitValue(limit)
      : $_('charge_manager.feature_' + featureKey + '_desc')
  )
</script>

<Card class="mb-3 p-4">
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0 flex-1">
      <div class="text-sm font-semibold text-text">
        {$_('charge_manager.feature_' + featureKey)}
      </div>
      <div class="mt-0.5 text-xs text-text-dim">{valueDesc}</div>
    </div>

    <div class="flex shrink-0 items-center gap-1">
      <IconButton
        icon="mdi:pencil-outline"
        size={16}
        label={$_('charge_manager.rule_edit_title')}
        disabled={busy}
        onclick={onedit}
      />
      {#if removing}
        <span class="grid place-items-center p-2 text-text-dim">
          <Icon icon="mdi:loading" size={16} class="animate-spin" />
        </span>
      {:else}
        <IconButton
          icon="mdi:trash-can-outline"
          size={16}
          label={$_('charge_manager.rule_delete')}
          disabled={busy}
          onclick={onremove}
        />
      {/if}
    </div>
  </div>
</Card>
