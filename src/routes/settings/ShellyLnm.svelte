<!-- src/routes/settings/ShellyLnm.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  // The firmware reports UINT32_MAX until the first power packet arrives.
  const NO_DATA = 4294967295

  const powerFields = [
    ['act_power', 'field_single'], ['total_act_power', 'field_total'],
    ['a_act_power', 'field_phase_a'], ['b_act_power', 'field_phase_b'], ['c_act_power', 'field_phase_c'],
  ]
  const voltageFields = [
    ['voltage', 'field_single'],
    ['a_voltage', 'field_phase_a'], ['b_voltage', 'field_phase_b'], ['c_voltage', 'field_phase_c'],
  ]
  const options = (fields) => fields.map(([value, key]) => ({ value, label: `${value} — ${$_('config.shellylnm.' + key)}` }))
  let powerOptions = $derived(options(powerFields))
  let voltageOptions = $derived(options(voltageFields))

  let enabled = $derived(!!$config_store?.shelly_lnm_enabled)
  let listening = $derived($status_store?.shelly_lnm_listening === 1)
  let age = $derived($status_store?.shelly_lnm_data_age)
  let hasData = $derived(age !== undefined && age !== null && age !== NO_DATA)
  let ageTone = $derived(!hasData ? 'error' : age <= 5000 ? 'ok' : age > 10000 ? 'error' : 'warn')
  let power = $derived($status_store?.shelly_lnm_power)
  let voltage = $derived($status_store?.shelly_lnm_voltage)
</script>

<ConfigPage title={$_('config.pages.shellylnm')}>
  <ConfigSection title={$_('config.shellylnm.title')}>
    <FormField label={$_('config.shellylnm.enable')} description={$_('config.shellylnm.desc')}>
      <Toggle
        checked={enabled}
        label={$_('config.shellylnm.enable')}
        onchange={(v) => form.saveField('shelly_lnm_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.shellylnm.state')}
        value={listening ? $_('config.shellylnm.listening') : $_('config.shellylnm.not_listening')}
        tone={listening ? 'ok' : 'error'}
      />
      <ReadOnlyRow
        label={$_('config.shellylnm.last_update')}
        value={hasData ? `${age} ms` : '—'}
        tone={ageTone}
      />
      <ReadOnlyRow
        label={$_('config.shellylnm.power')}
        value={typeof power === 'number' ? `${Math.round(power)} W` : '—'}
      />
      <ReadOnlyRow
        label={$_('config.shellylnm.voltage')}
        value={typeof voltage === 'number' ? `${voltage.toFixed(1)} V` : '—'}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.shellylnm.settings')}>
      <FormField
        label={$_('config.shellylnm.addr')}
        description={$_('config.shellylnm.addr_desc')}
        status={$ss.shelly_lnm_addr ?? 'idle'}
      >
        <TextInput
          value={$config_store?.shelly_lnm_addr ?? ''}
          placeholder="239.255.55.55"
          revert={form.revert}
          onchange={(v) => form.saveField('shelly_lnm_addr', v)}
        />
      </FormField>
      <FormField
        label={$_('config.shellylnm.port')}
        description={$_('config.shellylnm.port_desc')}
        status={$ss.shelly_lnm_port ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.shelly_lnm_port ?? null}
          min={1024}
          max={65535}
          placeholder="5555"
          revert={form.revert}
          onchange={(v) => form.saveField('shelly_lnm_port', v)}
        />
      </FormField>
      <FormField
        label={$_('config.shellylnm.power_field')}
        description={$_('config.shellylnm.power_field_desc')}
        status={$ss.shelly_lnm_power_field ?? 'idle'}
      >
        <Select
          options={powerOptions}
          value={$config_store?.shelly_lnm_power_field ?? 'act_power'}
          onchange={(v) => form.saveField('shelly_lnm_power_field', v)}
        />
      </FormField>
      <FormField
        label={$_('config.shellylnm.voltage_field')}
        description={$_('config.shellylnm.voltage_field_desc')}
        status={$ss.shelly_lnm_voltage_field ?? 'idle'}
      >
        <Select
          options={voltageOptions}
          value={$config_store?.shelly_lnm_voltage_field ?? 'voltage'}
          onchange={(v) => form.saveField('shelly_lnm_voltage_field', v)}
        />
      </FormField>
      <FormField
        label={$_('config.shellylnm.device')}
        description={$_('config.shellylnm.device_desc')}
        status={$ss.shelly_lnm_device ?? 'idle'}
      >
        <TextInput
          value={$config_store?.shelly_lnm_device ?? ''}
          placeholder="shellypro3em-8813bfe1ab68"
          revert={form.revert}
          onchange={(v) => form.saveField('shelly_lnm_device', v)}
        />
      </FormField>
    </ConfigSection>

    <ConfigSection title={$_('config.shellylnm.setup')}>
      <p class="mb-2 text-sm text-text-dim">{$_('config.shellylnm.setup_desc')}</p>
      <p class="text-xs text-text-dim">{$_('config.shellylnm.sign_note')}</p>
    </ConfigSection>
  {/if}
</ConfigPage>
