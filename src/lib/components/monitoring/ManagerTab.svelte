<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import { clientid2name } from '../../utils.js'

  let { rows = [] } = $props()

  function fmtValue(v) {
    if (v === 'active' || v === 'disabled') return $_('monitoring.manager.' + v)
    if (v === null || v === undefined) return '—'
    return String(v)
  }
</script>

{#if rows.length === 0}
  <Card class="py-10 text-center text-sm text-text-dim">
    {$_('monitoring.manager.empty')}
  </Card>
{:else}
  <Card class="p-3">
    {#each rows as row}
      <div class="flex items-center justify-between border-b border-border py-2.5 last:border-0">
        <span class="text-sm text-text-dim">{row.property}</span>
        <span class="flex items-center gap-1.5">
          {#if row.priority != null}
            <span class="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-text-dim">
              {$_('monitoring.manager.priority')}: {row.priority}
            </span>
          {/if}
          <span class="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-text">
            {$_('clients.' + clientid2name(row.clientId))}
          </span>
          <span class="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
            {fmtValue(row.value)}
          </span>
        </span>
      </div>
    {/each}
  </Card>
{/if}
