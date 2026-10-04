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
  import { dataAgeTone, formatDataAge, POWER_FIELDS, VOLTAGE_FIELDS } from '../../lib/config/shellyLnm.js'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.shelly_lnm_enabled)
  let age = $derived($status_store?.shelly_lnm_data_age)
  let listening = $derived(!!$status_store?.shelly_lnm_listening)

  const powerOptions = POWER_FIELDS.map((v) => ({ value: v, label: v }))
  const voltageOptions = VOLTAGE_FIELDS.map((v) => ({ value: v, label: v }))
</script>

<ConfigPage title={$_('config.pages.shellylnm')}>
  <p class="mb-4 text-sm text-text-dim">{$_('config.shellylnm.desc')}</p>

  <ConfigSection>
    <FormField label={$_('config.shellylnm.enable')} status={$ss.shelly_lnm_enabled ?? 'idle'}>
      <Toggle
        checked={enabled}
        label={$_('config.shellylnm.enable')}
        onchange={(v) => form.saveField('shelly_lnm_enabled', v)}
      />
    </FormField>
  </ConfigSection>

  {#if enabled}
    <ConfigSection>
      <ReadOnlyRow
        label={listening ? $_('config.shellylnm.listening') : $_('config.shellylnm.notlistening')}
        value={listening ? '✓' : '✗'}
        tone={listening ? 'ok' : 'error'}
      />
      <ReadOnlyRow
        label={$_('config.shellylnm.lastupdated')}
        value={formatDataAge(age)}
        tone={dataAgeTone(age)}
      />
      {#if $status_store?.shelly_lnm_power !== undefined}
        <ReadOnlyRow label={$_('config.shellylnm.power')} value={`${Math.round($status_store.shelly_lnm_power)} W`} />
      {/if}
      {#if $status_store?.shelly_lnm_voltage !== undefined}
        <ReadOnlyRow label={$_('config.shellylnm.voltage')} value={`${Number($status_store.shelly_lnm_voltage).toFixed(1)} V`} />
      {/if}
    </ConfigSection>

    <ConfigSection>
      <FormField
        label={$_('config.shellylnm.addr')}
        description={$_('config.shellylnm.addr-desc')}
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
        description={$_('config.shellylnm.port-desc')}
        status={$ss.shelly_lnm_port ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.shelly_lnm_port ?? null}
          min={1}
          max={65535}
          placeholder="5555"
          revert={form.revert}
          onchange={(v) => form.saveField('shelly_lnm_port', v)}
        />
      </FormField>
      <FormField
        label={$_('config.shellylnm.powerfield')}
        description={$_('config.shellylnm.powerfield-desc')}
        status={$ss.shelly_lnm_power_field ?? 'idle'}
      >
        <Select
          options={powerOptions}
          value={$config_store?.shelly_lnm_power_field || 'act_power'}
          onchange={(v) => form.saveField('shelly_lnm_power_field', v)}
        />
      </FormField>
      <FormField
        label={$_('config.shellylnm.voltagefield')}
        description={$_('config.shellylnm.voltagefield-desc')}
        status={$ss.shelly_lnm_voltage_field ?? 'idle'}
      >
        <Select
          options={voltageOptions}
          value={$config_store?.shelly_lnm_voltage_field || 'voltage'}
          onchange={(v) => form.saveField('shelly_lnm_voltage_field', v)}
        />
      </FormField>
    </ConfigSection>

    <ConfigSection>
      <p class="py-2 text-xs text-text-dim">{$_('config.shellylnm.help-note')}</p>
    </ConfigSection>
  {/if}
</ConfigPage>
