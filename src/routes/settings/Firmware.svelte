<!-- src/routes/settings/Firmware.svelte -->
<script>
  import { _, } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { classifyReleases, findAsset, updateAvailable, fetchReleases }
    from '../../lib/config/firmware.js'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { serialQueue } from '../../lib/queue.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { sanitizeConfig } from '../../lib/config/backup.js'
  import { JSONTryParse } from '../../lib/utils.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import ProgressBar from '../../lib/components/ui/ProgressBar.svelte'

  let busy = $state(false)
  let confirmReset = $state(false)
  let firmwareFile = $state(null)
  let uploading = $state(false)

  // /update is multipart; in dev the mock lives behind the /api proxy prefix.
  const updateUrl = import.meta.env.DEV ? '/api/update' : '/update'

  let otaState = $derived($status_store?.ota)
  let otaProgress = $derived($status_store?.ota_progress ?? 0)

  let reloadCountdown = $state(0)

  $effect(() => {
    if (otaState === 'completed' && reloadCountdown === 0) {
      reloadCountdown = 6
      const interval = setInterval(() => {
        reloadCountdown -= 1
        if (reloadCountdown <= 0) {
          clearInterval(interval)
          location.reload()
        }
      }, 1000)
    }
  })

  // ── online (GitHub) updates ─────────────────────────────────────────────
  let releases = $state(null) // null = loading, [] = failed/empty
  let buildenv = $derived($config_store?.buildenv ?? '')
  let installed = $derived($config_store?.version ?? '')

  let channels = $derived(() => {
    if (!releases) return []
    const c = classifyReleases(releases)
    return [
      { key: 'release', rel: c.release },
      { key: 'prerelease', rel: c.prerelease },
      { key: 'daily', rel: c.daily },
    ]
      .map(({ key, rel }) => ({
        key,
        version: rel?.name ?? rel?.tag_name ?? '',
        asset: findAsset(rel, buildenv),
      }))
      .filter((ch) => ch.asset) // only channels with a build for this device
  })

  let hasUpdate = $derived(
    channels().some(
      (ch) => ch.key === 'release' && updateAvailable(ch.version, installed),
    ),
  )

  onMount(async () => {
    releases = await fetchReleases()
  })

  async function installOnline(asset) {
    if (uploading) return
    uploading = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/update', JSON.stringify({ url: asset.browser_download_url })),
      )
      if (!res || res === 'error') showWriteError()
    } finally {
      uploading = false
    }
  }

  async function restart(device) {
    if (busy) return
    busy = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/restart', JSON.stringify({ device })),
      )
      if (!res || res === 'error') showWriteError()
    } finally {
      busy = false
    }
  }

  async function factoryReset() {
    confirmReset = false
    const res = await serialQueue.add(() => httpAPI('GET', '/reset'))
    if (!res || res === 'error') showWriteError()
  }

  async function uploadFirmware() {
    if (!firmwareFile || uploading) return
    uploading = true
    serialQueue.pause()
    try {
      const fd = new FormData()
      fd.append('update', firmwareFile)
      const res = await fetch(updateUrl, { method: 'POST', body: fd })
      if (!res.ok) showWriteError()
    } catch {
      showWriteError()
    } finally {
      serialQueue.resume()
      uploading = false
    }
  }

  function backupConfig() {
    const clean = sanitizeConfig($config_store)
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'openevse-config.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function restoreConfig(e) {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = JSONTryParse(text)
    if (!parsed || typeof parsed !== 'object') {
      showWriteError()
      return
    }
    const ok = await serialQueue.add(() => config_store.upload(parsed))
    if (!ok) showWriteError()
  }
</script>

