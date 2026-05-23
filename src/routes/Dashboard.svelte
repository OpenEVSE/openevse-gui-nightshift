<script>
  import { _ } from 'svelte-i18n'
  import { status_store } from '../lib/stores/status.js'
  import { config_store } from '../lib/stores/config.js'
  import { override_store } from '../lib/stores/override.js'
  import { limit_store } from '../lib/stores/limit.js'
  import { claims_target_store } from '../lib/stores/claims_target.js'
  import { plan_store } from '../lib/stores/plan.js'
  import { uistates_store } from '../lib/stores/uistates.js'
  import { uisettings_store } from '../lib/stores/uisettings.js'
  import { httpAPI } from '../lib/api/httpAPI.js'
  import { serialQueue } from '../lib/queue.js'
  import { EvseClients } from '../lib/vars.js'
  import { sec2time, temp_round, round, clientid2name, getStateDesc } from '../lib/utils.js'
  import { formatTemp } from '../lib/temperature.js'
  import { showWriteError } from '../lib/alerts.js'
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
  let rateNonce = $state(0)

  // ── derived view-model ──────────────────────────────────────────────────
  let mode = $derived($uistates_store?.mode ?? 0)
  let display = $derived(displayState($status_store, mode))
  let charging = $derived(display === 'charging')
  let maxAmps = $derived($config_store?.max_current_soft ?? 48)
  let fill = $derived(ringFill($status_store, $config_store, $limit_store))
  let reason = $derived(connectedReason(mode, $plan_store))

  let kw = $derived((($status_store?.power ?? 0) / 1000).toFixed(1))
  let maxKw = $derived((maxAmps * ($status_store?.voltage ?? 0) / 1000).toFixed(1))

  let tempDisplay = $derived(
    formatTemp(temp_round($status_store?.temp), $uisettings_store?.temp_unit),
  )
  let live = $derived({
    sessionKwh: (($status_store?.session_energy ?? 0) / 1000).toFixed(2),
    elapsed: sec2time($status_store?.session_elapsed ?? 0),
    currentA: (($status_store?.amp ?? 0) / 1000).toFixed(1),
    voltage: $status_store?.voltage ?? 0,
    temp: tempDisplay.value,
    tempUnit: tempDisplay.unitKey,
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
      let ok
      if (m === 0) {
        ok = await serialQueue.add(() => override_store.clear())
      } else {
        const data = { state: m === 1 ? 'active' : 'disabled' }
        const cur = override_store.get(override_store)?.charge_current
        data.charge_current = cur ?? $config_store?.max_current_soft
        ok = await serialQueue.add(() => override_store.upload(data))
      }
      if (!ok) showWriteError()
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
        const ok = await serialQueue.add(() => override_store.upload({ ...current, charge_current: val }))
        if (!ok) {
          showWriteError()
          rateNonce++ // remount ChargeRate so the slider reverts to the confirmed value
        }
      }
    } finally {
      busy = false
    }
  }

  async function setEco(on) {
    if (busy) return
    busy = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/divertmode', `divertmode=${on ? 2 : 1}`, 'text'),
      )
      if (res === 'error') showWriteError()
    } finally {
      busy = false
    }
  }

  async function setShaper(on) {
    if (busy) return
    busy = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/shaper', `shaper=${on ? 1 : 0}`, 'text'),
      )
      if (res === 'error') showWriteError()
    } finally {
      busy = false
    }
  }

  async function saveLimit(limit) {
    limitModalOpen = false
    const ok = await serialQueue.add(() => limit_store.upload(limit))
    if (ok) {
      await serialQueue.add(() => limit_store.download())
    } else {
      showWriteError()
    }
  }

  async function clearLimit() {
    const ok = await serialQueue.add(() => limit_store.remove())
    if (!ok) showWriteError()
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

  <!-- The eco/shaper and mode controls stay in place during a fault —
       visible but disabled — so the layout doesn't reflow. -->
  <EcoShaperToggles
    {showEco} {ecoOn} onEco={setEco}
    {showShaper} {shaperOn} onShaper={setShaper}
    disabled={busy || display === 'error'}
  />

  <ModeSelector
    {mode}
    disabled={busy || modeLocked || display === 'error'}
    onmode={setMode}
  />

  {#if display !== 'error'}
    {#key rateNonce}
      <ChargeRate
        amps={chargeAmps}
        min={6}
        max={maxAmps}
        disabled={busy || ecoOn}
        claimedBy={rateClaimedBy}
        onchange={setChargeAmps}
      />
    {/key}

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
