<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Button from '../ui/Button.svelte'
  import Slider from '../ui/Slider.svelte'
  import Toggle from '../ui/Toggle.svelte'
  import LimitSliderBar from '../dashboard/LimitSliderBar.svelte'
  import DayPicker from '../schedule/DayPicker.svelte'
  import { daysToFlags, flagsToDays, DAYS } from '../../schedule/timers.js'
  import { isNextDay } from '../../charge_manager/rules.js'

  let {
    open = false,
    rule = null,
    busy = false,
    socAvailable = false,
    rangeAvailable = false,
    rangeMiles = false,   // range limit unit: miles when true, km otherwise
    // Feature availability — greys out the matching action option when false.
    ocppAvailable = true,
    rfidAvailable = true,
    minCurrent = 6,
    maxCurrent = 80,
    // Global safety config surfaced contextually on certain action cards.
    bootLockSupported  = false,
    bootLock           = false,
    heartbeatSupported = false,
    heartbeatEnabled   = false,
    onBootLockChange   = () => {},   // (enabled: boolean) => void
    onHeartbeatChange  = () => {},   // (enabled: boolean) => void
    onclose = () => {},
    onsave = () => {},
  } = $props()

  // ── Form state ────────────────────────────────────────────────────────────
  let alwaysOn    = $state(true)
  let flags       = $state(DAYS.map(() => true))
  let startTime   = $state('08:00')
  let stopTime    = $state('18:00')
  let hasStopTime = $state(false)
  let action      = $state('charge')
  let limitType   = $state('none')
  let limitValue  = $state(0)
  let chargeCurrent = $state(16)
  let showDayError   = $state(false)
  let showTimeError  = $state(false)
  let showLimitError = $state(false)

  $effect(() => {
    if (open) {
      alwaysOn      = rule?.alwaysOn ?? true
      flags         = rule ? daysToFlags(rule.days) : DAYS.map(() => true)
      startTime     = rule?.startTime ?? '08:00'
      stopTime      = rule?.stopTime ?? '18:00'
      hasStopTime   = (rule?.stopTime ?? null) != null
      action        = rule?.action ?? 'charge'
      limitType     = rule?.limit?.type ?? 'none'
      limitValue    = rule?.limit?.value ?? 0
      chargeCurrent = rule?.chargeCurrent ?? 16
      showDayError   = false
      showTimeError  = false
      showLimitError = false
    }
  })

  // ── Derived ───────────────────────────────────────────────────────────────
  let nextDay        = $derived(hasStopTime && isNextDay(startTime, stopTime))
  let isLimitFeature = $derived(alwaysOn && action === 'charge')
  let showAction     = $derived(!isLimitFeature)
  let showLimit      = $derived(isLimitFeature || (!alwaysOn && !['disable', 'ocpp'].includes(action)))
  let showChargeCurrent = $derived(!alwaysOn && action === 'charge')
  // Boot Lock surfaces on RFID/OCPP cards; Heartbeat on Eco/Grid-shaping cards.
  let showBootLock   = $derived(bootLockSupported && ['rfid', 'ocpp'].includes(action))
  let showHeartbeat  = $derived(heartbeatSupported && ['eco_divert', 'shaper'].includes(action))
  // SOC is a percentage, range a distance — neither fits LimitSliderBar's
  // time/energy tick scales, so they get plain sliders with their own units.
  let rangeUnit  = $derived(rangeMiles ? $_('units.miles') : $_('units.km'))
  let vehicleLimit = $derived(
    limitType === 'soc'   ? { min: 0, max: 100, step: 5,  unit: '%' } :
    limitType === 'range' ? { min: 0, max: 500, step: 10, unit: ' ' + rangeUnit } :
    null
  )

  function validate() {
    if (!alwaysOn && !flags.some((f) => f)) { showDayError = true; return false }
    // Equal start/stop would silently become a 24h window (isNextDay uses <=).
    if (!alwaysOn && hasStopTime && stopTime === startTime) { showTimeError = true; return false }
    // An always-on session limit with no limit set writes nothing to the device.
    if (isLimitFeature && (limitType === 'none' || !(limitValue > 0))) { showLimitError = true; return false }
    return true
  }

  function save() {
    if (!validate()) return
    const days  = alwaysOn ? [...DAYS] : flagsToDays(flags)
    const limit = (showLimit && limitType !== 'none' && limitValue > 0)
      ? { type: limitType, value: limitValue }
      : null
    onsave({
      ...(rule ?? {}),
      alwaysOn,
      days,
      startTime: alwaysOn ? '00:00' : startTime,
      stopTime:  (alwaysOn || !hasStopTime) ? null : stopTime,
      action,
      chargeCurrent: (showChargeCurrent && chargeCurrent > 0) ? chargeCurrent : null,
      limit,
      _startEventId: rule?._startEventId ?? null,
      _stopEventId:  rule?._stopEventId  ?? null,
    })
  }

  const SELECT_CLASS =
    'mt-1 block w-full appearance-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text'
