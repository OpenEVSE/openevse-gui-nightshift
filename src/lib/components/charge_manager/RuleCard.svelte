<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import Icon from '../../icons/Icon.svelte'
  import { formatDayChips } from '../../schedule/timers.js'
  import { formatWindow } from '../../charge_manager/rules.js'

  let { rule, active = false, removing = false, disabled = false, onedit = () => {}, ondelete = () => {} } = $props()

  let chips  = $derived(formatDayChips(rule?.days))
  let window = $derived(formatWindow(rule?.startTime, rule?.stopTime))

  function actionLabel(action) {
    const key = 'charge_manager.rule_action_' + action
    return $_(key) !== key ? $_(key) : action
  }

  function limitLabel(limit) {
    if (!limit || limit.type === 'none' || !limit.value) return null
    if (limit.type === 'time') {
      const mins = limit.value
      return mins >= 60 ? `${Math.round(mins / 60)} h` : `${mins} min`
    }
    if (limit.type === 'energy') return `${Math.round(limit.value / 1000)} kWh`
    if (limit.type === 'soc')    return `${limit.value}%`
    return null
  }

  let limitChip = $derived(limitLabel(rule?.limit))
</script>

<Card class="mb-3 p-4">
  <div class="flex items-start justify-between gap-2">
    <!-- Left: action title + schedule details -->
    <button type="button" onclick={onedit} class="min-w-0 flex-1 text-left">
      <div class="flex items-center gap-2">
        <div class="text-sm font-semibold text-text">
          {actionLabel(rule?.action)}
        </div>
        {#if active}
          <span class="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
            <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
            {$_('charge_manager.active')}
          </span>
        {/if}
      </div>

      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <!-- Day chips -->
        <div class="flex flex-wrap gap-1">
          {#each chips as chip}
            <span
              class="rounded px-1.5 py-0.5 text-[10px] font-semibold
                     {chip.on ? 'bg-accent/15 text-accent' : 'text-text-dim'}"
            >
              {$_('days.' + chip.day).slice(0, 3)}
            </span>
          {/each}
        </div>
        <!-- Time window -->
        <span class="text-xs text-text-dim">{window}</span>
        <!-- Limit chip -->
        {#if limitChip}
          <span class="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold text-text-dim">
            {limitChip}
          </span>
        {/if}
      </div>
    </button>

    <!-- Right: edit + delete -->
    <div class="flex shrink-0 items-center gap-1">
      <IconButton
        icon="mdi:pencil-outline"
        size={16}
        label={$_('charge_manager.rule_edit_title')}
        {disabled}
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
          {disabled}
          onclick={ondelete}
        />
      {/if}
    </div>
  </div>
</Card>
