<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Icon from '../../icons/Icon.svelte'
  import LogRow from './LogRow.svelte'

  let { rows = [] } = $props()
</script>

{#if rows.length === 0}
  <Card class="flex flex-col items-center gap-3 py-12 text-text-dim">
    <Icon icon="mdi:history" size={40} />
    <p class="text-sm">{$_('history.empty')}</p>
  </Card>
{:else}
  <div class="space-y-2">
    {#each rows as row, i (i)}
      <LogRow {...row} />
    {/each}
  </div>
{/if}
