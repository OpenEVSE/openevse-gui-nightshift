<script>
  import { _ } from 'svelte-i18n'
  import { fade } from 'svelte/transition'
  import { status_store } from '../lib/stores/status.js'
  import { config_store } from '../lib/stores/config.js'
  import { override_store } from '../lib/stores/override.js'
  import { limit_store } from '../lib/stores/limit.js'
  import { claims_target_store } from '../lib/stores/claims_target.js'
  import { plan_store } from '../lib/stores/plan.js'
  import { energy_store } from '../lib/stores/energy.js'
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
  import { socCeiling, estMaxRange } from '../lib/dashboard/soc.js'

  import StatusLine from '../lib/components/dashboard/StatusLine.svelte'
  import PowerRing from '../lib/components/dashboard/PowerRing.svelte'
  import ChargingHero from '../lib/components/dashboard/ChargingHero.svelte'
  import StatChips from '../lib/components/dashboard/StatChips.svelte'
  import ThrottleBadge from '../lib/components/dashboard/ThrottleBadge.svelte'
  import { selectedSegment } from '../lib/dashboard/controls.js'
  import ChargeControls from '../lib/components/dashboard/ChargeControls.svelte'
  import RatePill from '../lib/components/dashboard/RatePill.svelte'
  import ChargeLimitCard from '../lib/components/dashboard/ChargeLimitCard.svelte'
  import ChargeLimitModal from '../lib/components/dashboard/ChargeLimitModal.svelte'

  let limitModalOpen = $state(false)
  let busy = $state(false)
  let rateNonce = $state(0)

  // ── derived view-model ──────────────────────────────────────────────────
  let mode = $derived($uistates_store?.mode ?? 0)
  let display = $derived(displayState($status_store, mode))
  let charging = $derived(display === 'charging')
  // The charging session chart is a Labs feature, gated like the Energy tab —
  // it polls /energy/raw and isn't hardware-validated yet. When Labs is off,
  // charging keeps the existing PowerRing.
  let labsOn = $derived(!!$uisettings_store?.dev_features)
  let showChart = $derived(charging && labsOn)
  let maxAmps = $derived($config_store?.max_current_soft ?? 48)
  let fill = $derived(ringFill($status_store, $config_store, $limit_store))
  let reason = $derived(connectedReason(mode, $plan_store))

  let kw = $derived((($status_store?.power ?? 0) / 1000).toFixed(1))
  // Shown on the PowerRing while charging (the non-Labs / chart-off path).
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
  let modeLockLabel = $derived(
    claimOwner === EvseClients.ocpp.id
      ? 'OCPP'
      : claimOwner === EvseClients.rfid.id
        ? 'RFID'
        : claimOwner === EvseClients.limit.id
          ? 'LIMIT'
          : '',
  )

  let showEco = $derived(!!$config_store?.divert_enabled)
  let showShaper = $derived(!!$config_store?.current_shaper_enabled)
  let ecoOn = $derived($status_store?.divertmode === 2 && mode === 0)
  // Reflect the device's live shaper state (status.shaper, 0/1) — same source
  // pattern as ecoOn above. uistates_store.shaper is never written by the data
  // layer, so deriving from it left the toggle permanently off.
  let shaperOn = $derived(!!$status_store?.shaper)
  let chargeSegment = $derived(
    selectedSegment({
      mode,
      divertmode: $status_store?.divertmode,
      divertEnabled: !!$config_store?.divert_enabled,
    }),
  )

  let limitSummary = $derived(formatLimit($limit_store))
  function formatLimit(l) {
    if (!l || !l.type || l.type === 'none') return ''
    if (l.type === 'time') return sec2time(l.value * 60)
    if (l.type === 'energy') return `${round(l.value / 1000, 1)} kWh`
    if (l.type === 'soc') return `${l.value}%`
    if (l.type === 'range') return `${l.value} km`
    return ''
  }

  // ── charge-limit bar view-model ─────────────────────────────────────────
  let hasSoc = $derived(
    $status_store?.battery_level !== undefined && $status_store?.battery_level !== null,
  )
  let vehicleLimit = $derived(
    Number.isFinite($status_store?.vehicle_charge_limit) ? $status_store.vehicle_charge_limit : null,
  )
  let maxRange = $derived(estMaxRange($status_store?.battery_range, $status_store?.battery_level))
  // The bar owns soc + range limits; the row owns time + energy.
  let barLimitActive = $derived($limit_store?.type === 'soc' || $limit_store?.type === 'range')
  // Display unit: follows the active range limit by default; the toggle overrides.
  let userUnit = $state(null)
  let limitUnit = $derived(userUnit ?? ($limit_store?.type === 'range' ? 'range' : 'percent'))
  // Knob position is always a percent. Map the active limit back to a percent.
  let socTarget = $derived(
    $limit_store?.type === 'soc'
      ? $limit_store.value
      : $limit_store?.type === 'range' && Number.isFinite(maxRange)
        ? // clamp: a stale range limit above a shrunken max-range estimate must
          // not map past 100% (the knob would then auto-clear on first touch)
          Math.round(Math.min(100, ($limit_store.value / maxRange) * 100))
        : socCeiling(vehicleLimit),
  )
  // Bumped on a failed bar write to remount the card back to the confirmed value.
  let socNonce = $state(0)

  // ── actions (all writes serialized) ─────────────────────────────────────
  async function setSegment(seg) {
    if (busy) return
    busy = true
    try {
      let ok = true
      if (seg === 'on' || seg === 'off') {
        const cur = $override_store?.charge_current
        const data = {
          state: seg === 'on' ? 'active' : 'disabled',
          charge_current: cur ?? $config_store?.max_current_soft,
          auto_release: false,
        }
        ok = await serialQueue.add(() => override_store.upload(data))
      } else {
        // 'auto' or 'eco': release the manual override, then set the divert
        // state explicitly so we land on the intended segment regardless of
        // the prior divertmode (On->Auto must turn divert off; On->Eco must turn it on).
        // Only clear when an override is actually set — clear() returns false
        // (with no request) on an empty/unset store, which would otherwise be
        // mistaken for a write failure and fire a spurious error.
        if ($override_store && Object.keys($override_store).length > 0) {
          ok = await serialQueue.add(() => override_store.clear())
        }
        // If releasing the override failed, don't push divertmode on top of a
        // device we couldn't reach — surface the error and stop.
        if (!ok) {
          showWriteError()
          return
        }
        const dm = seg === 'eco' ? 2 : 1
        const res = await serialQueue.add(() =>
          httpAPI('POST', '/divertmode', `divertmode=${dm}`, 'text'),
        )
        if (res === 'error') ok = false
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
        const current = $override_store ?? {}
        // auto_release: false to keep the override sticky — see setSegment.
        const ok = await serialQueue.add(() =>
          override_store.upload({ ...current, charge_current: val, auto_release: false }),
        )
        if (!ok) {
          showWriteError()
          rateNonce++ // remount RatePill so the slider reverts to the confirmed value
        }
      }
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

  // Snap-to-clear: a knob at/above the vehicle limit means "no limit". Below it,
  // write a soc or range limit depending on the active display unit.
  async function setTarget(pct) {
    if (busy) return
    busy = true
    try {
      let ok
      if (pct >= socCeiling(vehicleLimit)) {
        ok = barLimitActive ? await serialQueue.add(() => limit_store.remove()) : true
      } else {
        const data =
          limitUnit === 'range' && Number.isFinite(maxRange)
            ? { type: 'range', value: Math.round((pct / 100) * maxRange), auto_release: true }
            : { type: 'soc', value: pct, auto_release: true }
        ok = await serialQueue.add(() => limit_store.upload(data))
        if (ok) await serialQueue.add(() => limit_store.download())
      }
      if (!ok) {
        showWriteError()
        socNonce++ // remount the card so the knob reverts to the confirmed value
      }
    } finally {
      busy = false
    }
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
  // "Boosting · MM:SS" indicator inside ChargeControls; cleared by the timer or
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

  // While charging, refresh the raw energy log every 10 s so the session chart
  // tracks live. The raw log isn't version-bumped like the pull stores, so we
  // poll it ourselves. The effect re-runs when `charging` flips; its cleanup
  // clears the interval, so polling starts/stops with the charging state. The
  // in-flight guard prevents ticks piling up if the device is slow to respond.
  $effect(() => {
    if (!showChart) return
    let inflight = false
    const tick = async () => {
      if (inflight) return
      inflight = true
      try {
        await energy_store.loadRaw()
      } finally {
        inflight = false
      }
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  })
</script>

<section class="px-4 pb-4">
  {#if !showChart}
    <StatusLine {display} />
  {/if}

  <div class="relative">
    {#if showChart}
      <div in:fade={{ duration: 150 }}>
        <ChargingHero
          {kw}
          soc={hasSoc ? ($status_store?.battery_level ?? null) : null}
          target={socTarget}
          {hasSoc}
          amps={chargeAmps}
          {maxAmps}
          {rateClaimedBy}
          {rateNonce}
          samples={$energy_store.raw.samples}
          voltage={$status_store?.voltage ?? 0}
          sessionElapsed={$status_store?.session_elapsed ?? 0}
          chartError={$energy_store.error.raw}
          rateDisabled={busy || ecoOn || display === 'error'}
          onrate={setChargeAmps}
        />
      </div>
    {:else}
      <div in:fade={{ duration: 150 }}>
        <div class="absolute right-3 top-1 z-10">
          {#key rateNonce}
            <RatePill
              amps={chargeAmps}
              min={6}
              max={maxAmps}
              claimedBy={rateClaimedBy}
              disabled={busy || ecoOn || display === 'error'}
              onchange={setChargeAmps}
            />
          {/key}
        </div>
        <PowerRing
          {display}
          {fill}
          {kw}
          maxKw={charging ? maxKw : ''}
          reasonKey={reason.key}
          reasonValues={reason.values}
          faultText={getStateDesc($status_store?.state) ?? ''}
        />
      </div>
    {/if}
  </div>

  <ThrottleBadge />

  <StatChips {charging} {live} {summary} {sessionCost} />

  <!-- Unified charge controls: segmented mode + Shaper/Boost modifiers.
       Stays visible (disabled) during a fault so the layout doesn't reflow. -->
  <ChargeControls
    segment={chargeSegment}
    divertEnabled={showEco}
    shaperEnabled={showShaper}
    {shaperOn}
    locked={modeLocked}
    lockLabel={modeLockLabel}
    disabled={busy || display === 'error'}
    {boostEndsAt}
    onsegment={setSegment}
    onshaper={setShaper}
    onboost={boost}
    oncancelboost={cancelBoost}
  />

  {#if display !== 'error'}
    {#key socNonce}
      <ChargeLimitCard
        {hasSoc}
        soc={$status_store?.battery_level ?? 0}
        {vehicleLimit}
        target={socTarget}
        range={$status_store?.battery_range ?? null}
        rangeMiles={!!$config_store?.mqtt_vehicle_range_miles}
        timeToFull={$status_store?.time_to_full_charge ?? 0}
        {charging}
        unit={limitUnit}
        estMaxRange={maxRange}
        disabled={busy}
        ontarget={setTarget}
        onunit={(u) => (userUnit = u)}
        limit={$limit_store}
        summary={limitSummary}
        onopen={() => (limitModalOpen = true)}
        onclear={clearLimit}
      />
    {/key}

  {/if}
</section>

<ChargeLimitModal
  open={limitModalOpen}
  onclose={() => (limitModalOpen = false)}
  onsave={saveLimit}
/>
