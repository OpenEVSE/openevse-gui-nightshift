<!-- src/routes/settings/Rfid.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { uistates_store } from '../../lib/stores/uistates.js'
  import { uisettings_store } from '../../lib/stores/uisettings.js'
  import { rfid_users_store } from '../../lib/stores/rfid_users.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { parseTags, serializeTags, addTag, removeTag } from '../../lib/config/rfid.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import IconButton from '../../lib/components/ui/IconButton.svelte'
  import RfidUserModal from '../../lib/components/config/RfidUserModal.svelte'

  const form = createConfigForm()

  // Reader present on the I2C bus, reported independent of RFID being enabled.
  let readerPresent = $derived($status_store?.rfid_reader)
  let tags = $derived(parseTags($config_store?.rfid_storage))
  let scanned = $derived($status_store?.rfid_input ?? '')
  let scanWaiting = $derived($uistates_store?.rfid_waiting ?? 0)
  let alreadyRegistered = $derived(scanned !== '' && tags.includes(scanned))

  let labsOn = $derived(!!$uisettings_store?.dev_features)
  let editingUid = $state(null)
  let editingInitial = $state('')
  let editBusy = $state(false)

  // Pull the user-name map when Labs is on. The endpoint is firmware-side dev
  // work — the store flips error=true if missing.
  onMount(() => {
    if (labsOn) rfid_users_store.download()
  })

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

  function openNameEditor(uid) {
    editingUid = uid
    editingInitial = $rfid_users_store.users[uid] ?? ''
  }
  function closeNameEditor() {
    if (editBusy) return
    editingUid = null
    editingInitial = ''
  }
  async function saveName(name) {
    if (!editingUid) return
    editBusy = true
    const ok = await rfid_users_store.save(editingUid, name)
    editBusy = false
    if (ok) closeNameEditor()
    else showWriteError()
  }
  async function removeName() {
    if (!editingUid) return
    editBusy = true
    const ok = await rfid_users_store.remove(editingUid)
    editBusy = false
    if (ok) closeNameEditor()
    else showWriteError()
  }
</script>

<ConfigPage title={$_('config.pages.rfid')}>
  <!-- Reader status badge + Charge Manager link (enable lives in Charge Manager) -->
  <div class="mb-4 flex flex-wrap items-center gap-3">
    <a
      href="#/schedule"
      class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5
             text-sm font-semibold text-white transition hover:opacity-90"
    >
      + {$_('config.add_in_charge_manager')}
    </a>
    {#if readerPresent !== undefined}
      {#if readerPresent}
        <span class="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
          <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
          {$_('config.rfid.reader_found')}
        </span>
      {:else}
        <span class="inline-flex items-center gap-1 rounded-full bg-error/15 px-2.5 py-0.5 text-xs font-semibold text-error">
          <span class="h-1.5 w-1.5 rounded-full bg-error"></span>
          {$_('config.rfid.no_reader')}
        </span>
      {/if}
    {/if}
  </div>

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
          <div class="flex items-center gap-2 py-2 text-sm">
            <div class="min-w-0 flex-1">
              <div class="truncate font-mono text-text">{tag}</div>
              {#if labsOn}
                {@const userName = $rfid_users_store.users[tag]}
                {#if userName}
                  <div class="mt-0.5 truncate text-xs text-accent">{userName}</div>
                {:else}
                  <button
                    type="button"
                    class="mt-0.5 text-xs text-text-dim hover:text-accent"
                    onclick={() => openNameEditor(tag)}
                  >
                    {$_('config.rfid.add_user_name')}
                  </button>
                {/if}
              {/if}
            </div>
            {#if labsOn && $rfid_users_store.users[tag]}
              <IconButton
                icon="mdi:pencil-outline"
                label={$_('config.rfid.edit_user_name')}
                onclick={() => openNameEditor(tag)}
              />
            {/if}
            <IconButton icon="mdi:trash-can-outline" label={$_('config.rfid.remove')} onclick={() => remove(tag)} />
          </div>
        {/each}
        <div class="mt-2">
          <Button label={$_('config.rfid.remove_all')} variant="ghost" onclick={removeAll} />
        </div>
      </ConfigSection>
    {/if}
</ConfigPage>

{#if labsOn}
  <RfidUserModal
    open={editingUid !== null}
    uid={editingUid ?? ''}
    initialName={editingInitial}
    canRemove={editingUid !== null && !!$rfid_users_store.users[editingUid]}
    busy={editBusy}
    onclose={closeNameEditor}
    onsave={saveName}
    onremove={removeName}
  />
{/if}
