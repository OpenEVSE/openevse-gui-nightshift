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
  import { formatCost } from '../lib/cost.js'
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
  import BoostButton from '../lib/components/dashboard/BoostButton.svelte'
  import PullToRefresh from '../lib/components/ui/PullToRefresh.svelte'

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
  let sessionCost = $derived(
    formatCost(
      ($status_store?.session_energy ?? 0) / 1000,
      $uisettings_store?.energy_rate,
      $uisettings_store?.currency_symbol,
    ),
  )

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

  // Pull-to-refresh: redownload the device stores that don't push via WS.
  // status_store updates live over the WebSocket so we don't touch it.
  async function refresh() {
    await serialQueue.add(() => config_store.download())
    await serialQueue.add(() => override_store.download())
    await serialQueue.add(() => limit_store.download())
    await serialQueue.add(() => claims_target_store.download())
    await serialQueue.add(() => plan_store.download())
  }

  // Boost: force-active override for the chosen duration, then restore the
  // override the user had before. We *don't* touch the /limit endpoint —
  // limits there only enforce stop conditions, and setting a time limit
  // with no session running causes the limit claim (priority 1100) to
  // immediately fire "expired", taking state ownership away from our
  // override and dropping mode back to Auto / Sleeping.
  //
  // The countdown lives in a local setTimeout. If the page is refreshed
  // mid-boost the timer is lost and the user is left in "On" until they
  // flip mode manually — v1 tradeoff documented on the button.
  let boostTimerId = null
  let prevOverride = null
  // ms-epoch when the active boost ends, or null. Drives the inline
  // "Boosting · MM:SS" indicator on BoostButton; cleared by the timer or
  // by cancelBoost().
  let boostEndsAt = $state(null)

  async function restoreFromBoost() {
    if (!prevOverride || !prevOverride.state) {
      await serialQueue.add(() => override_store.clear())
    } else {
      // Force auto_release: false here too — re-uploading the snapshot
      // as-is would inherit the device's auto_release: true default and
      // hit the same release path.
      await serialQueue.add(() =>
        override_store.upload({ ...prevOverride, auto_release: false }),
      )
    }
  }

  async function boost(minutes) {
    if (busy) return
    busy = true
    try {
      // Defensively clear any existing /limit before we touch the override.
      // A residual limit claim (priority 1100) silently holds state ownership
      // even when /limit returns {}, which would mask our override and keep
      // the device sleeping. The endpoint returns "done" even if nothing was
      // set, so it's a safe no-op when there's nothing to clear.
      await serialQueue.add(() => limit_store.remove())

      // Snapshot the current override so we can restore it. Empty object
      // means "Auto" (no override set).
      prevOverride = { ...($override_store || {}) }
      // auto_release: false is intentional. The device defaults overrides
      // to auto_release: true when the field is omitted, which (verified on
      // live hardware) causes the manual override claim to be released soon
      // after acceptance — a residual limit claim then re-emerges and pins
      // state=disabled. Setting it false keeps the override sticky for the
      // boost duration.
      const ok = await serialQueue.add(() =>
        override_store.upload({
          state: 'active',
          charge_current: $config_store?.max_current_soft,
          auto_release: false,
        }),
      )
      if (!ok) {
        showWriteError()
        return
      }
      if (boostTimerId) clearTimeout(boostTimerId)
      boostEndsAt = Date.now() + minutes * 60 * 1000
      boostTimerId = setTimeout(async () => {
        boostTimerId = null
        boostEndsAt = null
        await restoreFromBoost()
      }, minutes * 60 * 1000)
    } finally {
      busy = false
    }
  }

  async function cancelBoost() {
    if (boostTimerId) {
      clearTimeout(boostTimerId)
      boostTimerId = null
    }
    boostEndsAt = null
    await restoreFromBoost()
  }
</script>

<PullToRefresh onrefresh={refresh}>
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

  <StatChips {charging} {live} {summary} {sessionCost} />

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

    <BoostButton
      disabled={busy}
      endsAt={boostEndsAt}
      onboost={boost}
      oncancel={cancelBoost}
    />
  {/if}
</section>
</PullToRefresh>

<ChargeLimitModal
  open={limitModalOpen}
  allowSoc={$status_store?.battery_level !== undefined}
  allowRange={$status_store?.battery_range !== undefined}
  onclose={() => (limitModalOpen = false)}
  onsave={saveLimit}
/>
