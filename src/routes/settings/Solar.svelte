<!-- src/routes/settings/Solar.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { matchPreset, presetValues } from '../../lib/config/divert.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import SegmentedControl from '../../lib/components/ui/SegmentedControl.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.divert_enabled)
  let divertType = $derived(Number($config_store?.divert_type ?? 0))
  let activePreset = $derived(matchPreset($config_store))

  let typeOptions = $derived([
    { value: '0', label: $_('config.solar.type_production') },
    { value: '1', label: $_('config.solar.type_excess') },
  ])
  let presetOptions = $derived([
    { value: 'default', label: $_('config.solar.preset_default') },
    { value: 'no_waste', label: $_('config.solar.preset_no_waste') },
    { value: 'no_import', label: $_('config.solar.preset_no_import') },
    { value: 'custom', label: $_('config.solar.preset_custom') },
  ])

  function applyPreset(id) {
    const values = presetValues(id)
    if (values) form.saveFields(values)
  }
</script>

<ConfigPage title={$_('config.pages.solar')}>
  <ConfigSection>
    <FormField label={$_('config.solar.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.solar.enable')}
        onchange={(v) => form.saveField('divert_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={divertType === 1 ? $_('config.solar.grid') : $_('config.solar.production')}
        value={`${divertType === 1 ? ($status_store?.grid_ie ?? 0) : ($status_store?.solar ?? 0)} W`}
      />
      <ReadOnlyRow label={$_('config.solar.charge_rate')} value={`${$status_store?.charge_rate ?? 0} A`} />
      {#if $status_store?.divert_active}
        <ReadOnlyRow
          label={$_('config.solar.smoothed')}
          value={`${$status_store?.smoothed_available_current ?? 0} A`}
        />
      {/if}
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.solar.mode')}>
      <FormField label={$_('config.solar.default_mode')} description={$_('config.solar.default_mode_desc')}>
        <Toggle
          checked={$config_store?.charge_mode === 'eco'}
          label={$_('config.solar.default_mode')}
          onchange={(v) => form.saveField('charge_mode', v ? 'eco' : 'fast')}
        />
      </FormField>
      <FormField label={$_('config.solar.source')} status={$ss.divert_type ?? 'idle'}>
        <Select
          options={typeOptions}
          value={String(divertType)}
          onchange={(v) => form.saveField('divert_type', Number(v))}
        />
      </FormField>
      {#if divertType === 0}
        <FormField
          label={$_('config.solar.feed_production')}
          description={$_('config.solar.feed_production_desc')}
          status={$ss.mqtt_solar ?? 'idle'}
        >
          <TextInput
            value={$config_store?.mqtt_solar ?? ''}
            placeholder="topic/pv_production"
            revert={form.revert}
            onchange={(v) => form.saveField('mqtt_solar', v)}
          />
        </FormField>
      {:else}
        <FormField
          label={$_('config.solar.feed_grid')}
          description={$_('config.solar.feed_grid_desc')}
          status={$ss.mqtt_grid_ie ?? 'idle'}
        >
          <TextInput
            value={$config_store?.mqtt_grid_ie ?? ''}
            placeholder="topic/grid_ie"
            revert={form.revert}
            onchange={(v) => form.saveField('mqtt_grid_ie', v)}
          />
        </FormField>
      {/if}
    </ConfigSection>

    <ConfigSection title={$_('config.solar.tuning')}>
      <FormField
        label={$_('config.solar.preset')}
        description={$_('config.solar.preset_' + activePreset + '_desc')}
      >
        <SegmentedControl
          options={presetOptions}
          value={activePreset}
          onchange={applyPreset}
        />
      </FormField>
      <FormField
        label={$_('config.solar.ratio')}
        description={$_('config.solar.ratio_desc')}
        status={$ss.divert_PV_ratio ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.divert_PV_ratio ?? null}
          step={0.01}
          placeholder="1.1"
          revert={form.revert}
          onchange={(v) => form.saveField('divert_PV_ratio', v)}
        />
      </FormField>
      <FormField
        label={$_('config.solar.min_charge')}
        description={$_('config.solar.min_charge_desc')}
        status={$ss.divert_min_charge_time ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.divert_min_charge_time ?? null}
          min={0}
          placeholder="600"
          revert={form.revert}
          onchange={(v) => form.saveField('divert_min_charge_time', v)}
        />
      </FormField>
      <FormField
        label={$_('config.solar.attack')}
        description={$_('config.solar.attack_desc')}
        status={$ss.divert_attack_smoothing_time ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.divert_attack_smoothing_time ?? null}
          min={0}
          max={600}
          revert={form.revert}
          onchange={(v) => form.saveField('divert_attack_smoothing_time', v)}
        />
      </FormField>
      <FormField
        label={$_('config.solar.decay')}
        description={$_('config.solar.decay_desc')}
        status={$ss.divert_decay_smoothing_time ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.divert_decay_smoothing_time ?? null}
          min={0}
          max={600}
          revert={form.revert}
          onchange={(v) => form.saveField('divert_decay_smoothing_time', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}

  <ConfigSection title={$_('config.solar.home_battery')}>
    <FormField label={$_('config.solar.battery_soc_topic')} status={$ss.mqtt_home_battery_soc ?? 'idle'}>
      <TextInput
        value={$config_store?.mqtt_home_battery_soc ?? ''}
        placeholder="topic/home_battery_soc"
        revert={form.revert}
        onchange={(v) => form.saveField('mqtt_home_battery_soc', v)}
      />
    </FormField>
    <FormField label={$_('config.solar.battery_power_topic')} status={$ss.mqtt_home_battery_power ?? 'idle'}>
      <TextInput
        value={$config_store?.mqtt_home_battery_power ?? ''}
        placeholder="topic/home_battery_power"
        revert={form.revert}
        onchange={(v) => form.saveField('mqtt_home_battery_power', v)}
      />
    </FormField>
    {#if $status_store?.home_battery_soc !== undefined && $status_store?.home_battery_soc !== null}
      <ReadOnlyRow label={$_('config.solar.battery_soc')} value={`${$status_store?.home_battery_soc ?? 0} %`} />
      <ReadOnlyRow label={$_('config.solar.battery_power')} value={`${$status_store?.home_battery_power ?? 0} W`} />
    {/if}
  </ConfigSection>
</ConfigPage>
