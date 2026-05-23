<!--
  src/lib/components/wizard/FinishDialog.svelte

  After "Finish" we show one of two things depending on where the
  browser is when the wizard ends:

    1. Browser is still on the device AP (192.168.4.1) — the user has
       to switch their phone/laptop back to their home WiFi and then
       reach the device by its hostname or new IP. We give them the
       address and a tappable copy button.

    2. Browser is on the home network already — we just send them to
       the Dashboard.

  This mirrors v2's WizardAlertBox + reload2ip handoff.
-->
<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Button from '../ui/Button.svelte'

  let { visible = false, hostname = '', onclose = () => {} } = $props()

  let copied = $state(false)
  let displayHost = $derived(hostname ? `${hostname}.local` : '')

  async function copyAddress() {
    if (!displayHost) return
    try {
      await navigator.clipboard.writeText(`http://${displayHost}`)
      copied = true
      setTimeout(() => (copied = false), 1500)
    } catch {
      // clipboard may be unavailable on http: origins; silently ignore
    }
  }
</script>

<Modal {visible} closable={false}>
  <h2 class="mb-3 text-base font-semibold text-text">
    {$_('wizard.reconnect.title')}
  </h2>
  <p class="mb-3 text-sm text-text-dim">{$_('wizard.reconnect.body')}</p>

  {#if displayHost}
    <div class="mb-4 rounded-xl border border-border bg-surface p-3">
      <p class="text-xs uppercase tracking-wider text-text-dim">
        {$_('wizard.reconnect.address_label')}
      </p>
      <button
        type="button"
        onclick={copyAddress}
        class="mt-1 break-all text-left text-sm font-semibold text-accent hover:underline"
      >
        http://{displayHost}
      </button>
      {#if copied}
        <p class="mt-1 text-xs text-text-dim">{$_('wizard.reconnect.copied')}</p>
      {/if}
    </div>
  {/if}

  <Button label={$_('wizard.reconnect.dismiss')} onclick={onclose} />
</Modal>
