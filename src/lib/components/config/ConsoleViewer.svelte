<!-- src/lib/components/config/ConsoleViewer.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { tick } from 'svelte'

  let { mode = 'debug' } = $props()

  let lines = $state([])
  let failed = $state(false)
  let socket
  let containerEl

  function connect() {
    try {
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
      socket = new WebSocket(`${proto}${location.host}/${mode}/console`)
      socket.addEventListener('message', (e) => {
        lines = [...lines, String(e.data)].slice(-2000)
      })
      socket.addEventListener('error', () => (failed = true))
      socket.addEventListener('close', () => {
        if (lines.length === 0) failed = true
      })
    } catch {
      failed = true
    }
  }

  $effect(() => {
    connect()
    return () => socket?.close()
  })

  $effect(() => {
    // depend on lines so this re-runs when new lines arrive
    lines
    tick().then(() => {
      if (containerEl) containerEl.scrollTop = containerEl.scrollHeight
    })
  })
</script>

<div bind:this={containerEl} class="h-72 overflow-y-auto rounded-xl bg-surface-3 p-3 font-mono text-xs text-text">
  {#if failed}
    <p class="text-text-dim">{$_('config.terminal.unavailable')}</p>
  {:else if lines.length === 0}
    <p class="text-text-dim">{$_('config.terminal.connecting')}</p>
  {:else}
    {#each lines as line}
      <div>{line}</div>
    {/each}
  {/if}
</div>
