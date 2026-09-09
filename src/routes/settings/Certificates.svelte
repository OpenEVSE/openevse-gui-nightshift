<!-- src/routes/settings/Certificates.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { config_store } from '../../lib/stores/config.js'
  import { certificateUsage } from '../../lib/config/certUsage.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import CertificateModal from '../../lib/components/config/CertificateModal.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import IconButton from '../../lib/components/ui/IconButton.svelte'

  let modalOpen = $state(false)
  let busy = $state(false)

  let certificates = $derived(Array.isArray($certificate_store) ? $certificate_store : [])

  // Which connection each certificate is load-bearing for. One derivation
  // drives both the badge and the delete guard, so the two cannot disagree:
  // deleting a certificate a connection still points at leaves the charger
  // reconnect-looping with nothing in the log.
  let rows = $derived(
    certificates.map((cert) => ({ cert, usage: certificateUsage($config_store, cert.id) })),
  )

  async function addCertificate(cert) {
    if (busy) return
    busy = true
    try {
      const res = await serialQueue.add(() => certificate_store.upload(cert))
      if (res && res.success) {
        modalOpen = false
        await serialQueue.add(() => certificate_store.download())
      } else {
        showWriteError()
      }
    } finally {
      busy = false
    }
  }

  async function remove(id, usage = []) {
    // The button is already disabled for an in-use certificate; the guard lives
    // here too so a stale render cannot get past it.
    if (busy || usage.length > 0) return
    busy = true
    try {
      const ok = await serialQueue.add(() => certificate_store.remove(id))
      if (ok) {
        await serialQueue.add(() => certificate_store.download())
      } else {
        showWriteError()
      }
    } finally {
      busy = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.certificates')}>
  <ConfigSection title={$_('config.certificates.installed')}>
    {#if certificates.length === 0}
      <p class="py-2 text-sm text-text-dim">{$_('config.certificates.empty')}</p>
    {:else}
      {#each rows as { cert, usage }}
        <div class="flex items-center gap-3 py-2 text-sm">
          <span class="text-text-dim">{cert.id}</span>
          <span class="rounded bg-surface-3 px-2 py-0.5 text-xs text-text-dim">
            {$_('config.certificates.' + cert.type)}
          </span>
          <span class="flex-1 text-text">{cert.name}</span>
          <!-- Which connection actually points at this certificate. Keyed on
               the config reference, never on the certificate's name: how a
               provisioning tool names its certificates is its own business. -->
          {#each usage as u}
            <span class="rounded bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
              {$_('config.certificates.in_use_' + u)}
            </span>
          {/each}
          <IconButton
            icon="mdi:trash-can-outline"
            label={usage.length > 0
              ? $_('config.certificates.delete_in_use')
              : $_('config.certificates.delete')}
            disabled={busy || usage.length > 0}
            onclick={() => remove(cert.id, usage)}
          />
        </div>
      {/each}
    {/if}
  </ConfigSection>

  <div class="mt-4">
    <Button label={$_('config.certificates.add')} disabled={busy} onclick={() => (modalOpen = true)} />
  </div>
</ConfigPage>

<CertificateModal
  open={modalOpen}
  {busy}
  onclose={() => (modalOpen = false)}
  onsubmit={addCertificate}
/>
