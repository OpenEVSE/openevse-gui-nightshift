<!-- src/routes/settings/Vehicle.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let src = $derived(Number($config_store?.vehicle_data_src ?? 0))

  let srcOptions = $derived([
    { value: '0', label: $_('config.vehicle.src_none') },
    { value: '1', label: $_('config.vehicle.src_tesla') },
    { value: '2', label: $_('config.vehicle.src_mqtt') },
    { value: '3', label: $_('config.vehicle.src_http') },
  ])
  let unitOptions = $derived([
    { value: 'false', label: $_('config.vehicle.km') },
    { value: 'true', label: $_('config.vehicle.miles') },
  ])
</script>

<ConfigPage title={$_('config.pages.vehicle')}>
  <ConfigSection>
    <FormField label={$_('config.vehicle.source')} status={$ss.vehicle_data_src ?? 'idle'}>
      <Select
        options={srcOptions}
        value={String(src)}
        onchange={(v) => form.saveField('vehicle_data_src', Number(v))}
      />
    </FormField>
  </ConfigSection>

  {#if src === 1}
    <ConfigSection title={$_('config.vehicle.src_tesla')}>
      <p class="mb-1 text-xs text-text-dim">{$_('config.vehicle.tesla_note')}</p>
      <FormField label={$_('config.vehicle.range_unit')} status={$ss.mqtt_vehicle_range_miles ?? 'idle'}>
        <Select
          options={unitOptions}
          value={String(!!$config_store?.mqtt_vehicle_range_miles)}
          onchange={(v) => form.saveField('mqtt_vehicle_range_miles', v === 'true')}
        />
      </FormField>
      <FormField label={$_('config.vehicle.access_token')} status={$ss.tesla_access_token ?? 'idle'}>
        <PasswordInput
          value={$config_store?.tesla_access_token ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('tesla_access_token', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.refresh_token')} status={$ss.tesla_refresh_token ?? 'idle'}>
        <PasswordInput
          value={$config_store?.tesla_refresh_token ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('tesla_refresh_token', v)}
        />
      </FormField>
    </ConfigSection>
  {:else if src === 2}
    <ConfigSection title={$_('config.vehicle.src_mqtt')}>
      <FormField label={$_('config.vehicle.range_unit')} status={$ss.mqtt_vehicle_range_miles ?? 'idle'}>
        <Select
          options={unitOptions}
          value={String(!!$config_store?.mqtt_vehicle_range_miles)}
          onchange={(v) => form.saveField('mqtt_vehicle_range_miles', v === 'true')}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_soc')} status={$ss.mqtt_vehicle_soc ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_soc ?? ''}
          placeholder="topic/soc"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_soc', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_range')} status={$ss.mqtt_vehicle_range ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_range ?? ''}
          placeholder="topic/range"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_range', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_eta')} status={$ss.mqtt_vehicle_eta ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_eta ?? ''}
          placeholder="topic/timeleft"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_eta', v)}
        />
      </FormField>
    </ConfigSection>
  {:else if src === 3}
    <ConfigSection title={$_('config.vehicle.src_http')}>
      <p class="text-sm text-text-dim">{$_('config.vehicle.http_info')}</p>
      <pre class="mt-2 rounded-xl bg-surface-2 p-3 text-xs text-text-dim">POST http://&lt;charger-ip&gt;/status
&#123; "battery_level": int, "battery_range": int, "time_to_full_charge": int &#125;</pre>
    </ConfigSection>
  {/if}
</ConfigPage>
