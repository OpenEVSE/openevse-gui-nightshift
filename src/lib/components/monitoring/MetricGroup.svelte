<script>
  import { untrack } from 'svelte'
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Icon from '../../icons/Icon.svelte'
  import MetricRow from './MetricRow.svelte'

  let { group, expanded = false } = $props()

  let open = $state(untrack(() => expanded))
</script>

<Card class="mb-2">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    class="flex w-full items-center justify-between p-3 text-left"
  >
    <span class="text-sm font-semibold text-text">{$_(group.titleKey)}</span>
    <Icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} size={20} class="text-text-dim" />
  </button>
  {#if open}
    <div class="border-t border-border px-3 pb-1">
      {#each group.rows as row}
        <MetricRow labelKey={row.labelKey} value={row.value} unit={row.unit} />
      {/each}
    </div>
  {/if}
</Card>
