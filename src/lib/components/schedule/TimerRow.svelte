<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import Icon from '../../icons/Icon.svelte'
  import { displayTime } from '../../utils.js'
  import { formatDayChips } from '../../schedule/timers.js'

  let { timer, removing = false, disabled = false, onedit = () => {}, ondelete = () => {} } = $props()

  let active = $derived(timer?.state === 'active')
  let chips = $derived(formatDayChips(timer?.days))
</script>

<Card class="mb-2 flex items-center gap-3 p-3">
  <button type="button" onclick={onedit} class="flex flex-1 items-center gap-3 text-left">
    <div class="shrink-0">
      <div class="text-2xl font-extrabold text-text">{displayTime(timer?.time)}</div>
      <span
        class="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide
               {active ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-text-dim'}"
      >
        {active ? $_('schedule.active') : $_('schedule.disabled')}
      </span>
    </div>
    <div class="flex flex-1 flex-wrap gap-1">
      {#each chips as chip}
        <span
          class="rounded px-1.5 py-0.5 text-[10px] font-semibold
                 {chip.on ? 'bg-accent/15 text-accent' : 'text-text-dim'}"
        >
          {$_('days.' + chip.day).slice(0, 3)}
        </span>
      {/each}
    </div>
  </button>
  <div class="flex shrink-0 items-center">
    <IconButton
      icon="mdi:pencil-outline"
      size={16}
      label={$_('schedule.edit_title')}
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
        label={$_('schedule.delete')}
        {disabled}
        onclick={ondelete}
      />
    {/if}
  </div>
</Card>
