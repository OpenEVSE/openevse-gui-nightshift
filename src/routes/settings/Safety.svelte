<!-- src/routes/settings/Safety.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { cabletemp_store } from '../../lib/stores/cabletemp.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { createCableTempForm } from '../../lib/config/cableTempForm.svelte.js'
  import { allRequiredSafetyChecksOn } from '../../lib/config/safety.js'
  import {
    CABLE_TEMP_PIN_PP, CABLE_TEMP_PIN_PP2,
    cableTempSourceOnPin, cableTempSourceOptions, cableTempStatusKey,
    cToUnit, c10ToUnit, unitToC10,
  } from '../../lib/cabletemp.js'
  import { formatTemp } from '../../lib/temperature.js'
  import { notification_store } from '../../lib/stores/notifications.js'
  import { settingsMarkers } from '../../lib/notifications/notifications.js'
  import AdvisoryMarker from '../../lib/components/notifications/AdvisoryMarker.svelte'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import Card from '../../lib/components/ui/Card.svelte'
  import Icon from '../../lib/icons/Icon.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import TempProtectionCard from '../../lib/components/charge_manager/TempProtectionCard.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  // Safety Checks card is collapsed by default — the at-a-glance status next to
  // the title tells the user whether they need to expand it.
  let checksOpen = $state(false)
  let checksToggled = $state(false)

  // All checks rendered as toggles, in display order. `temp_check` is here
  // because the firmware raises safety.temp_check when it is off, and an
  // advisory that says "temperature monitoring is off" is worth nothing
  // without the switch that turns it back on. Presence-gated like
  // overcurrent_monitor below: absent from /config means the charger has no
  // such setting, and an unconditional toggle would read a missing key as
  // "off" and offer to fix something that isn't broken.
  const BASE_CHECKS = [
    'gfci_check', 'ground_check', 'relay_check',
    'diode_check', 'vent_check',
  ]
  let CHECKS = $derived(
    $config_store?.temp_check === undefined ? BASE_CHECKS : [...BASE_CHECKS, 'temp_check'],
  )
  // GFCI self-test and overcurrent monitoring are optional safety features —
  // they're shown but don't gate the "All Required Safety Checks On" status
  // (see lib/config/safety.js, shared with the Charge Manager).
  let allOn = $derived(allRequiredSafetyChecksOn($config_store))

  // Cable temperature monitoring (NTC thermistors in the EV/input cables,
  // RAPI $SN/$GN). Collapsed by default like the Safety checks card above.
  // Its own toggle lives in /config (`cable_temp`); the per-input source
  // assignment and per-source calibration live on the dedicated /cabletemp
  // endpoint (~20 fields — too many for /config's near-exhausted document),
  // fetched once the card is open with the feature on.
  let cableTempOpen = $state(false)
  const ctForm = createCableTempForm()
  const ctSaveState = ctForm.saveState

  const CABLE_TEMP_INPUTS = [
    { pin: CABLE_TEMP_PIN_PP, other: CABLE_TEMP_PIN_PP2, labelKey: 'config.cabletemp.input1' },
    { pin: CABLE_TEMP_PIN_PP2, other: CABLE_TEMP_PIN_PP, labelKey: 'config.cabletemp.input2' },
  ]

  // Derived first so the effect re-runs when the flag changes, not on every
  // /config re-read while the page is mounted.
  let cableTempOn = $derived(!!$config_store?.cable_temp)
  $effect(() => {
    if (cableTempOpen && cableTempOn) ctForm.refresh()
  })

  function pinSource(pin) {
    return cableTempSourceOnPin($cabletemp_store, pin)
  }

  // The device stores and reports every temperature in °C; like
  // TempProtectionCard below, only what the user sees and types follows
  // temp_unit — so the reading, the offset and the panic threshold all show
  // in the same unit as the enclosure thresholds two sections down.
  let tempUnit = $derived($config_store?.temp_unit ?? 'c')
  let tempUnitKey = $derived(tempUnit === 'f' ? 'units.fahrenheit' : 'units.celsius')

  function readingText(source) {
    const statusKey = cableTempStatusKey(source.status)
    if (statusKey) return $_('config.cabletemp.status_' + statusKey)
    if (typeof source.temperature !== 'number') return '—'
    const t = formatTemp(source.temperature, tempUnit)
    return t.value === null ? '—' : `${t.value} ${$_(t.unitKey)}`
  }

  // One entry per calibration field. `temp` marks the two that are
  // temperatures on the wire (tenths of °C): 'abs' for a point on the scale,
  // 'delta' for a difference, which converts to °F by ratio alone. Bounds for
  // those are in °C and converted alongside the value.
  const CALIBRATION = [
    { field: 'r25', labelKey: 'config.cabletemp.r25', unitKey: 'units.ohm', min: 100, max: 65535, step: 1 },
    { field: 'beta', labelKey: 'config.cabletemp.beta', unitKey: null, min: 1000, max: 6000, step: 1 },
    { field: 'offset_c10', labelKey: 'config.cabletemp.offset', temp: 'delta', min: -20, max: 20, step: 0.1 },
    { field: 'panic_c10', labelKey: 'config.cabletemp.panic', temp: 'abs', min: 30, max: 150, step: 0.1 },
  ]

  function calLabel(f) {
    const unitKey = f.temp ? tempUnitKey : f.unitKey
    return unitKey ? `${$_(f.labelKey)} (${$_(unitKey)})` : $_(f.labelKey)
  }
  function calValue(source, f) {
    return f.temp ? c10ToUnit(source[f.field], tempUnit, f.temp === 'delta') : (source[f.field] ?? null)
  }
  function calBound(f, c) {
    return f.temp ? Math.round(cToUnit(c, tempUnit, f.temp === 'delta')) : c
  }
  function calSave(source, f, v) {
    const wire = f.temp ? unitToC10(v, tempUnit, f.temp === 'delta') : v
    ctForm.saveField(source.source, source, f.field, wire)
  }

  // Config key → the advisory raised against it, muted entries included:
  // acking silences the alarm, it never hides the state. The count also shows
  // on the closed header, so a muted advisory is never invisible on the one
  // page that can act on it.
  let markers = $derived(settingsMarkers($notification_store.items))
  let markerCount = $derived(CHECKS.filter((c) => markers[c]).length)

  $effect(() => {
    // Open the card the first time the charger reports an advisory about one
    // of these switches. A marker sitting behind a collapsed card is a marker
    // nobody reads, and an advisory is exactly the signal the collapsed
    // default was waiting for. Once only — a deliberate collapse must not be
    // re-opened on the next poll.
    if (!checksToggled && markerCount > 0) checksOpen = true
  })
