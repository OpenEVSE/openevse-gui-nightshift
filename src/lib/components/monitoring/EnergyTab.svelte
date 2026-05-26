<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { energy_store } from '../../stores/energy.js'
  import Tabs from '../ui/Tabs.svelte'
  import EnergyLiveChart from '../charts/EnergyLiveChart.svelte'
  import EnergySummaryChart from '../charts/EnergySummaryChart.svelte'

  const VIEWS = ['live', 'daily', 'monthly', 'annual']

  let viewIndex = $state(0)
  let view = $derived(VIEWS[viewIndex])

  // Firmware shape from EnergyLogger:
  //   daily   = [{ dt: 'YYYY-MM-DD', pk, mn, en (Wh)  }, ...]
  //   monthly = [{ mo: 'YYYY-MM',    pk, mn, en (kWh) }, ...]
  //   annual  = [{ yr: 2025,         pk, mn, en (kWh) }, ...]
  // Shorten the daily label (drop the year) so 40 day-ticks fit; monthly
  // gets the short month name; annual stays as the year integer.
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  function dailyLabel(dt) {
    if (typeof dt !== 'string' || dt.length < 10) return dt ?? ''
    const m = parseInt(dt.slice(5, 7), 10)
    const d = parseInt(dt.slice(8, 10), 10)
    return `${m}/${d}`
  }
  function monthlyLabel(mo) {
    if (typeof mo !== 'string' || mo.length < 7) return mo ?? ''
    const m = parseInt(mo.slice(5, 7), 10)
    const y = mo.slice(2, 4)
    return `${MONTHS[m - 1] ?? mo} '${y}`
  }
  let summaryRows = $derived.by(() => {
    if (view === 'daily')   return $energy_store.daily  .map((r) => ({ label: dailyLabel(r.dt), kwh: (r.en ?? 0) / 1000 }))
    if (view === 'monthly') return $energy_store.monthly.map((r) => ({ label: monthlyLabel(r.mo), kwh: r.en ?? 0 }))
    if (view === 'annual')  return $energy_store.annual .map((r) => ({ label: String(r.yr ?? ''), kwh: r.en ?? 0 }))
    return []
  })

  function loadFor(v) {
    if (v === 'live')    return energy_store.loadRaw()
    if (v === 'daily')   return energy_store.loadDaily()
    if (v === 'monthly') return energy_store.loadMonthly()
    if (v === 'annual')  return energy_store.loadAnnual()
  }

  function onTabChange(i) { viewIndex = i; loadFor(VIEWS[i]) }

  onMount(() => { loadFor('live') })

  // Auto-refresh the live view every 60s while not viewing historical paging
  let timer
  $effect(() => {
    clearInterval(timer)
    if (view === 'live') {
      timer = setInterval(() => {
        if (!$energy_store.raw.historical) energy_store.loadRaw()
      }, 60000)
    }
    return () => clearInterval(timer)
  })

  let tabs = $derived([
    { label: $_('monitoring.energy.live') },
    { label: $_('monitoring.energy.daily') },
    { label: $_('monitoring.energy.monthly') },
    { label: $_('monitoring.energy.annual') },
  ])

  function olderClicked() {
    const samples = $energy_store.raw.samples
    if (!samples.length) return
    const oldest = Math.min(...samples.map((s) => s.ts))
    energy_store.loadRaw(oldest)
  }
  function currentClicked() { energy_store.loadRaw() }
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
  <Tabs {tabs} active={viewIndex} onchange={onTabChange} />

  {#if view === 'live'}
    <div class="flex items-center justify-between gap-2 text-xs text-text-dim">
      <button
        type="button"
        class="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text transition
               disabled:cursor-not-allowed disabled:opacity-40
               hover:not-disabled:bg-surface-2"
        disabled={$energy_store.loading.raw || $energy_store.raw.noOlder || !$energy_store.raw.samples.length}
        onclick={olderClicked}
      >
        {$_('monitoring.energy.older')}
      </button>

      <span class="min-w-0 flex-1 text-center">
        {#if $energy_store.raw.noOlder}{$_('monitoring.energy.no_older')}
        {:else if $energy_store.raw.historical}{$_('monitoring.energy.historical')}
        {:else}{$_('monitoring.energy.latest_samples', { values: { n: $energy_store.raw.samples.length } })}{/if}
      </span>

      <button
        type="button"
        class="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text transition
               disabled:opacity-0 disabled:cursor-default
               hover:not-disabled:bg-surface-2"
        disabled={!$energy_store.raw.historical}
        onclick={currentClicked}
      >
        {$_('monitoring.energy.current')}
      </button>
    </div>

    {#if $energy_store.error.raw}
      <div class="flex min-h-0 flex-1 items-center justify-center text-sm text-error">{$_('monitoring.energy.error')}</div>
    {:else}
      <div class="min-h-0 flex-1">
        <EnergyLiveChart samples={$energy_store.raw.samples} />
      </div>
    {/if}
  {:else}
    {#if $energy_store.error[view]}
      <div class="flex min-h-0 flex-1 items-center justify-center text-sm text-error">{$_('monitoring.energy.error')}</div>
    {:else}
      <div class="min-h-0 flex-1">
        <EnergySummaryChart rows={summaryRows} />
      </div>
    {/if}
  {/if}
</div>
