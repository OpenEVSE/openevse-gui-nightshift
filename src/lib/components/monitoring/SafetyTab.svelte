<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import { getStateDesc } from '../../utils.js'

  let { data = { errors: [], infos: [] } } = $props()

  const sevClass = {
    ok: 'bg-accent/15 text-accent',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-error/15 text-error',
  }

  function rowLabel(row) {
    return $_('monitoring.safety.' + row.key)
  }
  function rowValue(row) {
    return row.key === 'fault' ? $_(getStateDesc(row.state)) : row.count
  }
</script>

<Card class="mb-2 p-3">
  <h2 class="mb-1 text-sm font-semibold text-text">{$_('monitoring.safety.errors')}</h2>
  {#each data.errors as row}
    <div class="flex items-center justify-between py-2 text-sm">
      <span class="text-text-dim">{rowLabel(row)}</span>
      <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {sevClass[row.severity]}">
        {rowValue(row)}
      </span>
    </div>
  {/each}
</Card>

<Card class="p-3">
  <h2 class="mb-1 text-sm font-semibold text-text">{$_('monitoring.safety.info')}</h2>
  {#each data.infos as row}
    <div class="flex items-center justify-between py-2 text-sm">
      <span class="text-text-dim">{$_('monitoring.safety.' + row.key)}</span>
      <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {sevClass[row.severity]}">
        {row.count}
      </span>
    </div>
  {/each}
</Card>
