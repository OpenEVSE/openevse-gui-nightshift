<!-- src/routes/settings/Network.svelte -->
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

  const form = createConfigForm()
  const ss = form.saveState

  let connected = $derived(
    !!($status_store?.wifi_client_connected || $status_store?.eth_connected === 1),
  )
</script>

<ConfigPage title={$_('config.pages.network')}>
  <ConfigSection title={$_('config.network.status')}>
    <ReadOnlyRow label={$_('config.network.mode')} value={$status_store?.mode} />
    <ReadOnlyRow label={$_('config.network.ip')} value={$status_store?.ipaddress} />
    {#if $status_store?.macaddress}
      <ReadOnlyRow label={$_('config.network.mac')} value={$status_store.macaddress} />
    {/if}
    <ReadOnlyRow
      label={$_('config.network.connected')}
      value={connected ? $_('config.connected') : $_('config.not_connected')}
      tone={connected ? 'ok' : 'error'}
    />
    {#if $config_store?.ssid}
      <ReadOnlyRow label={$_('config.network.ssid')} value={$config_store.ssid} />
      <ReadOnlyRow label={$_('config.network.signal')} value={$status_store?.srssi} />
    {/if}
  </ConfigSection>

  <ConfigSection>
    <FormField label={$_('config.network.host')} status={$ss.hostname ?? 'idle'}>
      <TextInput
        value={$config_store?.hostname ?? ''}
        placeholder="openevse"
        revert={form.revert}
        onchange={(v) => form.saveField('hostname', v)}
      />
    </FormField>
  </ConfigSection>

  {#if $config_store?.wizard_passed}
    <ConfigSection title={$_('config.network.ap')}>
      <p class="mb-1 text-xs text-text-dim">{$_('config.network.apdefault')}</p>
      <FormField label={$_('config.network.apssid')} status={$ss.ap_ssid ?? 'idle'}>
        <TextInput
          value={$config_store?.ap_ssid ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('ap_ssid', v)}
        />
      </FormField>
      <FormField label={$_('config.network.appass')} status={$ss.ap_pass ?? 'idle'}>
        <PasswordInput
          value={$config_store?.ap_pass ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('ap_pass', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