<ConfigPage title={$_('config.pages.firmware')}>
  <ConfigSection title={$_('config.firmware.versions')}>
    <ReadOnlyRow label={$_('config.firmware.evse')} value={$config_store?.firmware} />
    <ReadOnlyRow label={$_('config.firmware.gateway')} value={$config_store?.version} />
  </ConfigSection>

  <ConfigSection title={$_('config.firmware.online')}>
    {#if releases === null}
      <p class="py-2 text-sm text-text-dim">{$_('config.firmware.checking')}</p>
    {:else if channels().length === 0}
      <p class="py-2 text-sm text-text-dim">{$_('config.firmware.github_error')}</p>
    {:else}
      {#if hasUpdate}
        <p class="mb-1 text-sm text-accent">{$_('config.firmware.update_found')}</p>
      {:else}
        <p class="mb-1 text-sm text-text-dim">{$_('config.firmware.up_to_date')}</p>
      {/if}
      {#each channels() as ch}
        <div class="flex items-center gap-3 py-2 text-sm">
          <span class="flex-1 text-text">
            {$_('config.firmware.channel_' + ch.key)}
            <span class="text-text-dim">· {ch.version}</span>
          </span>
          <Button
            label={$_('config.firmware.install_online')}
            variant="ghost"
            disabled={uploading}
            onclick={() => installOnline(ch.asset)}
          />
        </div>
      {/each}
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.firmware.update')}>
    <p class="mb-2 text-xs text-text-dim">{$_('config.firmware.update_desc')}</p>
    <input
      type="file"
      accept=".bin,.hex"
      aria-label={$_('config.firmware.choose_file')}
      onchange={(e) => (firmwareFile = e.currentTarget.files?.[0] ?? null)}
      class="block w-full text-sm text-text-dim file:mr-3 file:rounded-lg file:border-0
             file:bg-surface-3 file:px-3 file:py-1.5 file:text-text"
    />
    <div class="mt-2">
      <Button
        label={$_('config.firmware.install')}
        disabled={!firmwareFile || uploading}
        onclick={uploadFirmware}
      />
    </div>
    {#if otaState}
      <div class="mt-3">
        <ProgressBar value={otaProgress} />
        <p class="mt-1 text-xs text-text-dim">
          {#if reloadCountdown > 0}
            {$_('config.firmware.ota_reload')}
          {:else}
            {$_('config.firmware.ota_' + otaState)}
          {/if}
        </p>
      </div>
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.firmware.backup')}>
    <FormField label={$_('config.firmware.backup_export')} description={$_('config.firmware.backup_desc')}>
      <Button label={$_('config.firmware.backup_export')} variant="ghost" onclick={backupConfig} />
    </FormField>
    <FormField label={$_('config.firmware.backup_import')}>
      <input
        type="file"
        accept=".json,.txt"
        aria-label={$_('config.firmware.backup_import')}
        onchange={restoreConfig}
        class="block w-full text-sm text-text-dim file:mr-3 file:rounded-lg file:border-0
               file:bg-surface-3 file:px-3 file:py-1.5 file:text-text"
      />
    </FormField>
  </ConfigSection>

  <ConfigSection title={$_('config.firmware.maintenance')}>
    <div class="py-2">
      <Button label={$_('config.firmware.restart_evse')} variant="ghost" disabled={busy} onclick={() => restart('evse')} />
    </div>
    <div class="py-2">
      <Button label={$_('config.firmware.restart_gateway')} variant="ghost" disabled={busy} onclick={() => restart('gateway')} />
    </div>
    <div class="py-2">
      <p class="mb-1 text-xs text-text-dim">{$_('config.firmware.reset_desc')}</p>
      {#if confirmReset}
        <div class="rounded-xl border border-error/40 bg-surface-2 p-3">
          <p class="mb-2 text-sm text-error">{$_('config.firmware.reset_confirm')}</p>
          <div class="flex gap-2">
            <Button label={$_('config.firmware.reset')} onclick={factoryReset} />
            <Button label={$_('config.certificates.cancel')} variant="ghost" onclick={() => (confirmReset = false)} />
          </div>
        </div>
      {:else}
        <Button label={$_('config.firmware.reset')} variant="ghost" onclick={() => (confirmReset = true)} />
      {/if}
    </div>
  </ConfigSection>
</ConfigPage>
