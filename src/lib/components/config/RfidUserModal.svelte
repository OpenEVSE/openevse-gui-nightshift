<!-- src/lib/components/config/RfidUserModal.svelte -->
<script>
  import { untrack } from 'svelte'
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Button from '../ui/Button.svelte'

  let {
    open = false,
    uid = '',
    initialName = '',
    canRemove = false,
    busy = false,
    onclose = () => {},
    onsave = (_name) => {},
    onremove = () => {},
  } = $props()

  let name = $state(untrack(() => initialName))

  // Resync the draft when the modal is opened against a different tag.
  $effect(() => {
    if (open) name = initialName
  })

  let canSave = $derived(name.trim() !== '')
</script>

<Modal visible={open} closable={!busy} {onclose}>
  <div class="p-4">
    <h2 class="mb-1 text-base font-semibold text-text">
      {$_('config.rfid.user_name_for')}
    </h2>
    <p class="mb-3 font-mono text-xs text-text-dim">{uid}</p>

    <label class="mb-1 block text-sm text-text" for="rfid-user-name">
      {$_('config.rfid.user_name')}
    </label>
    <input
      id="rfid-user-name"
      aria-label={$_('config.rfid.user_name')}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
      maxlength="32"
      placeholder={$_('config.rfid.user_name_placeholder')}
      class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
             placeholder:text-text-dim focus:border-accent focus:outline-none"
    />

    <div class="mt-4 flex gap-2">
      <Button
        label={$_('config.rfid.save_name')}
        disabled={!canSave || busy}
        onclick={() => onsave(name.trim())}
      />
      <Button label={$_('config.rfid.cancel')} variant="ghost" disabled={busy} onclick={onclose} />
    </div>

    {#if canRemove}
      <button
        type="button"
        class="mt-3 w-full rounded-2xl border border-border px-4 py-2 text-sm font-semibold
               text-error transition disabled:cursor-not-allowed disabled:opacity-40
               hover:not-disabled:bg-error/10"
        disabled={busy}
        onclick={onremove}
      >
        {$_('config.rfid.remove_name')}
      </button>
    {/if}
  </div>
</Modal>
