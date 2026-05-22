<!-- src/routes/settings/Mqtt.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.mqtt_enabled)
  let isTls = $derived($config_store?.mqtt_protocol === 'mqtts')
  let protocolOptions = $derived(
    ($config_store?.mqtt_supported_protocols ?? []).map((p) => ({ value: p, label: p })),
  )
  let certOptions = $derived([
    { value: '', label: $_('config.mqtt.cert_none') },
    ...($certificate_store ?? [])
      .filter((c) => c.type === 'client')
      .map((c) => ({ value: String(c.id), label: c.name })),
  ])
</script>

<ConfigPage title={$_('config.pages.mqtt')}>
  <ConfigSection>
    <FormField label={$_('config.mqtt.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.mqtt.enable')}
        onchange={(v) => form.saveField('mqtt_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.connected')}
        value={$status_store?.mqtt_connected ? $_('config.connected') : $_('config.not_connected')}
        tone={$status_store?.mqtt_connected ? 'ok' : 'error'}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.mqtt.broker')}>
      <FormField label={$_('config.mqtt.protocol')} status={$ss.mqtt_protocol ?? 'idle'}>
        <Select
          options={protocolOptions}
          value={$config_store?.mqtt_protocol ?? ''}
          onchange={(v) => form.saveField('mqtt_protocol', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.server')} status={$ss.mqtt_server ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_server ?? ''}
          placeholder="server IP / hostname"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_server', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.port')} status={$ss.mqtt_port ?? 'idle'}>
        <NumberInput
          value={$config_store?.mqtt_port ?? null}
          placeholder="1883"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_port', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.user')} status={$ss.mqtt_user ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_user ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_user', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.password')} status={$ss.mqtt_pass ?? 'idle'}>
        <PasswordInput
          value={$config_store?.mqtt_pass ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_pass', v)}
        />
      </FormField>
    </ConfigSection>

    {#if isTls}
      <ConfigSection title={$_('config.mqtt.tls')}>
        <FormField label={$_('config.mqtt.reject_unauthorized')}>
          <Toggle
            checked={!!$config_store?.mqtt_reject_unauthorized}
            label={$_('config.mqtt.reject_unauthorized')}
            onchange={(v) => form.saveField('mqtt_reject_unauthorized', v)}
          />
        </FormField>
        <FormField label={$_('config.mqtt.certificate')} status={$ss.mqtt_certificate_id ?? 'idle'}>
          <Select
            options={certOptions}
            value={String($config_store?.mqtt_certificate_id ?? '')}
            onchange={(v) => form.saveField('mqtt_certificate_id', v)}
          />
        </FormField>
      </ConfigSection>
    {/if}

    <ConfigSection title={$_('config.mqtt.topics')}>
      <FormField
        label={$_('config.mqtt.topic')}
        description={$_('config.mqtt.topic_desc')}
        status={$ss.mqtt_topic ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_topic ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_topic', v)}
        />
      </FormField>
      <FormField
        label={$_('config.mqtt.announce')}
        description={$_('config.mqtt.announce_desc')}
        status={$ss.mqtt_announce_topic ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_announce_topic ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_announce_topic', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.retained')}>
        <Toggle
          checked={!!$config_store?.mqtt_retained}
          label={$_('config.mqtt.retained')}
          onchange={(v) => form.saveField('mqtt_retained', v)}
        />
      </FormField>
      <FormField
        label={$_('config.mqtt.vrms')}
        description={$_('config.mqtt.vrms_desc')}
        status={$ss.mqtt_vrms ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_vrms ?? ''}
          placeholder="topic/voltage"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vrms', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
