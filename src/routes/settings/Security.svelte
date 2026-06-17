<!-- src/routes/settings/Security.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import CertificateModal from '../../lib/components/config/CertificateModal.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import IconButton from '../../lib/components/ui/IconButton.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Slider from '../../lib/components/ui/Slider.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let modalOpen = $state(false)
  let certBusy = $state(false)

  let certificates = $derived(Array.isArray($certificate_store) ? $certificate_store : [])

  let heartbeatEnabled = $derived(($config_store?.heartbeat_interval ?? 0) > 0)

  async function addCertificate(cert) {
    if (certBusy) return
    certBusy = true
    try {
      const res = await serialQueue.add(() => certificate_store.upload(cert))
      if (res && res.success) {
        modalOpen = false
        await serialQueue.add(() => certificate_store.download())
      } else {
        showWriteError()
      }
    } finally {
      certBusy = false
    }
  }

  async function removeCertificate(id) {
    if (certBusy) return
    certBusy = true
    try {
      const ok = await serialQueue.add(() => certificate_store.remove(id))
      if (ok) {
        await serialQueue.add(() => certificate_store.download())
      } else {
        showWriteError()
      }
    } finally {
      certBusy = false
    }
  }

  function setHeartbeat(enabled) {
    if (enabled) {
      // Restore sensible defaults; keep any previously saved current > 0
      const interval = 5
      const current = ($config_store?.heartbeat_current ?? 0) > 0
        ? $config_store.heartbeat_current
        : 6
      form.saveFields({ heartbeat_interval: interval, heartbeat_current: current })
    } else {
      // Set interval=0 to stop $SY pulses; current=0 for fail-safe
      form.saveFields({ heartbeat_interval: 0, heartbeat_current: 0 })
    }
  }
</script>

<ConfigPage title={$_('config.pages.security')}>
  <ConfigSection title={$_('config.security.firmware_security')}>
    {#if $config_store?.boot_lock !== undefined}
      <FormField
        label={$_('config.security.boot_lock')}
        description={$_('config.security.boot_lock_desc')}
        status={$ss.boot_lock ?? 'idle'}
      >
        <Toggle
          checked={!!$config_store?.boot_lock}
          label={$_('config.security.boot_lock')}
          onchange={(v) => form.saveField('boot_lock', v)}
        />
      </FormField>
    {/if}

    {#if $config_store?.heartbeat_interval !== undefined}
      <FormField
        label={$_('config.security.heartbeat')}
        description={$_('config.security.heartbeat_desc')}
        status={$ss.heartbeat_current ?? 'idle'}
      >
        <Toggle
          checked={heartbeatEnabled}
          label={$_('config.security.heartbeat')}
          onchange={setHeartbeat}
        />
      </FormField>
      {#if heartbeatEnabled}
        <FormField
          label={$_('config.security.heartbeat_interval')}
          status={$ss.heartbeat_interval ?? 'idle'}
        >
          <NumberInput
            value={$config_store?.heartbeat_interval ?? 5}
            min={1}
            max={60}
            revert={form.revert}
            onchange={(v) => form.saveField('heartbeat_interval', v)}
          />
        </FormField>
        <FormField
          label={$_('config.security.heartbeat_current')}
          description={`${$config_store?.heartbeat_current ?? 6} A`}
          status={$ss.heartbeat_current ?? 'idle'}
        >
          <div class="flex items-center gap-3">
            <Slider
              min={6}
              max={24}
              step={1}
              value={$config_store?.heartbeat_current ?? 6}
              onchange={(v) => form.saveField('heartbeat_current', v)}
            />
            <span class="w-12 text-right text-sm tabular-nums text-text">
              {$config_store?.heartbeat_current ?? 6} A
            </span>
          </div>
        </FormField>
      {/if}
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.security.tls_certificates')}>
    {#if certificates.length === 0}
      <p class="py-2 text-sm text-text-dim">{$_('config.certificates.empty')}</p>
    {:else}
      {#each certificates as cert}
        <div class="flex items-center gap-3 py-2 text-sm">
          <span class="text-text-dim">{cert.id}</span>
          <span class="rounded bg-surface-3 px-2 py-0.5 text-xs text-text-dim">
            {$_('config.certificates.' + cert.type)}
          </span>
          <span class="flex-1 text-text">{cert.name}</span>
          <IconButton
            icon="mdi:trash-can-outline"
            label={$_('config.certificates.delete')}
            disabled={certBusy}
            onclick={() => removeCertificate(cert.id)}
          />
        </div>
      {/each}
    {/if}
    <div class="mt-4">
      <Button
        label={$_('config.certificates.add')}
        disabled={certBusy}
        onclick={() => (modalOpen = true)}
      />
    </div>
  </ConfigSection>
</ConfigPage>

<CertificateModal
  open={modalOpen}
  busy={certBusy}
  onclose={() => (modalOpen = false)}
  onsubmit={addCertificate}
/>
