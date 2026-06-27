<!-- src/routes/settings/Terminal.svelte -->
<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { uisettings_store } from '../../lib/stores/uisettings.js'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import ConsoleViewer from '../../lib/components/config/ConsoleViewer.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Modal from '../../lib/components/ui/Modal.svelte'
  import ProgressBar from '../../lib/components/ui/ProgressBar.svelte'
  import { downloadDiagnostics } from '../../lib/diagnostics.js'
  import { formatBytes } from '../../lib/utils.js'

  function setDevFeatures(on) {
    uisettings_store.update((s) => ({ ...s, dev_features: !!on }))
  }

  // ── Flash repartition: expand a 16MB module flashed with the 4MB layout ──
  // The gateway reports can_expand_16mb only when the chip is >=16MB, the live
  // layout spans <=4MB, and the migration engine is built in.
  let canExpand = $derived(!!$config_store?.can_expand_16mb)
  let pendingExpand = $state(false) // confirmation dialog open
  let expanding = $state(false) // local gate from POST until device drives state
  let expandDismissed = $state(false) // user closed a failed-migration modal
  // Pushed by the device over the status websocket during migration.
  let migrateState = $derived($status_store?.migrate)
  let migrateProgress = $derived($status_store?.migrate_progress ?? 0)
  let migrateReload = $state(0)

  // After the commit the device reboots into the new layout; give it longer
  // than a normal OTA before reloading the page against the new firmware.
  $effect(() => {
    if (migrateState === 'done' && migrateReload === 0) {
      migrateReload = 15
      const interval = setInterval(() => {
        migrateReload -= 1
        if (migrateReload <= 0) {
          clearInterval(interval)
          location.reload()
        }
      }, 1000)
    }
  })
  $effect(() => {
    if (migrateState === 'failed') expanding = false
  })

  async function startExpand() {
    pendingExpand = false
    if (expanding) return
    expandDismissed = false
    expanding = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/migrate/expand16mb', JSON.stringify({})),
      )
      if (!res || res === 'error' || res.msg !== 'started') {
        showWriteError()
        expanding = false
      }
      // else leave expanding=true; the status feed drives the progress modal
    } catch {
      showWriteError()
      expanding = false
    }
  }

  // Flash / partition usage reported by the gateway via /config. Free space is
  // derived: the app partition's free headroom is what a larger OTA image can
  // grow into, the filesystem's free is what's left for logs/certificates.
  let flash = $derived($config_store?.espflash)
  let app = $derived.by(() => {
    const c = $config_store ?? {}
    const free = c.app0_size != null && c.sketch_size != null ? c.app0_size - c.sketch_size : undefined
    return { size: c.app0_size, used: c.sketch_size, free }
  })
  let fs = $derived.by(() => {
    const c = $config_store ?? {}
    const free = c.littlefs_size != null && c.littlefs_used != null ? c.littlefs_size - c.littlefs_used : undefined
    return { size: c.littlefs_size, used: c.littlefs_used, free }
  })

  // Config is loaded globally, but refresh so the figures are current on visit.
  onMount(() => {
    config_store.download()
  })

  let command = $state('$')
  let results = $state([])
  let sending = $state(false)
  let consoleMode = $state(null) // 'debug' | 'evse' | null
  let exportedFile = $state('')

  // Keep the newest reply in view: the results log is a fixed-height scroll box,
  // so without this a command sent from the bottom would append below the fold
  // and look like nothing happened (issue #31). Re-pin to the bottom whenever an
  // entry is appended.
  let logEl = $state(null)
  $effect(() => {
    results.length
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  })

  function exportDiagnostics() {
    exportedFile = downloadDiagnostics()
    // Clear the "downloaded X" hint after a few seconds.
    setTimeout(() => (exportedFile = ''), 4000)
  }

  async function send() {
    // Treat a blank input or the bare "$" prefix (the reset default) as empty —
    // sending it is meaningless and just logs an error entry.
    const trimmed = command.trim()
    if (sending || !trimmed || trimmed === '$') return
    sending = true
    try {
      const res = await httpAPI('GET', '/r?json=1&rapi=' + command)
      if (res && res !== 'error') {
        results = [...results, { cmd: res.cmd ?? command, ret: res.ret ?? '', error: res.error }]
        command = '$'
      } else {
        results = [...results, { cmd: command, ret: '', error: 'error' }]
      }
    } finally {
      sending = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.terminal')}>
  <ConfigSection title={$_('config.terminal.rapi')}>
    {#if results.length > 0}
      <div bind:this={logEl} class="mb-3 max-h-60 overflow-y-auto rounded-xl bg-surface-3 p-3 font-mono text-xs">
        {#each results as r}
          <div class="text-text-dim">&gt; {r.cmd}</div>
          {#if r.error}
            <div class="text-error">&lt; {r.error}</div>
          {:else}
            <div class="text-text">&lt; {r.ret}</div>
          {/if}
        {/each}
      </div>
    {/if}
    <label class="mb-1 block text-sm text-text" for="rapi-cmd">{$_('config.terminal.command')}</label>
    <input
      id="rapi-cmd"
      aria-label={$_('config.terminal.command')}
      value={command}
      oninput={(e) => (command = e.currentTarget.value)}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          send()
        }
      }}
      class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-sm
             text-text focus:border-accent focus:outline-none"
    />
    <div class="mt-2 flex gap-2">
      <Button label={$_('config.terminal.send')} disabled={sending} onclick={send} />
      <Button label={$_('config.terminal.clear')} variant="ghost" onclick={() => (results = [])} />
    </div>
  </ConfigSection>

  <ConfigSection title={$_('config.terminal.consoles')}>
    <div class="flex gap-2">
      <Button label={$_('config.terminal.debug')} variant="ghost" onclick={() => (consoleMode = 'debug')} />
      <Button label={$_('config.terminal.evse')} variant="ghost" onclick={() => (consoleMode = 'evse')} />
    </div>
  </ConfigSection>

  <ConfigSection title={$_('config.terminal.diagnostics')}>
    <p class="mb-2 text-sm text-text-dim">{$_('config.terminal.diagnostics_desc')}</p>
    <Button
      label={$_('config.terminal.diagnostics_export')}
      variant="ghost"
      onclick={exportDiagnostics}
    />
    {#if exportedFile}
      <p class="mt-2 text-xs text-text-dim">
        {$_('config.terminal.diagnostics_done', { values: { file: exportedFile } })}
      </p>
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.terminal.storage')}>
    <ReadOnlyRow label={$_('config.terminal.flash_size')} value={formatBytes(flash)} />
    <div class="mt-2 overflow-hidden rounded-xl border border-border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface-3 text-text-dim">
            <th class="px-3 py-2 text-left font-medium"></th>
            <th class="px-3 py-2 text-right font-medium">{$_('config.terminal.size')}</th>
            <th class="px-3 py-2 text-right font-medium">{$_('config.terminal.used')}</th>
            <th class="px-3 py-2 text-right font-medium">{$_('config.terminal.free')}</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-t border-border">
            <td class="px-3 py-2 text-text-dim">{$_('config.terminal.app_partition')}</td>
            <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(app.size)}</td>
            <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(app.used)}</td>
            <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(app.free)}</td>
          </tr>
          <tr class="border-t border-border">
            <td class="px-3 py-2 text-text-dim">{$_('config.terminal.filesystem')}</td>
            <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(fs.size)}</td>
            <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(fs.used)}</td>
            <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(fs.free)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    {#if canExpand}
      <div class="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-3">
        <p class="mb-1 text-sm font-medium text-text">{$_('config.terminal.expand16mb_title')}</p>
        <p class="mb-3 text-sm text-text-dim">{$_('config.terminal.expand16mb_desc')}</p>
        <Button label={$_('config.terminal.expand16mb_button')} onclick={() => (pendingExpand = true)} />
      </div>
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.terminal.labs')}>
    <FormField
      label={$_('config.terminal.labs_enable')}
      description={$_('config.terminal.labs_desc')}
    >
      <Toggle
        checked={!!$uisettings_store?.dev_features}
        label={$_('config.terminal.labs_enable')}
        onchange={setDevFeatures}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>

<Modal visible={consoleMode !== null} size="lg" onclose={() => (consoleMode = null)}>
  <div class="p-4">
    <h2 class="mb-3 text-base font-semibold text-text">
      {consoleMode === 'evse' ? $_('config.terminal.evse') : $_('config.terminal.debug')}
    </h2>
    {#if consoleMode}
      {#key consoleMode}
        <ConsoleViewer mode={consoleMode} />
      {/key}
    {/if}
  </div>
</Modal>

<!-- Expand-to-16MB confirmation -->
<Modal visible={pendingExpand} onclose={() => (pendingExpand = false)}>
  <h2 class="mb-2 text-base font-semibold text-text">{$_('config.terminal.expand16mb_confirm_title')}</h2>
  <p class="mb-3 text-sm text-text-dim">{$_('config.terminal.expand16mb_confirm_body')}</p>
  <p class="mb-4 text-sm font-medium text-warning">{$_('config.terminal.expand16mb_warning')}</p>
  <div class="flex gap-2">
    <Button label={$_('config.terminal.expand16mb_confirm_yes')} onclick={startExpand} />
    <Button
      label={$_('config.terminal.expand16mb_confirm_no')}
      variant="ghost"
      onclick={() => (pendingExpand = false)}
    />
  </div>
</Modal>

<!-- Expand-to-16MB progress / result -->
<Modal
  visible={(expanding || !!migrateState) && !(migrateState === 'failed' && expandDismissed)}
  closable={false}
>
  <h2 class="mb-4 text-base font-semibold text-text">{$_('config.terminal.expand16mb_progress_title')}</h2>
  {#if migrateState !== 'failed'}
    <ProgressBar value={migrateProgress} />
  {/if}
  <p class="mt-3 text-sm text-text-dim">
    {#if migrateReload > 0}
      {$_('config.terminal.expand16mb_reload', { values: { sec: migrateReload } })}
    {:else if migrateState === 'failed'}
      {$_('config.terminal.expand16mb_failed')}
    {:else if migrateState}
      {$_('config.terminal.expand16mb_phase_' + migrateState)}
    {:else if expanding}
      {$_('config.terminal.expand16mb_starting')}
    {/if}
  </p>
  {#if migrateState && migrateState !== 'done' && migrateState !== 'failed'}
    <p class="mt-2 text-xs font-medium text-warning">{$_('config.terminal.expand16mb_warning')}</p>
  {/if}
  {#if migrateState === 'failed'}
    <div class="mt-4 flex gap-2">
      <Button
        label={$_('config.terminal.expand16mb_close')}
        variant="ghost"
        onclick={() => (expandDismissed = true)}
      />
    </div>
  {/if}
</Modal>