</script>

<ConfigPage title={$_('config.pages.safety')}>
  <!-- Collapsible Safety Checks card: status shown next to the title -->
  <Card class="mb-4 p-4">
    <button
      type="button"
      onclick={() => { checksToggled = true; checksOpen = !checksOpen }}
      aria-expanded={checksOpen}
      class="flex w-full items-center justify-between gap-3 text-left"
    >
      <h2 class="shrink-0 text-sm font-semibold text-text-dim">{$_('config.safety.checks')}</h2>
      <span class="flex min-w-0 items-center gap-2">
        {#if markerCount > 0}
          <span class="truncate text-xs font-semibold text-warning">
            {$_('notifications.checks_off', { values: { count: markerCount } })}
          </span>
        {:else if allOn}
          <span class="truncate text-xs font-semibold text-success">{$_('config.safety.all_on')}</span>
        {:else}
          <span class="truncate text-xs font-semibold text-warning">{$_('config.safety.warning')}</span>
        {/if}
        <Icon
          icon={checksOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
          size={20}
          class="shrink-0 text-text-dim"
        />
      </span>
    </button>

    {#if checksOpen}
      <div class="mt-3">
        {#each CHECKS as check}
          <FormField label={$_('config.safety.' + check)}>
            {#snippet badge()}
              <AdvisoryMarker marker={markers[check] ?? null} />
            {/snippet}
            <Toggle
              checked={!!$config_store?.[check]}
              label={$_('config.safety.' + check)}
              onchange={(v) => form.saveField(check, v)}
            />
          </FormField>
        {/each}
        {#if $config_store?.overcurrent_monitor !== undefined}
          <FormField label={$_('config.safety.overcurrent_monitor')}>
            <Toggle
              checked={!!$config_store?.overcurrent_monitor}
              label={$_('config.safety.overcurrent_monitor')}
              onchange={(v) => form.saveField('overcurrent_monitor', v)}
            />
          </FormField>
        {/if}
      </div>
    {/if}
  </Card>

  {#if $config_store?.cable_temp !== undefined}
    <!-- Collapsible Cable temperature card, same disclosure pattern as Safety checks above -->
    <Card class="mb-4 p-4">
      <button
        type="button"
        onclick={() => (cableTempOpen = !cableTempOpen)}
        aria-expanded={cableTempOpen}
        class="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 class="shrink-0 text-sm font-semibold text-text-dim">{$_('config.cabletemp.title')}</h2>
        <Icon
          icon={cableTempOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
          size={20}
          class="shrink-0 text-text-dim"
        />
      </button>

      {#if cableTempOpen}
        <div class="mt-3">
          <FormField
            label={$_('config.cabletemp.enable')}
            description={$_('config.cabletemp.enable_desc')}
            status={$ss.cable_temp ?? 'idle'}
          >
            <Toggle
              checked={cableTempOn}
              label={$_('config.cabletemp.enable')}
              onchange={(v) => form.saveField('cable_temp', v)}
            />
          </FormField>

          {#if cableTempOn}
            {#each CABLE_TEMP_INPUTS as input (input.pin)}
              {@const source = pinSource(input.pin)}
              <FormField
                label={$_(input.labelKey)}
                description={input.pin === CABLE_TEMP_PIN_PP ? $_('config.cabletemp.pp_note') : undefined}
                status={$ctSaveState['pin' + input.pin] ?? 'idle'}
              >
                <Select
                  options={cableTempSourceOptions(
                    $cabletemp_store, input.pin, input.other,
                    $_('config.cabletemp.none'),
                    (name) => $_('config.cabletemp.source_' + name),
                  )}
                  value={source ? String(source.source) : ''}
                  disabled={ctForm.busy}
                  onchange={(v) => ctForm.setPin($cabletemp_store, input.pin, v === '' ? null : Number(v))}
                />
              </FormField>

              {#if source}
                <!-- Calibration for the source on this input. Each value is a
                     FormField like every other numeric setting, so its own
                     save state shows beside its label; the box only groups the
                     four under the input they belong to. -->
                <div class="mb-3 rounded-xl border border-border bg-surface-2 px-3 py-1">
                  <div class="flex items-center justify-between py-2 text-sm">
                    <span class="text-text-dim">{$_('config.cabletemp.reading')}</span>
                    <span class="font-semibold text-text">{readingText(source)}</span>
                  </div>
                  <p class="text-xs text-text-dim">{$_('config.cabletemp.calibration_desc')}</p>
                  <div class="grid grid-cols-2 gap-x-3">
                    {#each CALIBRATION as f (f.field)}
                      <FormField
                        label={calLabel(f)}
                        status={$ctSaveState[`source${source.source}_${f.field}`] ?? 'idle'}
                      >
                        <NumberInput
                          value={calValue(source, f)}
                          min={calBound(f, f.min)}
                          max={calBound(f, f.max)}
                          step={f.step}
                          disabled={ctForm.busy}
                          onchange={(v) => calSave(source, f, v)}
                        />
                      </FormField>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      {/if}
    </Card>
  {/if}

  <ConfigSection title={$_('config.safety.temp_throttle')}>
    <FormField label={$_('config.safety.temp_throttle_enable')} description={$_('config.safety.temp_throttle_desc')}>
      <Toggle
        checked={!!$config_store?.temp_throttle_enabled}
        label={$_('config.safety.temp_throttle_enable')}
        onchange={(v) => form.saveField('temp_throttle_enabled', v)}
      />
    </FormField>
  </ConfigSection>

  {#if $config_store?.temp_throttle_enabled && $config_store?.over_temp_shutdown !== undefined}
    <TempProtectionCard
      throttle={$config_store?.temp_throttle_setpoint ?? 65}
      panic={$config_store?.over_temp_shutdown ?? 72}
      min={40}
      max={82}
      unit={$config_store?.temp_unit ?? 'c'}
      onThrottleChange={(v) => form.saveField('temp_throttle_setpoint', v)}
      onPanicChange={(v) => form.saveField('over_temp_shutdown', v)}
    />
  {/if}
</ConfigPage>
