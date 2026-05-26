<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { history_store } from '../lib/stores/history.js'
  import { config_store } from '../lib/stores/config.js'
  import { uisettings_store } from '../lib/stores/uisettings.js'
  import { rfid_users_store } from '../lib/stores/rfid_users.js'
  import { httpAPI } from '../lib/api/httpAPI.js'
  import { serialQueue } from '../lib/queue.js'
  import { formatDate, getStateDesc } from '../lib/utils.js'
  import {
    pageRange, logTypeIcon, logTypeTone, logStateInfo, logEnergyKwh, logTempC,
  } from '../lib/history/logs.js'
  import { formatTemp } from '../lib/temperature.js'
  import { formatCost } from '../lib/cost.js'
  import Card from '../lib/components/ui/Card.svelte'
  import Button from '../lib/components/ui/Button.svelte'
  import ProgressBar from '../lib/components/ui/ProgressBar.svelte'
  import LogList from '../lib/components/history/LogList.svelte'

  let phase = $state('loading')
  let progress = $state(0)

  let labsOn = $derived(!!$uisettings_store?.dev_features)

  // Resolve the "User" cell for one log entry. Labs-only: returns null when
  // the feature is off so LogRow can hide the line entirely.
  function userTextFor(entry) {
    if (!labsOn) return null
    const uid = entry?.rfidTag
    if (!uid) return '—'
    return $rfid_users_store.users[uid] ?? uid
  }

  let rows = $derived(
    (Array.isArray($history_store) ? $history_store : []).map((e) => {
      const state = logStateInfo(e.evseState)
      const t = formatTemp(logTempC(e), $uisettings_store?.temp_unit)
      const kWh = logEnergyKwh(e)
      return {
        stateIcon: state.icon,
        stateTone: state.tone,
        stateDesc: getStateDesc(e.evseState) ?? '',
        typeIcon: logTypeIcon(e.type),
        typeTone: logTypeTone(e.type),
        typeLabel: e.type ? $_('history.types.' + e.type, { default: e.type }) : '',
        timeText: e.time ? formatDate(e.time, $config_store?.time_zone, 'short') : '',
        energyKwh: kWh,
        costText: formatCost(
          kWh,
          $uisettings_store?.energy_rate,
          $uisettings_store?.currency_symbol,
        ),
        temp: t.value,
        tempUnit: t.unitKey,
        userText: userTextFor(e),
      }
    }),
  )

  function exportCsv() {
    // Hit the dev proxy when running under vite (/api/* → /*) and the bare
    // device path in production. Same pattern as the v2 PR. Letting the
    // browser drive the download keeps the streamed CSV out of memory.
    const url = (import.meta.env?.DEV ? '/api' : '') + '/logs/export'
    const link = document.createElement('a')
    link.href = url
    link.download = 'session-history.csv'
    document.body.appendChild(link)
    link.click()
    setTimeout(() => link.remove(), 100)
  }

  async function load() {
    phase = 'loading'
    progress = 0
    try {
      const index = await serialQueue.add(() => httpAPI('GET', '/logs'))
      if (
        !index || index === 'error' || index.msg === 'error' ||
        typeof index.min !== 'number' || typeof index.max !== 'number'
      ) {
        phase = 'error'
        return
      }
      history_store.set(undefined)
      const pages = pageRange(index.min, index.max)
      for (let i = 0; i < pages.length; i++) {
        const ok = await serialQueue.add(() => history_store.download(pages[i]))
        if (!ok) {
          phase = 'error'
          return
        }
        progress = Math.round(((i + 1) / pages.length) * 100)
      }
      phase = 'ready'
    } catch {
      phase = 'error'
    }
  }

  onMount(() => {
    if (labsOn) rfid_users_store.download()
    load()
  })
</script>

<section class="p-4">
  <div class="mb-3 flex items-center gap-2">
    <h1 class="flex-1 text-lg font-semibold text-text">{$_('screen.history')}</h1>
    {#if labsOn && phase === 'ready' && rows.length > 0}
      <div class="w-32 shrink-0">
        <Button label={$_('history.export_csv')} variant="ghost" onclick={exportCsv} />
      </div>
    {/if}
  </div>

  {#if phase === 'loading'}
    <Card class="flex flex-col items-center gap-3 px-6 py-12">
      <p class="text-sm text-text-dim">{$_('history.loading')}</p>
      <div class="w-full max-w-xs"><ProgressBar value={progress} /></div>
    </Card>
  {:else if phase === 'error'}
    <Card class="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <h2 class="text-sm font-semibold text-text">{$_('history.error_title')}</h2>
      <p class="text-xs text-text-dim">{$_('history.error_body')}</p>
      <div class="w-full max-w-xs"><Button label={$_('history.retry')} onclick={load} /></div>
    </Card>
  {:else}
    <LogList {rows} />
  {/if}
</section>
