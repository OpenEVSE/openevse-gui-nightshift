<!-- src/routes/settings/Evse.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
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
  </ConfigSection>

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
