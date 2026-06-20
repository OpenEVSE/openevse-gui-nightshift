<!-- src/routes/settings/Evse.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { uisettings_store } from '../../lib/stores/uisettings.js'
  import { clampEnergyMax, ENERGY_LIMIT_MAX_KWH } from '../../lib/dashboard/state.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Slider from '../../lib/components/ui/Slider.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let boolOptions = $derived([
    { value: 'false', label: $_('config.evse.disabled') },
    { value: 'true', label: $_('config.evse.active') },
  ])
  let phaseOptions = $derived([
    { value: 'false', label: $_('config.evse.singlephase') },
    { value: 'true', label: $_('config.evse.threephase_yes') },
  ])
  let serviceOptions = $derived([
    { value: '0', label: $_('config.evse.service_auto') },
    { value: '1', label: $_('config.evse.service_l1') },
    { value: '2', label: $_('config.evse.service_l2') },
  ])

  // System limit: the persistent default the firmware applies to every
  // session (config limit_default_type / limit_default_value). The device
  // stores energy in Wh; the field shows kWh. Unset type arrives as "".
  let sysType = $derived($config_store?.limit_default_type || 'none')
  let sysValue = $derived(Number($config_store?.limit_default_value ?? 0))
  let limitTypeOptions = $derived([
    { value: 'none', label: $_('config.evse.limit_none') },
    { value: 'time', label: $_('config.evse.limit_time') },
    { value: 'energy', label: $_('config.evse.limit_energy') },
    { value: 'soc', label: $_('config.evse.limit_soc') },
    { value: 'range', label: $_('config.evse.limit_range') },
  ])
  let sysUnitLabel = $derived(
    sysType === 'time'
      ? $_('dashboard.limit.minutes')
      : sysType === 'energy'
        ? $_('units.kwh')
        : sysType === 'soc'
          ? $_('units.percent')
          : sysType === 'range'
            ? ($config_store?.mqtt_vehicle_range_miles ? $_('units.miles') : $_('units.km'))
            : '',
  )

  function saveSystemLimitType(t) {
    // Value resets on type change — units differ per type (matches gui-v2).
    if (t === 'none') return form.saveField('limit_default_type', 'none')
    return form.saveFields({ limit_default_type: t, limit_default_value: 0 })
  }
  function saveSystemLimitValue(v) {
    const raw = sysType === 'energy' ? Math.round((v ?? 0) * 1000) : (v ?? 0)
    return form.saveField('limit_default_value', raw)
  }

  // Local-only: the ceiling of the Dashboard energy-limit slider, in kWh.
  // Lowering it makes the slider finer for small packs; raising it covers
  // >100 kWh batteries. Stored per-browser, never sent to the device.
  function saveMaxEnergy(v) {
    uisettings_store.update((s) => ({ ...s, max_energy_kwh: clampEnergyMax(v) }))
  }
</script>

