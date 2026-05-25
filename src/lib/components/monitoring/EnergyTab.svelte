<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { energy_store } from '../../stores/energy.js'
  import Tabs from '../ui/Tabs.svelte'
  import Button from '../ui/Button.svelte'
  import EnergyLiveChart from '../charts/EnergyLiveChart.svelte'
  import EnergySummaryChart from '../charts/EnergySummaryChart.svelte'

  const VIEWS = ['live', 'daily', 'monthly', 'annual']

  let viewIndex = $state(0)
  let view = $derived(VIEWS[viewIndex])

  let summaryRows = $derived.by(() => {
    if (view === 'daily')   return $energy_store.daily  .map((r) => ({ label: r.d ?? r.label ?? '', kwh: r.kwh ?? 0 }))
    if (view === 'monthly') return $energy_store.monthly.map((r) => ({ label: r.m ?? r.label ?? '', kwh: r.kwh ?? 0 }))
    if (view === 'annual')  return $energy_store.annual .map((r) => ({ label: String(r.y ?? r.label ?? ''), kwh: r.kwh ?? 0 }))
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

<div class="space-y-3">
  <Tabs {tabs} active={viewIndex} onchange={onTabChange} />

  {#if view === 'live'}
    <div class="flex items-center justify-between text-xs text-text-dim">
      <Button
        label={$_('monitoring.energy.older')}
        disabled={$energy_store.loading.raw || $energy_store.raw.noOlder || !$energy_store.raw.samples.length}
        onclick={olderClicked}
      />
      <span>
        {#if $energy_store.raw.noOlder}{$_('monitoring.energy.no_older')}
        {:else if $energy_store.raw.historical}{$_('monitoring.energy.historical')}
        {:else}{$_('monitoring.energy.latest_samples', { values: { n: $energy_store.raw.samples.length } })}{/if}
      </span>
      {#if $energy_store.raw.historical}
        <Button label={$_('monitoring.energy.current')} onclick={currentClicked} />
      {:else}
        <span class="w-16"></span>
      {/if}
    </div>

    {#if $energy_store.error.raw}
      <div class="py-12 text-center text-sm text-error">{$_('monitoring.energy.error')}</div>
    {:else}
      <EnergyLiveChart samples={$energy_store.raw.samples} />
    {/if}
  {:else}
    {#if $energy_store.error[view]}
      <div class="py-12 text-center text-sm text-error">{$_('monitoring.energy.error')}</div>
    {:else}
      <EnergySummaryChart rows={summaryRows} />
    {/if}
  {/if}
</div>
