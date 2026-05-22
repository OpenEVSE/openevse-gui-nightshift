<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { status_store } from '../lib/stores/status.js'
  import { config_store } from '../lib/stores/config.js'
  import { claims_target_store } from '../lib/stores/claims_target.js'
  import { uistates_store } from '../lib/stores/uistates.js'
  import {
    energyMetrics, sensorMetrics, serviceMetrics, vehicleMetrics,
    showVehicle, safetyData, claimRows,
  } from '../lib/monitoring/metrics.js'
  import Tabs from '../lib/components/ui/Tabs.svelte'
  import MetricsTab from '../lib/components/monitoring/MetricsTab.svelte'
  import SafetyTab from '../lib/components/monitoring/SafetyTab.svelte'
  import ManagerTab from '../lib/components/monitoring/ManagerTab.svelte'

  let activeTab = $state(0)

  let hasError = $derived(!!$uistates_store?.error)

  onMount(() => {
    if ($uistates_store?.error) activeTab = 1
  })

  let groups = $derived([
    { group: energyMetrics($status_store), expanded: true },
    { group: sensorMetrics($status_store, $config_store), expanded: false },
    ...(showVehicle($status_store, $config_store)
      ? [{ group: vehicleMetrics($status_store, $config_store), expanded: false }]
      : []),
    { group: serviceMetrics($status_store, $config_store), expanded: false },
  ])
  let safety = $derived(safetyData($status_store, hasError))
  let claims = $derived(claimRows($claims_target_store))

  let tabs = $derived([
    { label: $_('monitoring.tab.data'), alert: false },
    { label: $_('monitoring.tab.safety'), alert: hasError },
    { label: $_('monitoring.tab.manager'), alert: false },
  ])
</script>

<section class="p-4">
  <h1 class="mb-3 text-lg font-semibold text-text">{$_('screen.monitoring')}</h1>

  <Tabs {tabs} active={activeTab} onchange={(i) => (activeTab = i)} />

  <div class="mt-3">
    {#if activeTab === 0}
      <MetricsTab {groups} />
    {:else if activeTab === 1}
      <SafetyTab data={safety} />
    {:else}
      <ManagerTab rows={claims} />
    {/if}
  </div>
</section>
