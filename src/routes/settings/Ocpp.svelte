<!-- src/routes/settings/Ocpp.svelte -->
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
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.ocpp_enabled)
  let autoAuth = $derived(!!$config_store?.ocpp_auth_auto)
</script>

<ConfigPage title={$_('config.pages.ocpp')}>
  <ConfigSection>
    <FormField label={$_('config.ocpp.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.ocpp.enable')}
        onchange={(v) => form.saveField('ocpp_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.connected')}
        value={$status_store?.ocpp_connected ? $_('config.connected') : $_('config.not_connected')}
        tone={$status_store?.ocpp_connected ? 'ok' : 'error'}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.ocpp.server_section')}>
      <FormField label={$_('config.ocpp.server')} status={$ss.ocpp_server ?? 'idle'}>
        <TextInput
          value={$config_store?.ocpp_server ?? ''}
          placeholder="wss://domain/steve/websocket/CentralSystemService"
          revert={form.revert}
          onchange={(v) => form.saveField('ocpp_server', v)}
        />
      </FormField>
      <FormField label={$_('config.ocpp.chargeboxid')} status={$ss.ocpp_chargeBoxId ?? 'idle'}>
        <TextInput
          value={$config_store?.ocpp_chargeBoxId ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('ocpp_chargeBoxId', v)}
        />
      </FormField>
      <FormField label={$_('config.ocpp.authkey')} status={$ss.ocpp_authkey ?? 'idle'}>
        <PasswordInput
          value={$config_store?.ocpp_authkey ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('ocpp_authkey', v)}
        />
      </FormField>
    </ConfigSection>

    <ConfigSection title={$_('config.ocpp.auth')}>
      <FormField label={$_('config.ocpp.auth_auto')}>
        <Toggle
          checked={autoAuth}
          label={$_('config.ocpp.auth_auto')}
          onchange={(v) => form.saveField('ocpp_auth_auto', v)}
        />
      </FormField>
      {#if autoAuth}
        <FormField label={$_('config.ocpp.idtag')} status={$ss.ocpp_idtag ?? 'idle'}>
          <TextInput
            value={$config_store?.ocpp_idtag ?? ''}
            placeholder="F4D1A7694ECD21"
            revert={form.revert}
            onchange={(v) => form.saveField('ocpp_idtag', v)}
          />
        </FormField>
      {/if}
      <FormField label={$_('config.ocpp.auth_offline')}>
        <Toggle
          checked={!!$config_store?.ocpp_auth_offline}
          label={$_('config.ocpp.auth_offline')}
          onchange={(v) => form.saveField('ocpp_auth_offline', v)}
        />
      </FormField>
    </ConfigSection>

    <ConfigSection title={$_('config.ocpp.controls')}>
      <FormField label={$_('config.ocpp.suspend_evse')}>
        <Toggle
          checked={!!$config_store?.ocpp_suspend_evse}
          label={$_('config.ocpp.suspend_evse')}
          onchange={(v) => form.saveField('ocpp_suspend_evse', v)}
        />
      </FormField>
      <FormField label={$_('config.ocpp.energize_plug')}>
        <Toggle
          checked={!!$config_store?.ocpp_energize_plug}
          label={$_('config.ocpp.energize_plug')}
          onchange={(v) => form.saveField('ocpp_energize_plug', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
