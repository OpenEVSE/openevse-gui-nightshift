<!-- src/routes/settings/Ohmconnect.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.ohm_enabled)
</script>

<ConfigPage title={$_('config.pages.ohmconnect')}>
  <ConfigSection>
    <FormField label={$_('config.ohmconnect.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.ohmconnect.enable')}
        onchange={(v) => form.saveField('ohm_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.ohmconnect.hour')}
        value={$status_store?.ohm_hour}
        tone={$status_store?.ohm_hour === 'NotConnected' ? 'error' : 'ok'}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection>
      <FormField
        label={$_('config.ohmconnect.key')}
        description={$_('config.ohmconnect.key_desc')}
        status={$ss.ohm ?? 'idle'}
      >
        <PasswordInput
          value={$config_store?.ohm ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('ohm', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
