<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { status_store } from '../lib/stores/status.js'
  import { config_store } from '../lib/stores/config.js'
  import { uistates_store } from '../lib/stores/uistates.js'
  import { uisettings_store } from '../lib/stores/uisettings.js'
  import {
    energyMetrics, sensorMetrics, serviceMetrics, vehicleMetrics,
    showVehicle, homeBatteryMetrics, showHomeBattery, safetyData,
  } from '../lib/monitoring/metrics.js'
  import Tabs from '../lib/components/ui/Tabs.svelte'
  import MetricsTab from '../lib/components/monitoring/MetricsTab.svelte'
  import SafetyTab from '../lib/components/monitoring/SafetyTab.svelte'
  import EnergyTab from '../lib/components/monitoring/EnergyTab.svelte'

  let hasError = $derived(!!$uistates_store?.error)

  // Track the selected tab by id, not index, so the alert-driven Safety jump
  // (and any future change to the tab set) doesn't shuffle the selection.
  let activeId = $state('data')

  onMount(() => {
    if ($uistates_store?.error) activeId = 'safety'
  })

  // Desktop has room for everything at once, so the Data groups start
  // expanded there (still individually collapsible). MetricGroup seeds its
  // open state from `expanded` once on mount, so this only affects initial
  // state — checked synchronously to be right on first paint.
  const DESKTOP_MQ = '(min-width: 1024px)'
  const desktop =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(DESKTOP_MQ).matches
      : false

  let groups = $derived([
    { group: energyMetrics($status_store), expanded: true },
    { group: sensorMetrics($status_store, $config_store, { tempUnit: $uisettings_store?.temp_unit }), expanded: desktop },
    ...(showVehicle($status_store, $config_store)
      ? [{ group: vehicleMetrics($status_store, $config_store), expanded: desktop }]
      : []),
    ...(showHomeBattery($status_store)
      ? [{ group: homeBatteryMetrics($status_store), expanded: desktop }]
      : []),
    { group: serviceMetrics($status_store, $config_store), expanded: desktop },
  ])
  let safety = $derived(safetyData($status_store, hasError))

  let tabs = $derived([
    { id: 'data',    label: $_('monitoring.tab.data'),    alert: false },
    { id: 'energy',  label: $_('monitoring.tab.energy'),  alert: false },
    { id: 'safety',  label: $_('monitoring.tab.safety'),  alert: hasError },
  ])

  // If the user disables dev features while sitting on the Energy tab,
  // fall back to Data so we don't render a removed tab.
  $effect(() => {
    if (!tabs.some((t) => t.id === activeId)) activeId = tabs[0]?.id ?? 'data'
  })

  let activeIndex = $derived(Math.max(0, tabs.findIndex((t) => t.id === activeId)))
</script>

<section class="flex h-full min-h-0 flex-col p-4 lg:mx-auto lg:w-full lg:max-w-5xl">
  <h1 class="mb-3 text-lg font-semibold text-text">{$_('screen.monitoring')}</h1>

  <Tabs {tabs} active={activeIndex} onchange={(i) => (activeId = tabs[i].id)} />

  <div class="mt-3 flex min-h-0 flex-1 flex-col">
    {#if activeId === 'energy'}
      <EnergyTab />
    {:else if activeId === 'data'}
      <MetricsTab {groups} />
    {:else}
      <div class="lg:mx-auto lg:w-full lg:max-w-3xl">
        <SafetyTab data={safety} />
      </div>
    {/if}
  </div>
</section>
