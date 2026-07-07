<!--
  src/lib/components/wizard/steps/FirmwareInfo.svelte

  Last step: firmware versions + an in-place updater. Pick a .bin, it
  streams to the device's /update endpoint (same one the curl/PlatformIO
  upload uses), then the device reboots and we poll until it's back.

  XHR instead of fetch: upload progress events. The dev-server /api prefix
  mirrors httpAPI.js.
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config.js'
  import ReadOnlyRow from '../../config/ReadOnlyRow.svelte'
  import Button from '../../ui/Button.svelte'
  import ProgressBar from '../../ui/ProgressBar.svelte'
  import { isRemoteDisplay } from '../../../config/remoteDisplay.js'

  let remote = $derived(isRemoteDisplay($config_store))

  let fileInput = $state(null)
  let file = $state(null)
  // idle | uploading | rebooting | done | error
  let phase = $state('idle')
  let progress = $state(0)

  function pickFile(e) {
    file = e.currentTarget.files?.[0] ?? null
    if (phase === 'done' || phase === 'error') phase = 'idle'
  }

  function updateUrl() {
    return import.meta.env.DEV ? '/api/update' : '/update'
  }

  async function waitForReboot() {
    phase = 'rebooting'
    // Flash write + restart takes a few seconds; then poll /config.
    await new Promise((r) => setTimeout(r, 8000))
    const base = import.meta.env.DEV ? '/api' : ''
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${base}/config`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          phase = 'done'
          // Reload so the freshly-embedded UI is what the browser runs.
          setTimeout(() => location.reload(), 1500)
          return
        }
      } catch {
        /* not back yet */
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
    phase = 'error'
  }

  function upload() {
    if (!file || phase === 'uploading' || phase === 'rebooting') return
    phase = 'uploading'
    progress = 0

    const body = new FormData()
    body.append('firmware', file, file.name)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', updateUrl())
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress = Math.round((e.loaded / e.total) * 100)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        progress = 100
        waitForReboot()
      } else {
        phase = 'error'
      }
    }
    xhr.onerror = () => {
      // The device can drop the socket as it reboots right after the last
      // byte — treat a full upload as success.
      if (progress >= 100) waitForReboot()
      else phase = 'error'
    }
    xhr.send(body)
  }

  let busy = $derived(phase === 'uploading' || phase === 'rebooting')
</script>

<div class="space-y-4">
  <p class="text-sm text-text-dim">{$_('wizard.firmware.intro')}</p>

  <div class="rounded-xl border border-border bg-surface-2 p-1">
    <ReadOnlyRow label={$_('config.about.firmware')} value={$config_store?.firmware} />
    <ReadOnlyRow label={$_('config.about.gateway')} value={$config_store?.version} />
  </div>

  <!-- In-place firmware update -->
  <div class="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
    <p class="text-sm font-semibold text-text">{$_('wizard.firmware.update_title')}</p>

    <input
      bind:this={fileInput}
      type="file"
      accept=".bin"
      class="hidden"
      onchange={pickFile}
    />
    <div class="flex items-center gap-3">
      <Button
        label={$_('wizard.firmware.choose')}
        variant="ghost"
        disabled={busy}
        onclick={() => fileInput?.click()}
      />
      <span class="min-w-0 flex-1 truncate text-sm text-text-dim">
        {file ? file.name : $_('wizard.firmware.no_file')}
      </span>
      <div class="shrink-0">
        <Button
          label={$_('wizard.firmware.upload')}
          disabled={!file || busy}
          onclick={upload}
        />
      </div>
    </div>

    {#if phase === 'uploading' || phase === 'rebooting'}
      <ProgressBar value={progress} />
      <p class="text-sm text-text-dim">
        {phase === 'uploading'
          ? $_('wizard.firmware.uploading', { values: { pct: progress } })
          : $_('wizard.firmware.rebooting')}
      </p>
    {:else if phase === 'done'}
      <p class="text-sm text-accent">{$_('wizard.firmware.done')}</p>
    {:else if phase === 'error'}
      <p class="text-sm text-error">{$_('wizard.firmware.failed')}</p>
    {/if}
  </div>

  {#if !remote}
    <p class="text-xs text-text-dim">{$_('wizard.firmware.update_hint')}</p>
  {/if}
</div>
