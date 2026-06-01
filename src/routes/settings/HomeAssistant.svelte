<!-- src/routes/settings/HomeAssistant.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import { isHaConnected, startHaAuth, fetchHaStatus, disconnectHa } from '../../lib/config/homeassistant.js'

  const form = createConfigForm()
  const ss = form.saveState

  let url = $derived($config_store?.ha_url ?? '')
  let status = $state(null)
  let connecting = $state(false)

  let connected = $derived(isHaConnected(status))

  onMount(async () => {
    status = await fetchHaStatus()
  })

  async function onConnect() {
    connecting = true
    await form.saveField('ha_url', url)
    startHaAuth()
    connecting = false
  }

  async function onDisconnect() {
    await disconnectHa()
    status = await fetchHaStatus()
  }
</script>

<ConfigPage title={$_('config.pages.home_assistant')}>
  <ConfigSection>
    <ReadOnlyRow
      label={$_('config.connected')}
      value={connected ? $_('config.homeassistant.connected') : $_('config.homeassistant.disconnected')}
      tone={connected ? 'ok' : 'error'}
    />
  </ConfigSection>

  <ConfigSection title={$_('config.homeassistant.title')}>
    <FormField label={$_('config.homeassistant.url')} status={$ss.ha_url ?? 'idle'}>
      <TextInput
        value={url}
        placeholder="http://homeassistant.local:8123"
        revert={form.revert}
        onchange={(v) => form.saveField('ha_url', v)}
      />
    </FormField>

    <div class="flex gap-3 py-3">
      {#if connected}
        <Button variant="ghost" onclick={onDisconnect}>
          {$_('config.homeassistant.disconnect')}
        </Button>
      {:else}
        <Button disabled={!url || connecting} onclick={onConnect}>
          {$_('config.homeassistant.connect')}
        </Button>
      {/if}
    </div>
  </ConfigSection>
</ConfigPage>
