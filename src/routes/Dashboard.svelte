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
  import { showWriteError, showBoostUnsupported } from '../lib/alerts.js'
  import { displayState, ringFill, connectedReason, maxPowerW } from '../lib/dashboard/state.js'
  import { socCeiling, estMaxRange, hmsShort } from '../lib/dashboard/soc.js'

  import StatusLine from '../lib/components/dashboard/StatusLine.svelte'
  import PowerRing from '../lib/components/dashboard/PowerRing.svelte'
  import ChargingHero from '../lib/components/dashboard/ChargingHero.svelte'
  import StatChips from '../lib/components/dashboard/StatChips.svelte'
  import ShaperDivertRow from '../lib/components/dashboard/ShaperDivertRow.svelte'
  import ThrottleBadge from '../lib/components/dashboard/ThrottleBadge.svelte'
  import { selectedSegment } from '../lib/dashboard/controls.js'
  import ChargeControls from '../lib/components/dashboard/ChargeControls.svelte'
  import RatePill from '../lib/components/dashboard/RatePill.svelte'
  import ChargeLimitCard from '../lib/components/dashboard/ChargeLimitCard.svelte'

  let busy = $state(false)
  let rateNonce = $state(0)

  // ── derived view-model ──────────────────────────────────────────────────
  let mode = $derived($uistates_store?.mode ?? 0)
  let display = $derived(displayState($status_store, mode))
  let charging = $derived(display === 'charging')
  // While charging, show the session chart hero (it polls /energy/raw); every
  // other state keeps the PowerRing.
  let showChart = $derived(charging)
  // Rate pill slider stops at the configured soft max (Settings > Charger), so
  // the home page can't request — or display — more current than the user has
  // allowed. Falls back to the hardware ceiling when the soft max is unset.
  let minAmps = $derived($config_store?.min_current_hard ?? 6)
  let maxAmps = $derived(
    Math.min($config_store?.max_current_soft ?? Infinity, $config_store?.max_current_hard ?? 48),
  )
  let defaultAmps = $derived($config_store?.max_current_soft ?? maxAmps)
  let fill = $derived(ringFill($status_store, $config_store, $limit_store))

  let socRangeLimit = $derived($limit_store?.type === 'soc' || $limit_store?.type === 'range')

  // A default limit applied by the firmware (config limit_default_*) reports
  // auto_release: false on /limit — it's config-driven, so the dashboard
  // shows it but offers no way to delete it.
  let systemLimit = $derived($limit_store?.auto_release === false)

  let claimOwner = $derived($claims_target_store?.claims?.state)
  // A reached charge limit grabs the state-claim to stop charging. Unlike OCPP
  // or RFID it's the user's own setting, not an external authority — so we don't
  // lock the controls; we surface it as the ring reason and let On clear it.
  let limitTripped = $derived(claimOwner === EvseClients.limit.id)
  let reason = $derived(
    limitTripped
      ? { key: 'dashboard.reason.limit_reached', values: { value: formatLimit($limit_store) } }
      : connectedReason(mode, $plan_store, claimOwner ? clientid2name(claimOwner) : ''),
  )

  let kw = $derived((($status_store?.power ?? 0) / 1000).toFixed(1))
  // Shown on the PowerRing while charging (the non-Labs / chart-off path).
  // maxPowerW handles the 3-phase ×3 so this label matches the ring fill.
  let maxKw = $derived((maxPowerW($status_store, $config_store) / 1000).toFixed(1))

  let tempDisplay = $derived(
    formatTemp(temp_round($status_store?.temp), $config_store?.temp_unit ?? 'c'),
  )
  let live = $derived({
    sessionKwh: (($status_store?.session_energy ?? 0) / 1000).toFixed(2),
    elapsed: sec2time($status_store?.session_elapsed ?? 0),
    currentA: (($status_store?.amp ?? 0) / 1000).toFixed(1),
    voltage: $status_store?.voltage ?? 0,
    temp: tempDisplay.value,
    tempUnit: tempDisplay.unitKey,
    pilotA: $status_store?.pilot ?? 0,
    // Vehicle charge ETA (MQTT topic) — '' when the topic isn't configured.
    toFull: hmsShort($status_store?.time_to_full_charge ?? 0),
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
      : defaultAmps,
  )
  let rateClaimedBy = $derived(
    $claims_target_store?.claims?.charge_current &&
    $claims_target_store.claims.charge_current !== EvseClients.manual.id
      ? clientid2name($claims_target_store.claims.charge_current)
      : '',
  )

  // OCPP/RFID are external authorities that genuinely own the charge — lock the
  // mode controls. A reached limit is handled separately (see limitTripped).
  let modeLocked = $derived(
    claimOwner === EvseClients.ocpp.id ||
    claimOwner === EvseClients.rfid.id,
  )
  let modeLockLabel = $derived(
    claimOwner === EvseClients.ocpp.id
      ? 'OCPP'
      : claimOwner === EvseClients.rfid.id
        ? 'RFID'
        : '',
  )

  let showEco = $derived(!!$config_store?.divert_enabled)
  let ecoOn = $derived($status_store?.divertmode === 2 && mode === 0)
  let chargeSegment = $derived(
    selectedSegment({
      mode,
      divertmode: $status_store?.divertmode,
      divertEnabled: !!$config_store?.divert_enabled,
    }),
  )

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
  let barLimitActive = $derived(socRangeLimit)
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
        // Forcing On past a reached limit: the limit claim outranks manual, so
        // the override alone won't resume — clear the tripped limit too.
        // Never DELETE a system limit: the firmware only re-applies the
        // config default at boot or on a config write, so deleting it here
        // would silently discard the configured limit.
        if (ok && seg === 'on' && limitTripped && !systemLimit) {
          ok = await serialQueue.add(() => limit_store.remove())
        }
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
      if (val === defaultAmps) {
        // removeProp() itself preserves a live boost timer (it routes the
        // re-upload through override_store.preserveBoostDuration()) — see
        // the store for the shared invariant this and the else branch below
        // both rely on: a re-POST while a boost is active always carries the
        // remaining duration and never `remaining`.
        await serialQueue.add(() => override_store.removeProp('charge_current'))
      } else {
        const current = $override_store ?? {}
        // auto_release: false to keep the override sticky — see setSegment.
        // preserveBoostDuration() is a no-op when no boost is active, so
        // this is identical to the old plain-spread upload outside a boost.
        const ok = await serialQueue.add(() =>
          override_store.upload(
            override_store.preserveBoostDuration({ ...current, charge_current: val, auto_release: false }),
          ),
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


  // Inline editors commit device-unit values; 0 means clear. A system limit
  // is never DELETEd from here — snap the card back instead (shipped rule).
  async function setInlineLimit({ type, value }) {
    if (busy) return
    if (!value) {
      if (systemLimit) {
        socNonce++
        return
      }
      return clearLimit()
    }
    busy = true
    try {
      const ok = await serialQueue.add(() => limit_store.upload({ type, value, auto_release: true }))
      if (ok) {
        await serialQueue.add(() => limit_store.download())
      } else {
        showWriteError()
        socNonce++
      }
    } finally {
      busy = false
    }
  }

  async function clearLimit() {
    const ok = await serialQueue.add(() => limit_store.remove())
    if (!ok) {
      showWriteError()
      socNonce++ // remount the card so a dragged-to-zero knob reverts
    }
  }

  // Snap-to-clear: a knob at/above the vehicle limit means "no limit". Below it,
  // write a soc or range limit depending on the active display unit.
  async function setTarget(pct) {
    if (busy) return
    busy = true
    try {
      let ok
      if (pct >= socCeiling(vehicleLimit)) {
        if (barLimitActive && systemLimit) {
          // A system (default) limit can't be cleared from the bar — snap the
          // knob back to the configured limit instead of deleting it.
          socNonce++
          ok = true
        } else {
          ok = barLimitActive ? await serialQueue.add(() => limit_store.remove()) : true
        }
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

  // Boost: force-active override for the chosen duration. We *don't* touch
  // the /limit endpoint — limits there only enforce stop conditions, and
  // setting a time limit with no session running causes the limit claim
  // (priority 1100) to immediately fire "expired", taking state ownership
  // away from our override and dropping mode back to Auto / Sleeping.
  //
  // The device owns the timer (POST /override `duration`, seconds). When it
  // expires the firmware releases the Manual override itself — there is no
  // prior override to restore on expiry (the boost claim replaced it), so
  // there is no browser-side timer to keep in sync with a refresh.
  // boostEndsAt is instead re-anchored below from whatever `remaining` the
  // override store last reported. Note this is one-way: arming or ending a
  // boost bumps override_version and reaches a refreshed page or a second
  // tab on its next natural refetch, but re-POSTing a still-active boost
  // (e.g. from a rate change, see setChargeAmps) does NOT bump the version
  // — that update stays local to this tab until something else refetches.
  // There's no re-boost-while-active control in this UI, so in practice
  // that gap is mostly moot.
  //
  // ms-epoch when the active boost ends, or null. Drives the inline
  // "Boosting · MM:SS" indicator inside ChargeControls.
  let boostEndsAt = $state(null)

  // Single source of truth for the countdown: re-derive it from the
  // override store every time it updates — our own POST+GET below, a
  // `DataManager` refetch after the firmware bumps override_version
  // (including auto-release on expiry), a page load, or our own mid-boost
  // rate change (setChargeAmps). Prefer a GET's `remaining`; fall back to a
  // just-uploaded `duration` when no GET has happened yet — upload() stores
  // exactly what it POSTed, so a rate change while boosting lands here with
  // `duration` set and no `remaining` until the next refetch. Without this
  // fallback the effect would null boostEndsAt on our own optimistic write
  // (flipping the UI back to the idle Boost button and opening a window for
  // a double-boost) until that refetch caught up. Neither field present —
  // {}, undefined, or a plain active override with no timer at all — means
  // no active boost.
  $effect(() => {
    const o = $override_store
    const remaining = o?.remaining
    const duration = o?.duration
    const secs =
      typeof remaining === 'number' && remaining > 0
        ? remaining
        : typeof duration === 'number' && duration > 0
          ? duration
          : null
    boostEndsAt = secs != null ? Date.now() + secs * 1000 : null
  })

  async function boost(minutes) {
    if (busy) return
    busy = true
    try {
      // Defensively clear any existing /limit before we touch the override.
      // A residual limit claim (priority 1100) silently holds state ownership
      // even when /limit returns {}, which would mask our override and keep
      // the device sleeping. The endpoint returns "done" even if nothing was
      // set, so it's a safe no-op when there's nothing to clear.
      // Never DELETE a system (default) limit though — the firmware only
      // re-applies it at boot or on a config write, so the delete would
      // silently discard the configured limit. Boosting past a *tripped*
      // system limit therefore won't resume charging (same accepted
      // behavior as pressing On).
      if (!systemLimit) await serialQueue.add(() => limit_store.remove())

      // Snapshot whatever override the user had before we touch it — the
      // old-firmware undo path below restores this rather than dropping to
      // Auto. Strip `remaining`: it's a read-only GET field and must never
      // be re-POSTed (upload() also strips it, but there's nothing to
      // "restore" about a stale countdown snapshot either way).
      const prevOverride = { ...($override_store || {}) }
      delete prevOverride.remaining

      // auto_release: false is intentional. The device defaults overrides
      // to auto_release: true when the field is omitted, which (verified on
      // live hardware) causes the manual override claim to be released soon
      // after acceptance — a residual limit claim then re-emerges and pins
      // state=disabled. Setting it false keeps the override sticky.
      // duration (seconds) is the device-side timer; a re-boost always
      // restarts it from now.
      const ok = await serialQueue.add(() =>
        override_store.upload({
          state: 'active',
          charge_current: $config_store?.max_current_soft,
          auto_release: false,
          duration: minutes * 60,
        }),
      )
      if (!ok) {
        showWriteError()
        return
      }
      // The POST response never carries `remaining` — override_store.upload
      // stores exactly what we sent. Re-fetch to learn whether the firmware
      // actually armed a device-side timer.
      const downloaded = await serialQueue.add(() => override_store.download())
      const after = $override_store
      if (!downloaded || after === 'error' || after === null || typeof after !== 'object') {
        // The GET failed — either a network/timeout error (download() can't
        // tell that apart from success and stores httpAPI's literal string
        // "error" as-is, caught by the after === 'error' check) or a JSON
        // error body distinct from "No manual override" (download() itself
        // returns false for that). Either way, the POST likely still landed
        // (it bumped override_version), so don't second-guess a possibly-
        // live boost by deleting it or claiming the firmware is too old:
        // surface a normal write error and let DataManager's next refetch
        // (triggered by that version bump) anchor the countdown.
        showWriteError()
        return
      }
      const remaining = after?.remaining
      if (!(typeof remaining === 'number' && remaining > 0)) {
        // Genuinely old firmware: the GET succeeded but never reports a
        // timer, so it accepts and silently ignores `duration` — it will
        // never release this override on its own. Restore whatever the
        // user had running before (Off must stay Off, not fall back to
        // Auto) rather than leaving the charger forced on forever.
        const restored = prevOverride.state
          ? await serialQueue.add(() => override_store.upload(prevOverride))
          : await serialQueue.add(() => override_store.clear())
        if (!restored) {
          // The undo itself failed — the charger may still be sitting on
          // the just-armed (but timer-less) override. Telling the user
          // "boost isn't supported, we've undone it" would be a lie in that
          // case, so surface a plain write error instead: it's the honest
          // "something didn't go through, try again" signal, and doesn't
          // imply a resolved state that isn't real.
          showWriteError()
        } else {
          showBoostUnsupported()
        }
      }
    } finally {
      busy = false
    }
  }

  async function cancelBoost() {
    const ok = await serialQueue.add(() => override_store.clear())
    if (!ok) showWriteError()
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

<section
  class="flex flex-col px-4 pb-4 lg:mx-auto lg:grid lg:w-full lg:max-w-5xl
         lg:grid-cols-2 lg:items-start lg:gap-x-6"
>
  {#if showChart}
    <!-- Labs chart hero: full content width on desktop, first block on mobile -->
    <div class="max-lg:order-1 lg:col-span-2" in:fade={{ duration: 150 }}>
      <ChargingHero
        {kw}
        soc={hasSoc ? ($status_store?.battery_level ?? null) : null}
        target={socTarget}
        {hasSoc}
        amps={chargeAmps}
        {minAmps}
        {maxAmps}
        {rateClaimedBy}
        {rateNonce}
        samples={$energy_store.raw.samples}
        voltage={$status_store?.voltage ?? 0}
        phases={$config_store?.is_threephase ? 3 : 1}
        sessionElapsed={$status_store?.session_elapsed ?? 0}
        chartError={$energy_store.error.raw}
        rateDisabled={busy || ecoOn || display === 'error'}
        onrate={setChargeAmps}
      />
    </div>
  {/if}

  {#if !showChart}
    <!-- Ring hero: occupies the same top-center spanning slot as the chart,
         so the hero area matches between the two states. -->
    <div class="max-lg:order-1 lg:col-span-2"><StatusLine {display} /></div>
    <div class="relative max-lg:order-2 lg:col-span-2" in:fade={{ duration: 150 }}>
      <div class="absolute right-3 top-1 z-10">
        {#key rateNonce}
          <RatePill
            amps={chargeAmps}
            min={minAmps}
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
        reasonDetail={reason.detail ?? null}
        faultText={getStateDesc($status_store?.state) ?? ''}
      />
    </div>
  {/if}

  <!-- Act column: throttle, mode controls.
       max-lg:contents dissolves the wrapper on mobile; max-lg:order-* on the
       children preserves today's visual order in the section's flex-col. -->
  <div class="max-lg:contents lg:flex lg:flex-col">
    <div class="max-lg:order-3"><ThrottleBadge /></div>

    <!-- Unified charge controls: segmented mode + the Boost modifier.
         Stays visible (disabled) during a fault so the layout doesn't reflow. -->
    <div class="max-lg:order-5">
      <ChargeControls
        segment={chargeSegment}
        divertEnabled={showEco}
        locked={modeLocked}
        lockLabel={modeLockLabel}
        disabled={busy || display === 'error'}
        {boostEndsAt}
        onsegment={setSegment}
        onboost={boost}
        oncancelboost={cancelBoost}
      />
    </div>
  </div>

  <!-- Observe column: stat chips -->
  <div class="max-lg:contents lg:flex lg:flex-col">
    <div class="max-lg:order-4">
      <StatChips {charging} {live} {summary} {sessionCost} />
      <ShaperDivertRow />
    </div>
  </div>

  <!-- SOC / charge-limit card: full content width on desktop, below the columns -->
  {#if display !== 'error'}
    <div class="max-lg:order-6 lg:col-span-2">
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
          estMaxRange={maxRange}
          disabled={busy}
          ontarget={setTarget}
          onunit={(u) => (userUnit = u)}
          limit={$limit_store}
          elapsedSec={$status_store?.session_elapsed ?? 0}
          sessionWh={$status_store?.session_energy ?? 0}
          {systemLimit}
          maxEnergyKwh={$uisettings_store?.max_energy_kwh ?? 100}
          onlimit={setInlineLimit}
        />
      {/key}
    </div>
  {/if}
</section>
