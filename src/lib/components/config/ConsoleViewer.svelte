<!-- src/lib/components/config/ConsoleViewer.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { tick } from 'svelte'

  let { mode = 'debug' } = $props()

  // The device's console WS streams output one character at a time. Rendering
  // each message as its own <div> put every character on its own line, so we
  // keep a single appended text buffer and let <pre> respect the embedded
  // newlines from the stream itself.
  let text = $state('')
  let failed = $state(false)
  let socket
  let containerEl

  // Cap the buffer so a long-running console doesn't grow unbounded. Trims to
  // the last ~80k chars on overflow — that's ~1000 typical log lines.
  const MAX_CHARS = 100_000
  const KEEP_CHARS = 80_000

  function connect() {
    try {
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
      socket = new WebSocket(`${proto}${location.host}/${mode}/console`)
      socket.addEventListener('message', (e) => {
        let next = text + String(e.data)
        if (next.length > MAX_CHARS) next = next.slice(-KEEP_CHARS)
        text = next
      })
      socket.addEventListener('error', () => (failed = true))
      socket.addEventListener('close', () => {
        if (text.length === 0) failed = true
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
    text // re-run on new data
    tick().then(() => {
      if (containerEl) containerEl.scrollTop = containerEl.scrollHeight
    })
  })
</script>

<div
  bind:this={containerEl}
  class="h-[70vh] max-h-[700px] min-h-[260px] overflow-y-auto rounded-xl bg-surface-3 p-3 font-mono text-xs text-text"
>
  {#if failed}
    <p class="text-text-dim">{$_('config.terminal.unavailable')}</p>
  {:else if text.length === 0}
    <p class="text-text-dim">{$_('config.terminal.connecting')}</p>
  {:else}
    <pre class="m-0 whitespace-pre-wrap break-all">{text}</pre>
  {/if}
</div>
