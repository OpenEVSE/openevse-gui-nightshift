<script>
  import { _ } from 'svelte-i18n'
  import { status_store } from '../lib/stores/status.js'
  import { config_store } from '../lib/stores/config.js'
  import { override_store } from '../lib/stores/override.js'
  import { limit_store } from '../lib/stores/limit.js'
  import { claims_target_store } from '../lib/stores/claims_target.js'
  import { plan_store } from '../lib/stores/plan.js'
  import { uistates_store } from '../lib/stores/uistates.js'
  import { serialQueue } from '../lib/queue.js'
  import { EvseClients } from '../lib/vars.js'
  import { sec2time, temp_round, round, clientid2name, getStateDesc } from '../lib/utils.js'
  import { displayState, ringFill, connectedReason } from '../lib/dashboard/state.js'

  import StatusLine from '../lib/components/dashboard/StatusLine.svelte'
  import PowerRing from '../lib/components/dashboard/PowerRing.svelte'
  import StatChips from '../lib/components/dashboard/StatChips.svelte'
  import ModeSelector from '../lib/components/dashboard/ModeSelector.svelte'
  import ChargeRate from '../lib/components/dashboard/ChargeRate.svelte'
  import ChargeLimitCard from '../lib/components/dashboard/ChargeLimitCard.svelte'
  import ChargeLimitModal from '../lib/components/dashboard/ChargeLimitModal.svelte'
  import EcoShaperToggles from '../lib/components/dashboard/EcoShaperToggles.svelte'

  let limitModalOpen = $state(false)
  let busy = $state(false)

  // ── derived view-model ──────────────────────────────────────────────────
  let display = $derived(displayState($status_store))
  let charging = $derived(display === 'charging')
  let mode = $derived($uistates_store?.mode ?? 0)
  let maxAmps = $derived($config_store?.max_current_soft ?? 48)
  let fill = $derived(ringFill($status_store, $config_store, $limit_store))
  let reason = $derived(connectedReason(mode, $plan_store))

  let kw = $derived((($status_store?.power ?? 0) / 1000).toFixed(1))
  let maxKw = $derived((maxAmps * ($status_store?.voltage ?? 0) / 1000).toFixed(1))

  let live = $derived({
    sessionKwh: (($status_store?.session_energy ?? 0) / 1000).toFixed(2),
    elapsed: sec2time($status_store?.session_elapsed ?? 0),
    currentA: (($status_store?.amp ?? 0) / 1000).toFixed(1),
    voltage: $status_store?.voltage ?? 0,
    tempC: temp_round($status_store?.temp),
    pilotA: $status_store?.pilot ?? 0,
  })
  let summary = $derived({
    todayKwh: round($status_store?.total_day ?? 0, 1),
    totalKwh: round($status_store?.total_energy ?? 0, 0),
  })

  let chargeAmps = $derived(
    $claims_target_store?.properties?.charge_current
      ? Math.min($claims_target_store.properties.charge_current, maxAmps)
      : maxAmps,
  )
  let rateClaimedBy = $derived(
    $claims_target_store?.claims?.charge_current &&
    $claims_target_store.claims.charge_current !== EvseClients.manual.id
      ? clientid2name($claims_target_store.claims.charge_current)
      : '',
  )

  let claimOwner = $derived($claims_target_store?.claims?.state)
  let modeLocked = $derived(
    claimOwner === EvseClients.ocpp.id ||
    claimOwner === EvseClients.limit.id ||
    claimOwner === EvseClients.rfid.id,
  )

  let showEco = $derived(!!$config_store?.divert_enabled)
  let showShaper = $derived(!!$config_store?.current_shaper_enabled)
  let ecoOn = $derived($status_store?.divertmode === 2 && mode === 0)
  let shaperOn = $derived(!!$uistates_store?.shaper)

  let limitSummary = $derived(formatLimit($limit_store))
  function formatLimit(l) {
    if (!l || !l.type || l.type === 'none') return ''
    if (l.type === 'time') return sec2time(l.value * 60)
    if (l.type === 'energy') return `${round(l.value / 1000, 1)} kWh`
    if (l.type === 'soc') return `${l.value}%`
    if (l.type === 'range') return `${l.value} km`
    return ''
  }

  // ── actions (all writes serialized) ─────────────────────────────────────
  async function setMode(m) {
    if (busy) return
    busy = true
    try {
      if (m === 0) {
        await serialQueue.add(() => override_store.clear())
      } else {
        const data = { state: m === 1 ? 'active' : 'disabled' }
        const cur = override_store.get(override_store)?.charge_current
        data.charge_current = cur ?? $config_store?.max_current_soft
        await serialQueue.add(() => override_store.upload(data))
      }
    } finally {
      busy = false
    }
  }

  async function setChargeAmps(val) {
    if (busy) return
    busy = true
    try {
      if (val >= maxAmps) {
        await serialQueue.add(() => override_store.removeProp('charge_current'))
      } else {
        const current = override_store.get(override_store) ?? {}
        await serialQueue.add(() => override_store.upload({ ...current, charge_current: val }))
      }
    } finally {
      busy = false
    }
  }

  async function saveLimit(limit) {
    limitModalOpen = false
    await serialQueue.add(() => limit_store.upload(limit))
    await serialQueue.add(() => limit_store.download())
  }

  async function clearLimit() {
    await serialQueue.add(() => limit_store.remove())
  }
</script>

<section class="px-4 pb-4">
  <StatusLine {display} />

  <PowerRing
    {display}
    {fill}
    {kw}
    maxKw={charging ? maxKw : ''}
    reasonKey={reason.key}
    reasonValues={reason.values}
    faultText={getStateDesc($status_store?.state) ?? ''}
  />

  <StatChips {charging} {live} {summary} />

  {#if display !== 'error'}
    <EcoShaperToggles
      {showEco} {ecoOn} onEco={() => {}}
      {showShaper} {shaperOn} onShaper={() => {}}
      disabled={busy}
    />

    <ModeSelector {mode} disabled={busy || modeLocked} onmode={setMode} />

    <ChargeRate
      amps={chargeAmps}
      min={6}
      max={maxAmps}
      disabled={busy || ecoOn}
      claimedBy={rateClaimedBy}
      onchange={setChargeAmps}
    />

    <ChargeLimitCard
      limit={$limit_store}
      summary={limitSummary}
      onopen={() => (limitModalOpen = true)}
      onclear={clearLimit}
    />
  {/if}
</section>

<ChargeLimitModal
  open={limitModalOpen}
  allowSoc={$status_store?.battery_level !== undefined}
  allowRange={$status_store?.battery_range !== undefined}
  onclose={() => (limitModalOpen = false)}
  onsave={saveLimit}
/>
