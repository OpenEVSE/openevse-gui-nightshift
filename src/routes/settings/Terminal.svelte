<!-- src/routes/settings/Terminal.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import ConsoleViewer from '../../lib/components/config/ConsoleViewer.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import Modal from '../../lib/components/ui/Modal.svelte'
  import { downloadDiagnostics } from '../../lib/diagnostics.js'

  let command = $state('$')
  let results = $state([])
  let sending = $state(false)
  let consoleMode = $state(null) // 'debug' | 'evse' | null
  let exportedFile = $state('')

  function exportDiagnostics() {
    exportedFile = downloadDiagnostics()
    // Clear the "downloaded X" hint after a few seconds.
    setTimeout(() => (exportedFile = ''), 4000)
  }

  async function send() {
    if (sending || !command.trim()) return
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
      <div class="mb-3 max-h-60 overflow-y-auto rounded-xl bg-surface-3 p-3 font-mono text-xs">
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
