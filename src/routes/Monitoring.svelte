<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { status_store } from '../lib/stores/status.js'
  import { config_store } from '../lib/stores/config.js'
  import { claims_target_store } from '../lib/stores/claims_target.js'
  import { uistates_store } from '../lib/stores/uistates.js'
  import { uisettings_store } from '../lib/stores/uisettings.js'
  import {
    energyMetrics, sensorMetrics, serviceMetrics, vehicleMetrics,
    showVehicle, homeBatteryMetrics, showHomeBattery, safetyData, claimRows,
  } from '../lib/monitoring/metrics.js'
  import Tabs from '../lib/components/ui/Tabs.svelte'
  import MetricsTab from '../lib/components/monitoring/MetricsTab.svelte'
  import SafetyTab from '../lib/components/monitoring/SafetyTab.svelte'
  import ManagerTab from '../lib/components/monitoring/ManagerTab.svelte'
  import EnergyTab from '../lib/components/monitoring/EnergyTab.svelte'

  let hasError = $derived(!!$uistates_store?.error)
  let devOn = $derived(!!$uisettings_store?.dev_features)

  // Track the selected tab by id, not index — the Energy tab appears only
  // when dev features are on, and index-based tracking would jump tabs
  // around as the user toggles the gate.
  let activeId = $state('data')

  onMount(() => {
    if ($uistates_store?.error) activeId = 'safety'
    else if (devOn) activeId = 'energy'
  })

  let groups = $derived([
    { group: energyMetrics($status_store), expanded: true },
    { group: sensorMetrics($status_store, $config_store, { tempUnit: $uisettings_store?.temp_unit }), expanded: false },
    ...(showVehicle($status_store, $config_store)
      ? [{ group: vehicleMetrics($status_store, $config_store), expanded: false }]
      : []),
    ...(showHomeBattery($status_store)
      ? [{ group: homeBatteryMetrics($status_store), expanded: false }]
      : []),
    { group: serviceMetrics($status_store, $config_store), expanded: false },
  ])
  let safety = $derived(safetyData($status_store, hasError))
  let claims = $derived(claimRows($claims_target_store))

  let tabs = $derived([
    ...(devOn ? [{ id: 'energy',  label: $_('monitoring.tab.energy'),  alert: false }] : []),
    { id: 'data',    label: $_('monitoring.tab.data'),    alert: false },
    { id: 'safety',  label: $_('monitoring.tab.safety'),  alert: hasError },
    { id: 'manager', label: $_('monitoring.tab.manager'), alert: false },
  ])

  // If the user disables dev features while sitting on the Energy tab,
  // fall back to Data so we don't render a removed tab.
  $effect(() => {
    if (!tabs.some((t) => t.id === activeId)) activeId = tabs[0]?.id ?? 'data'
  })

  let activeIndex = $derived(Math.max(0, tabs.findIndex((t) => t.id === activeId)))
</script>

<section class="flex h-full min-h-0 flex-col p-4">
  <h1 class="mb-3 text-lg font-semibold text-text">{$_('screen.monitoring')}</h1>

  <Tabs {tabs} active={activeIndex} onchange={(i) => (activeId = tabs[i].id)} />

  <div class="mt-3 flex min-h-0 flex-1 flex-col">
    {#if activeId === 'energy'}
      <EnergyTab />
    {:else if activeId === 'data'}
      <MetricsTab {groups} />
    {:else if activeId === 'safety'}
      <SafetyTab data={safety} />
    {:else}
      <ManagerTab rows={claims} />
    {/if}
  </div>
</section>
