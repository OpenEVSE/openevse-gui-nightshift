<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Icon from '../../icons/Icon.svelte'
  import TimerRow from './TimerRow.svelte'

  let {
    timers = [],
    removingId = null,
    disabled = false,
    onedit = () => {},
    ondelete = () => {},
  } = $props()
</script>

{#if timers.length === 0}
  <Card class="flex flex-col items-center gap-3 py-12 text-text-dim">
    <Icon icon="mdi:calendar-blank-outline" size={40} />
    <p class="text-sm">{$_('schedule.empty')}</p>
  </Card>
{:else}
  {#each timers as timer (timer.id)}
    <TimerRow
      {timer}
      removing={removingId === timer.id}
      {disabled}
      onedit={() => onedit(timer)}
      ondelete={() => ondelete(timer.id)}
    />
  {/each}
{/if}