</script>

<Modal visible={open} closable={!busy} {onclose}>
  <h2 class="mb-5 text-base font-semibold text-text">
    {rule ? $_('charge_manager.rule_edit_title') : $_('charge_manager.rule_new_title')}
  </h2>

  <!-- Always On checkbox -->
  <label class="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2 p-3">
    <input
      type="checkbox"
      bind:checked={alwaysOn}
      class="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
    />
    <div>
      <div class="text-sm font-semibold text-text">{$_('charge_manager.rule_always_on')}</div>
      <div class="mt-0.5 text-xs text-text-dim">{$_('charge_manager.rule_always_on_desc')}</div>
    </div>
  </label>

  <!-- Schedule section (greyed when Always On) -->
  <div class={alwaysOn ? 'pointer-events-none opacity-40' : ''}>
    <DayPicker {flags} onchange={(f) => { flags = f; showDayError = false }} />
    {#if showDayError}
      <p class="mt-2 text-xs text-error">{$_('charge_manager.rule_error_no_day')}</p>
    {/if}

    <!-- Start time -->
    <label class="mt-4 block">
      <span class="mb-1 block text-[10px] uppercase tracking-wide text-text-dim">
        {$_('charge_manager.rule_start_time')}
      </span>
      <input
        type="time"
        bind:value={startTime}
        oninput={() => (showTimeError = false)}
        class={SELECT_CLASS}
      />
    </label>

    <!-- Stop time (optional) -->
    <label class="mt-4 flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        bind:checked={hasStopTime}
        class="h-4 w-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span class="text-sm text-text">{$_('charge_manager.rule_set_stop_time')}</span>
    </label>

    {#if hasStopTime}
      <label class="mt-2 block">
        <span class="mb-1 block text-[10px] uppercase tracking-wide text-text-dim">
          {$_('charge_manager.rule_stop_time')}
          {#if nextDay}
            <span class="ml-1 text-warning">{$_('charge_manager.rule_stop_next_day')}</span>
          {/if}
        </span>
        <input
          type="time"
          bind:value={stopTime}
          oninput={() => (showTimeError = false)}
          class={SELECT_CLASS}
        />
      </label>
      {#if showTimeError}
        <p class="mt-2 text-xs text-error">{$_('charge_manager.rule_error_same_time')}</p>
      {/if}
    {/if}
  </div>

  <!-- Action dropdown (hidden when Always On — limit is the only relevant setting) -->
  {#if showAction}
    <div class="mt-5">
      <span class="mb-1 block text-[10px] uppercase tracking-wide text-text-dim">
        {$_('charge_manager.rule_action')}
      </span>
      <select bind:value={action} class={SELECT_CLASS}>
        <option value="charge">{$_('charge_manager.rule_action_charge')}</option>
        <option value="eco_divert">{$_('charge_manager.rule_action_eco_divert')}</option>
        <option value="shaper">{$_('charge_manager.rule_action_shaper')}</option>
        <option value="rfid" disabled={!rfidAvailable}>
          {$_('charge_manager.rule_action_rfid')}{!rfidAvailable ? ' — ' + $_('charge_manager.feature_rfid_unavailable') : ''}
        </option>
        <option value="ocpp" disabled={!ocppAvailable}>
          {$_('charge_manager.rule_action_ocpp')}{!ocppAvailable ? ' — ' + $_('charge_manager.feature_ocpp_unavailable') : ''}
        </option>
        <option value="disable">{$_('charge_manager.rule_action_disable')}</option>
      </select>
    </div>
  {/if}

  <!-- Boot Lock (RFID / OCPP) — global safety config, saved immediately -->
  {#if showBootLock}
    <div class="mt-5 rounded-xl border border-border bg-surface-2 p-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-text">{$_('config.security.boot_lock')}</span>
        <Toggle
          checked={bootLock}
          label={$_('config.security.boot_lock')}
          disabled={busy}
          onchange={onBootLockChange}
        />
      </div>
      <p class="mt-1.5 text-xs text-text-dim">{$_('charge_manager.boot_lock_note')}</p>
    </div>
  {/if}

  <!-- Heartbeat supervision (Eco / Grid shaping) — global safety config -->
  {#if showHeartbeat}
    <div class="mt-5 rounded-xl border border-border bg-surface-2 p-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-text">{$_('config.security.heartbeat')}</span>
        <Toggle
          checked={heartbeatEnabled}
          label={$_('config.security.heartbeat')}
          disabled={busy}
          onchange={onHeartbeatChange}
        />
      </div>
      <p class="mt-1.5 text-xs text-text-dim">{$_('charge_manager.heartbeat_note')}</p>
    </div>
  {/if}

  <!-- Charge current (only for charge action) -->
  {#if showChargeCurrent}
    <div class="mt-4">
      <div class="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-wide text-text-dim">
        <span>{$_('charge_manager.feature_charge_current')}</span>
        <span class="font-semibold normal-case text-text">{chargeCurrent} A</span>
      </div>
      <Slider
        min={minCurrent}
        max={maxCurrent}
        step={1}
        value={chargeCurrent}
        format={(v) => `${v} A`}
        ariaLabel={$_('charge_manager.feature_charge_current')}
        onchange={(v) => (chargeCurrent = v)}
      />
      <div class="mt-1 flex justify-between text-[10px] text-text-dim">
        <span>{minCurrent} A</span>
        <span>{maxCurrent} A</span>
      </div>
    </div>
  {/if}

  <!-- Limit dropdown -->
  {#if showLimit}
    <div class="mt-4">
      <span class="mb-1 block text-[10px] uppercase tracking-wide text-text-dim">
        {$_('charge_manager.rule_limit')}
      </span>
      <select
        bind:value={limitType}
        onchange={() => { if (limitType === 'none') limitValue = 0; showLimitError = false }}
        class={SELECT_CLASS}
      >
        <option value="none">{$_('charge_manager.rule_limit_none')}</option>
        <option value="time">{$_('charge_manager.rule_limit_time')}</option>
        <option value="energy">{$_('charge_manager.rule_limit_energy')}</option>
        <option value="soc" disabled={!socAvailable}>
          {$_('charge_manager.rule_limit_soc')}{!socAvailable ? ' — ' + $_('charge_manager.limit_soc_unavailable') : ''}
        </option>
        <option value="range" disabled={!rangeAvailable}>
          {$_('charge_manager.rule_limit_range')}{!rangeAvailable ? ' — ' + $_('charge_manager.limit_range_unavailable') : ''}
        </option>
      </select>

      {#if vehicleLimit}
        <div class="mt-3">
          <div class="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-wide text-text-dim">
            <span>{$_(limitType === 'soc' ? 'charge_manager.rule_limit_soc' : 'charge_manager.rule_limit_range')}</span>
            <span class="font-semibold normal-case text-text">{limitValue}{vehicleLimit.unit}</span>
          </div>
          <Slider
            min={vehicleLimit.min}
            max={vehicleLimit.max}
            step={vehicleLimit.step}
            value={limitValue}
            format={(v) => `${v}${vehicleLimit.unit}`}
            ariaLabel={$_(limitType === 'soc' ? 'charge_manager.rule_limit_soc' : 'charge_manager.rule_limit_range')}
            onchange={(v) => { limitValue = v; showLimitError = false }}
          />
          <div class="mt-1 flex justify-between text-[10px] text-text-dim">
            <span>{vehicleLimit.min}{vehicleLimit.unit}</span>
            <span>{vehicleLimit.max}{vehicleLimit.unit}</span>
          </div>
        </div>
      {:else if limitType !== 'none'}
        <div class="mt-3">
          <LimitSliderBar
            kind={limitType === 'energy' ? 'energy' : 'time'}
            value={limitValue}
            progress={0}
            charging={false}
            onchange={(v) => { limitValue = v; showLimitError = false }}
          />
        </div>
      {/if}
      {#if showLimitError}
        <p class="mt-2 text-xs text-error">{$_('charge_manager.rule_error_no_limit')}</p>
      {/if}
    </div>
  {/if}

  <!-- Buttons -->
  <div class="mt-6 flex gap-2">
    <Button label={$_('charge_manager.rule_save')} disabled={busy} onclick={save} />
    <Button label={$_('charge_manager.rule_cancel')} variant="ghost" disabled={busy} onclick={onclose} />
  </div>
</Modal>
