<!-- src/routes/settings/Rfid.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { uistates_store } from '../../lib/stores/uistates.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { parseTags, serializeTags, addTag, removeTag } from '../../lib/config/rfid.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import IconButton from '../../lib/components/ui/IconButton.svelte'

  const form = createConfigForm()

  let enabled = $derived(!!$config_store?.rfid_enabled)
  let tags = $derived(parseTags($config_store?.rfid_storage))
  let scanned = $derived($status_store?.rfid_input ?? '')
  let scanWaiting = $derived($uistates_store?.rfid_waiting ?? 0)
  let alreadyRegistered = $derived(scanned !== '' && tags.includes(scanned))

  async function scan() {
    const res = await serialQueue.add(() => httpAPI('GET', '/rfid/add', null, 'txt', 60000))
    if (!res || res === 'error') showWriteError()
  }
  function saveTags(next) {
    return form.saveField('rfid_storage', serializeTags(next))
  }
  function register() {
    if (scanned) saveTags(addTag(tags, scanned))
  }
  function remove(tag) {
    saveTags(removeTag(tags, tag))
  }
  function removeAll() {
    saveTags([])
  }
</script>

<ConfigPage title={$_('config.pages.rfid')}>
  <ConfigSection>
    <FormField label={$_('config.rfid.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.rfid.enable')}
        onchange={(v) => form.saveField('rfid_enabled', v)}
      />
    </FormField>
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.rfid.manage')}>
      <div class="flex flex-col items-center gap-2 py-2">
        <Button
          label={scanWaiting > 0 ? String(scanWaiting) : $_('config.rfid.scan')}
          variant="ghost"
          disabled={scanWaiting > 0}
          onclick={scan}
        />
        {#if scanWaiting > 0}
          <p class="text-xs text-text-dim">{$_('config.rfid.place_tag')}</p>
        {:else if scanned}
          <p class="text-sm text-text">{$_('config.rfid.uid')}: <span class="font-mono">{scanned}</span></p>
          {#if alreadyRegistered}
            <p class="text-xs text-text-dim">{$_('config.rfid.already')}</p>
          {:else}
            <Button label={$_('config.rfid.register')} onclick={register} />
          {/if}
        {/if}
      </div>
    </ConfigSection>

    {#if tags.length > 0}
      <ConfigSection title={$_('config.rfid.registered')}>
        {#each tags as tag}
          <div class="flex items-center justify-between py-2 text-sm">
            <span class="font-mono text-text">{tag}</span>
            <IconButton icon="mdi:trash-can-outline" label={$_('config.rfid.remove')} onclick={() => remove(tag)} />
          </div>
        {/each}
        <div class="mt-2">
          <Button label={$_('config.rfid.remove_all')} variant="ghost" onclick={removeAll} />
        </div>
      </ConfigSection>
    {/if}
  {/if}
</ConfigPage>
