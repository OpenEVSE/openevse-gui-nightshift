<!-- src/routes/settings/Emoncms.svelte -->
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

  let enabled = $derived(!!$config_store?.emoncms_enabled)
  let connected = $derived($status_store?.emoncms_connected === 1)
</script>

<ConfigPage title={$_('config.pages.emoncms')}>
  <ConfigSection>
    <FormField label={$_('config.emoncms.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.emoncms.enable')}
        onchange={(v) => form.saveField('emoncms_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.connected')}
        value={connected ? $_('config.connected') : $_('config.not_connected')}
        tone={connected ? 'ok' : 'error'}
      />
      <ReadOnlyRow
        label={$_('config.emoncms.posts')}
        value={`${$status_store?.packets_success ?? 0} / ${$status_store?.packets_sent ?? 0}`}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.emoncms.account')}>
      <FormField
        label={$_('config.emoncms.server')}
        description={$_('config.emoncms.server_desc')}
        status={$ss.emoncms_server ?? 'idle'}
      >
        <TextInput
          value={$config_store?.emoncms_server ?? ''}
          placeholder="emoncms.org"
          revert={form.revert}
          onchange={(v) => form.saveField('emoncms_server', v)}
        />
      </FormField>
      <FormField label={$_('config.emoncms.node')} status={$ss.emoncms_node ?? 'idle'}>
        <TextInput
          value={$config_store?.emoncms_node ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('emoncms_node', v)}
        />
      </FormField>
      <FormField label={$_('config.emoncms.apikey')} status={$ss.emoncms_apikey ?? 'idle'}>
        <PasswordInput
          value={$config_store?.emoncms_apikey ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('emoncms_apikey', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
