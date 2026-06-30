<!-- src/routes/settings/Firmware.svelte -->
<script>
  import { _, } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { classifyReleases, findAsset, updateAvailable, fetchReleases }
    from '../../lib/config/firmware.js'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { uistates_store } from '../../lib/stores/uistates.js'
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
  import Modal from '../../lib/components/ui/Modal.svelte'

  let busy = $state(false)
  let confirmReset = $state(false)
  let firmwareFile = $state(null)
  let uploading = $state(false)
  // The currently-pending install confirmation, or null if no dialog is open.
  // Carries the channel + asset so the dialog can show the version it'll flash.
  let pendingInstall = $state(null)
  // The last install attempted — kept so the Retry button after a failed OTA
  // can re-fire confirmInstall() with the same channel/asset.
  let lastInstall = $state(null)
  // The user clicked "Close" on a failed OTA modal. We hide the modal until
  // a new install fires (which clears this) or the device pushes a different
  // ota state.
  let failedDismissed = $state(false)

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

  // Once the device reports a terminal OTA state, release the local
  // "uploading" gate. Until then the progress modal stays open even if the
  // POST itself has returned (the actual flash happens on the device).
  $effect(() => {
    if (otaState === 'failed') uploading = false
  })

  // ── online (GitHub) updates ─────────────────────────────────────────────
  let releases = $state(null) // null = loading, [] = failed/empty
  let buildenv = $derived($config_store?.buildenv ?? '')
  let installed = $derived($config_store?.version ?? '')

  // Every channel GitHub returned (release / prerelease / daily). Each may
  // or may not have an asset matching this device's buildenv — we still
  // render the row so the user sees the channel exists; the right-side
  // action just changes (Install / Installed badge / 'no build' note).
  let channels = $derived(() => {
    if (!releases) return []
    const c = classifyReleases(releases)
    return [
      { key: 'release', rel: c.release },
      { key: 'prerelease', rel: c.prerelease },
      { key: 'daily', rel: c.daily },
    ]
      .filter(({ rel }) => rel) // skip a channel entirely if GitHub had no release for it
      .map(({ key, rel }) => ({
        key,
        version: rel?.name ?? rel?.tag_name ?? '',
        asset: findAsset(rel, buildenv),
      }))
  })

  // A self-built firmware reports a branch/hash ("local_feature/..._modified")
  // rather than a release tag. compareVersion() treats anything without a
  // leading v-number as "equal", which would falsely badge Stable as
  // Installed — so version claims are gated on a parseable release version.
  let installedIsRelease = $derived(/^v\d+\.\d+/.test(installed))

  /** True when this channel's published version matches what's installed. */
  function isInstalled(ch) {
    return ch.key === 'release' && installedIsRelease && !updateAvailable(ch.version, installed)
  }

  let hasUpdate = $derived(
    channels().some(
      (ch) => ch.key === 'release' && updateAvailable(ch.version, installed),
    ),
  )

  onMount(async () => {
    releases = await fetchReleases()
  })

  function requestInstall(ch) {
    pendingInstall = ch
  }

  function retryInstall() {
    if (!lastInstall) return
    pendingInstall = lastInstall
    confirmInstall()
  }

  async function confirmInstall() {
    const ch = pendingInstall
    pendingInstall = null
    if (!ch || uploading) return
    lastInstall = ch         // remembered so Retry can re-fire this same install
    failedDismissed = false  // user is trying again — reopen the progress modal
    uploading = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/update', JSON.stringify({ url: ch.asset.browser_download_url })),
      )
      if (!res || res === 'error') {
        showWriteError()
        uploading = false
        return
      }
      // Leave `uploading` true: the progress modal stays open until the
      // device's status.ota flow takes over (ota_started → completed → reload).
      // The completion effect below resets uploading on 'completed' or 'failed'.
    } catch {
      showWriteError()
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
    // The device's HTTPS listener only sustains one concurrent TLS session —
    // the live status WebSocket holds it indefinitely, which starves the
    // upload's handshake entirely. Drop it for the duration; WebSocket.svelte
    // reconnects automatically once this clears.
    $uistates_store.ws_paused = true
    try {
      const fd = new FormData()
      fd.append('update', firmwareFile)
      const res = await fetch(updateUrl, { method: 'POST', body: fd })
      if (!res.ok) showWriteError()
    } catch {
      showWriteError()
    } finally {
      $uistates_store.ws_paused = false
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
    <ReadOnlyRow label={$_('config.firmware.gui')} value={__APP_VERSION__} />
  </ConfigSection>

  <ConfigSection title={$_('config.firmware.online')}>
    {#if releases === null}
      <p class="py-2 text-sm text-text-dim">{$_('config.firmware.checking')}</p>
    {:else if channels().length === 0}
      <p class="py-2 text-sm text-text-dim">{$_('config.firmware.github_error')}</p>
    {:else}
      {#if hasUpdate}
        <p class="mb-1 text-sm text-accent">{$_('config.firmware.update_found')}</p>
      {:else if installedIsRelease}
        <p class="mb-1 text-sm text-success">{$_('config.firmware.up_to_date')}</p>
      {:else}
        <p class="mb-1 text-sm text-text-dim">{$_('config.firmware.dev_build')}</p>
      {/if}
      {#each channels() as ch}
        <div class="flex items-start gap-3 py-2 text-sm">
          <div class="min-w-0 flex-1">
            <div class="text-text">
              {$_('config.firmware.channel_' + ch.key)}
              <span class="text-text-dim">· {ch.version}</span>
            </div>
            <p class="mt-0.5 text-xs text-text-dim">
              {$_('config.firmware.channel_' + ch.key + '_desc')}
            </p>
          </div>
          <div class="shrink-0">
            {#if isInstalled(ch)}
              <!-- Same Button shape as Install, just disabled — keeps the
                   right column visually aligned across all three rows. -->
              <Button label={$_('config.firmware.installed_badge')} variant="ghost" disabled={true} />
            {:else if ch.asset}
              <Button
                label={$_('config.firmware.install_online')}
                variant="ghost"
                disabled={uploading}
                onclick={() => requestInstall(ch)}
              />
            {:else}
              <!-- Channel exists but doesn't ship a build for this device's
                   buildenv (common on Stable when running a pre-built dev).
                   Same Button shape as the other rows to keep alignment. -->
              <Button label={$_('config.firmware.no_build')} variant="ghost" disabled={true} />
            {/if}
          </div>
        </div>
      {/each}

      {#if buildenv}
        <p class="mt-3 text-xs text-text-dim">
          {$_('config.firmware.buildenv_for')}
          <code class="rounded bg-surface-3 px-1 py-0.5 font-mono text-text">{buildenv}</code>
        </p>
      {/if}
    {/if}
  </ConfigSection>

  <!-- Confirm before kicking off an online install. -->
  <Modal visible={pendingInstall !== null} onclose={() => (pendingInstall = null)}>
    <h2 class="mb-2 text-base font-semibold text-text">
      {$_('config.firmware.install_confirm_title', {
        values: { channel: pendingInstall ? $_('config.firmware.channel_' + pendingInstall.key) : '' },
      })}
    </h2>
    <p class="mb-4 text-sm text-text-dim">
      {$_('config.firmware.install_confirm_body', {
        values: { version: pendingInstall?.version ?? '' },
      })}
    </p>
    <div class="flex gap-2">
      <Button label={$_('config.firmware.install_confirm_yes')} onclick={confirmInstall} />
      <Button
        label={$_('config.firmware.install_confirm_no')}
        variant="ghost"
        onclick={() => (pendingInstall = null)}
      />
    </div>
  </Modal>

  <!-- Progress: opens immediately when uploading starts, then yields to the
       device's status.ota stream once those updates arrive. Stays open
       through 'completed' → reload countdown. On 'failed', shows Retry +
       Close so the user can re-fire the same install without resetting
       the device. -->
  <Modal visible={(uploading || !!otaState) && !(otaState === 'failed' && failedDismissed)} closable={false}>
    <h2 class="mb-4 text-base font-semibold text-text">
      {$_('config.firmware.ota_title')}
    </h2>
    <ProgressBar value={otaProgress} />
    <p class="mt-3 text-sm text-text-dim">
      {#if reloadCountdown > 0}
        {$_('config.firmware.ota_reload')} ({reloadCountdown}s)
      {:else if otaState}
        {$_('config.firmware.ota_' + otaState)}
      {:else if uploading}
        {$_('config.firmware.ota_starting')}
      {/if}
    </p>
    {#if otaState === 'failed' && !uploading}
      <div class="mt-4 flex gap-2">
        {#if lastInstall}
          <Button label={$_('config.firmware.ota_retry')} onclick={retryInstall} />
        {/if}
        <Button
          label={$_('config.firmware.ota_close')}
          variant="ghost"
          onclick={() => (failedDismissed = true)}
        />
      </div>
    {/if}
  </Modal>

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
