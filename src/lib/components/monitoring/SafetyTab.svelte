<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Button from '../ui/Button.svelte'
  import { getStateDesc } from '../../utils.js'
  import { serialQueue } from '../../queue.js'
  import { httpAPI } from '../../api/httpAPI.js'
  import { status_store } from '../../stores/status.js'
  import { showWriteError } from '../../alerts.js'

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

  let resetting = $state(false)
  let resetDone = $state(false)

  async function resetFaultCounters() {
    if (resetting) return
    resetting = true
    resetDone = false
    try {
      // Single-threaded device server — serialize like every other request.
      const res = await serialQueue.add(() => httpAPI('GET', '/r?json=1&rapi=$FC'))
      if (res && res !== 'error' && !res.error) {
        resetDone = true
        await status_store.download()
        setTimeout(() => (resetDone = false), 3000)
      } else {
        showWriteError()
      }
    } finally {
      resetting = false
    }
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

<Card class="mb-2 p-3">
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

<Card class="p-3">
  <Button
    label={resetting
      ? $_('config.safety.resetting')
      : resetDone
        ? $_('config.safety.reset_done')
        : $_('config.safety.reset_faults')}
    variant={resetDone ? 'ghost' : 'default'}
    disabled={resetting}
    onclick={resetFaultCounters}
  />
</Card>