<ConfigPage title={$_('config.pages.evse')}>
  <ConfigSection title={$_('config.evse.current')}>
    <FormField
      label={$_('config.evse.maxcurrent')}
      description={`${$config_store?.max_current_soft ?? ''} A`}
      status={$ss.max_current_soft ?? 'idle'}
    >
      <Slider
        min={$config_store?.min_current_hard ?? 6}
        max={$config_store?.max_current_hard ?? 32}
        value={$config_store?.max_current_soft ?? 6}
        onchange={(v) => form.saveField('max_current_soft', v)}
      />
    </FormField>
    <ReadOnlyRow
      label={$_('config.evse.maxcurrent_hard')}
      value={$config_store?.max_current_hard != null
        ? `${$config_store.max_current_hard} A`
        : ''}
    />
    {#if $config_store?.voltage !== undefined}
      <FormField
        label={$_('config.evse.voltage')}
        description={$_('config.evse.voltage_desc')}
        status={$ss.voltage ?? 'idle'}
      >
        <div class="flex items-center gap-2">
          <NumberInput
            value={$config_store?.voltage ? $config_store.voltage / 100 : 0}
            min={60}
            max={300}
            step={0.01}
            revert={form.revert}
            onchange={(v) => form.saveField('voltage', v ? Math.round(v * 100) : 0)}
          />
          <span class="text-sm text-text-dim">V</span>
        </div>
      </FormField>
    {/if}
  </ConfigSection>

  {#if $config_store?.relay_dc1 !== undefined || $config_store?.relay_dc2 !== undefined || $config_store?.relay_ac !== undefined}
    <ConfigSection title={$_('config.evse.relays')}>
      {#if $config_store?.relay_dc1 !== undefined}
        <FormField label={$_('config.evse.relay_dc1')} status={$ss.relay_dc1 ?? 'idle'}>
          <Toggle
            checked={!!$config_store?.relay_dc1}
            label={$_('config.evse.relay_dc1')}
            onchange={(v) => form.saveField('relay_dc1', v)}
          />
        </FormField>
      {/if}
      {#if $config_store?.relay_dc2 !== undefined}
        <FormField label={$_('config.evse.relay_dc2')} status={$ss.relay_dc2 ?? 'idle'}>
          <Toggle
            checked={!!$config_store?.relay_dc2}
            label={$_('config.evse.relay_dc2')}
            onchange={(v) => form.saveField('relay_dc2', v)}
          />
        </FormField>
      {/if}
      {#if $config_store?.relay_ac !== undefined}
        <FormField label={$_('config.evse.relay_ac')} status={$ss.relay_ac ?? 'idle'}>
          <Toggle
            checked={!!$config_store?.relay_ac}
            label={$_('config.evse.relay_ac')}
            onchange={(v) => form.saveField('relay_ac', v)}
          />
        </FormField>
      {/if}
    </ConfigSection>
  {/if}

  <ConfigSection title={$_('config.evse.behaviour')}>
    {#if $config_store?.default_state !== undefined}
      <FormField label={$_('config.evse.defaultstate')} status={$ss.default_state ?? 'idle'}>
        <Select
          options={boolOptions}
          value={String(!!$config_store?.default_state)}
          onchange={(v) => form.saveField('default_state', v === 'true')}
        />
      </FormField>
    {/if}
    {#if $config_store?.is_threephase !== undefined}
      <FormField label={$_('config.evse.threephase')} status={$ss.is_threephase ?? 'idle'}>
        <Select
          options={phaseOptions}
          value={String(!!$config_store?.is_threephase)}
          onchange={(v) => form.saveField('is_threephase', v === 'true')}
        />
      </FormField>
    {/if}
    <FormField label={$_('config.evse.service')} status={$ss.service ?? 'idle'}>
      <Select
        options={serviceOptions}
        value={String($config_store?.service ?? 0)}
        onchange={(v) => form.saveField('service', Number(v))}
      />
    </FormField>
    <FormField label={$_('config.evse.pause_mode')}>
      <Toggle
        checked={!!$config_store?.pause_uses_disabled}
        label={$_('config.evse.pause_mode')}
        onchange={(v) => form.saveField('pause_uses_disabled', v)}
      />
    </FormField>
    {#if $config_store?.pp_auto !== undefined}
      <FormField
        label={$_('config.evse.pp_auto')}
        description={$_('config.evse.pp_auto_desc')}
        status={$ss.pp_auto ?? 'idle'}
      >
        <Toggle
          checked={!!$config_store?.pp_auto}
          label={$_('config.evse.pp_auto')}
          onchange={(v) => form.saveField('pp_auto', v)}
        />
      </FormField>
    {/if}
    {#if $config_store?.button_enabled !== undefined}
      <FormField
        label={$_('config.evse.front_button')}
        description={$_('config.evse.front_button_desc')}
        status={$ss.button_enabled ?? 'idle'}
      >
        <Toggle
          checked={!!$config_store?.button_enabled}
          label={$_('config.evse.front_button')}
          onchange={(v) => form.saveField('button_enabled', v)}
        />
      </FormField>
    {/if}
    <FormField
      label={$_('config.evse.start_window')}
      description={$_('config.evse.start_window_desc')}
      status={$ss.scheduler_start_window ?? 'idle'}
    >
      <NumberInput
        value={$config_store?.scheduler_start_window ?? 0}
        min={0}
        max={3600}
        revert={form.revert}
        onchange={(v) => form.saveField('scheduler_start_window', v)}
      />
    </FormField>
    {#if $config_store?.led_brightness !== undefined}
      <FormField
        label={$_('config.evse.led_brightness')}
        description={`${$config_store?.led_brightness ?? ''}`}
        status={$ss.led_brightness ?? 'idle'}
      >
        <Slider
          min={0}
          max={255}
          value={$config_store?.led_brightness ?? 0}
          onchange={(v) => form.saveField('led_brightness', v)}
        />
      </FormField>
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.evse.system_limit')}>
    <FormField label={$_('config.evse.limit_type')} status={$ss.limit_default_type ?? 'idle'}>
      <Select options={limitTypeOptions} value={sysType} onchange={saveSystemLimitType} />
    </FormField>
    {#if sysType !== 'none'}
      <FormField
        label={$_('config.evse.limit_value')}
        description={sysUnitLabel}
        status={$ss.limit_default_value ?? 'idle'}
      >
        <NumberInput
          value={sysType === 'energy' ? sysValue / 1000 : sysValue}
          min={0}
          max={sysType === 'soc' ? 100 : undefined}
          step={sysType === 'time' ? 5 : sysType === 'range' ? 10 : 1}
          revert={form.revert}
          onchange={saveSystemLimitValue}
        />
      </FormField>
    {/if}
    <FormField
      label={$_('config.evse.energy_slider_max')}
      description={$_('config.evse.energy_slider_max_desc')}
    >
      <NumberInput
        value={$uisettings_store?.max_energy_kwh ?? 100}
        min={1}
        max={ENERGY_LIMIT_MAX_KWH}
        step={1}
        onchange={saveMaxEnergy}
      />
    </FormField>
  </ConfigSection>

  <ConfigSection title={$_('config.evse.sensor')}>
    <FormField label={$_('config.evse.scale')} status={$ss.scale ?? 'idle'}>
      <NumberInput
        value={$config_store?.scale ?? 0}
        revert={form.revert}
        onchange={(v) => form.saveField('scale', v)}
      />
    </FormField>
    <FormField label={$_('config.evse.offset')} status={$ss.offset ?? 'idle'}>
      <NumberInput
        value={$config_store?.offset ?? 0}
        revert={form.revert}
        onchange={(v) => form.saveField('offset', v)}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
