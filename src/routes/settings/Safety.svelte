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
    c10ToC, cToC10,
  } from '../../lib/cabletemp.js'
  import { formatTemp } from '../../lib/temperature.js'
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

  // All checks rendered as toggles, in display order.
  const CHECKS = [
    'gfci_check', 'ground_check', 'relay_check',
    'diode_check', 'vent_check',
  ]
  // GFCI self-test and overcurrent monitoring are optional safety features —
  // they're shown but don't gate the "All Required Safety Checks On" status
  // (see lib/config/safety.js, shared with the Charge Manager).
  let allOn = $derived(allRequiredSafetyChecksOn($config_store))

  // Cable Temperature Monitoring (NTC thermistors in the EV/input cables,
  // RAPI $SN/$GN). Collapsed by default like the Safety Checks card above.
  // Its own toggle lives in /config (`cable_temp`); the per-input source
  // assignment and per-source calibration live on the dedicated /cabletemp
  // endpoint (~20 fields — too many for /config's near-exhausted document),
  // fetched on demand once the section is actually in use.
  let cableTempOpen = $state(false)
  const ctForm = createCableTempForm()
  const ctSaveState = ctForm.saveState

  const CABLE_TEMP_INPUTS = [
    { pin: CABLE_TEMP_PIN_PP, other: CABLE_TEMP_PIN_PP2, labelKey: 'config.cabletemp.input1' },
    { pin: CABLE_TEMP_PIN_PP2, other: CABLE_TEMP_PIN_PP, labelKey: 'config.cabletemp.input2' },
  ]

  $effect(() => {
    if ($config_store?.cable_temp) ctForm.refresh()
  })

  function pinSource(pin) {
    return cableTempSourceOnPin($cabletemp_store, pin)
  }

  function readingText(source) {
    const statusKey = cableTempStatusKey(source.status)
    if (statusKey) return $_('config.cabletemp.status_' + statusKey)
    if (typeof source.temperature !== 'number') return '—'
    const t = formatTemp(source.temperature, $config_store?.temp_unit ?? 'c')
    return t.value === null ? '—' : `${t.value} ${$_(t.unitKey)}`
  }
</script>

<ConfigPage title={$_('config.pages.safety')}>
  <!-- Collapsible Safety Checks card: status shown next to the title -->
  <Card class="mb-4 p-4">
    <button
      type="button"
      onclick={() => (checksOpen = !checksOpen)}
      aria-expanded={checksOpen}
      class="flex w-full items-center justify-between gap-3 text-left"
    >
      <h2 class="shrink-0 text-sm font-semibold text-text-dim">{$_('config.safety.checks')}</h2>
      <span class="flex min-w-0 items-center gap-2">
        {#if allOn}
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
    <!-- Collapsible Cable Temperature card, same disclosure pattern as Safety Checks above -->
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
            label={$_('config.safety.cable_temp')}
            description={$_('config.safety.cable_temp_desc')}
            status={$ss.cable_temp ?? 'idle'}
          >
            <Toggle
              checked={!!$config_store?.cable_temp}
              label={$_('config.safety.cable_temp')}
              onchange={(v) => form.saveField('cable_temp', v)}
            />
          </FormField>

          {#if $config_store?.cable_temp}
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
                <div class="mb-3 rounded-xl border border-border bg-surface-2 p-3">
                  <div class="mb-2 flex items-center justify-between text-sm">
                    <span class="text-text-dim">{$_('config.cabletemp.reading')}</span>
                    <span class="font-semibold text-text">{readingText(source)}</span>
                  </div>
                  <p class="mb-2 text-xs text-text-dim">{$_('config.cabletemp.calibration_desc')}</p>
                  <div class="grid grid-cols-2 gap-2">
                    <label class="text-xs text-text-dim">
                      {$_('config.cabletemp.r25')} ({$_('units.ohm')})
                      <NumberInput
                        value={source.r25 ?? null}
                        min={100} max={65535} step={1}
                        disabled={ctForm.busy}
                        onchange={(v) => ctForm.saveField(source.source, source, 'r25', v)}
                      />
                    </label>
                    <label class="text-xs text-text-dim">
                      {$_('config.cabletemp.beta')}
                      <NumberInput
                        value={source.beta ?? null}
                        min={1000} max={6000} step={1}
                        disabled={ctForm.busy}
                        onchange={(v) => ctForm.saveField(source.source, source, 'beta', v)}
                      />
                    </label>
                    <label class="text-xs text-text-dim">
                      {$_('config.cabletemp.offset')} ({$_('units.celsius')})
                      <NumberInput
                        value={c10ToC(source.offset_c10)}
                        min={-200} max={200} step={0.1}
                        disabled={ctForm.busy}
                        onchange={(v) => ctForm.saveField(source.source, source, 'offset_c10', cToC10(v))}
                      />
                    </label>
                    <label class="text-xs text-text-dim">
                      {$_('config.cabletemp.panic')} ({$_('units.celsius')})
                      <NumberInput
                        value={c10ToC(source.panic_c10)}
                        min={30} max={150} step={0.1}
                        disabled={ctForm.busy}
                        onchange={(v) => ctForm.saveField(source.source, source, 'panic_c10', cToC10(v))}
                      />
                    </label>
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
