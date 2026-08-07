<!-- src/lib/components/config/ConsoleViewer.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { tick } from 'svelte'
  import { httpAPI } from '../../api/httpAPI.js'

  let { mode = 'debug' } = $props()

  // The device's console WS streams output one character at a time. Rendering
  // each message as its own <div> put every character on its own line, so we
  // keep a single appended text buffer and let <pre> respect the embedded
  // newlines from the stream itself.
  let text = $state('')
  let connectionState = $state('connecting')
  let socket
  let containerEl

  // Cap the buffer so a long-running console doesn't grow unbounded. Trims to
  // the last ~80k chars on overflow — that's ~1000 typical log lines.
  const MAX_CHARS = 100_000
  const KEEP_CHARS = 80_000

  function normalize(chunk) {
    return String(chunk).replace(/\r\n|\r/g, '\n')
  }

  function append(chunk, prepend = false) {
    let next = prepend ? normalize(chunk) + text : text + normalize(chunk)
    if (next.length > MAX_CHARS) next = next.slice(-KEEP_CHARS)
    text = next
  }

  async function loadHistory(consoleMode) {
    const history = await httpAPI('GET', `/${consoleMode}`, null, 'text')
    if (history !== 'error' && history) append(history, true)
  }

  async function connect(consoleMode, isCancelled) {
    connectionState = 'connecting'

    // StreamSpy exposes its buffered output through /debug and /evse. Fetch
    // that snapshot *before* opening the socket. The device keeps writing to
    // the same buffer, so a snapshot taken while the socket was already live
    // would repeat lines the socket had delivered in the meantime.
    await loadHistory(consoleMode)
    if (isCancelled()) return

    try {
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
      socket = new WebSocket(`${proto}${location.host}/${consoleMode}/console`)
      socket.addEventListener('open', () => {
        if (!isCancelled()) connectionState = 'connected'
      })
      socket.addEventListener('message', (e) => {
        if (!isCancelled()) append(e.data)
      })
      socket.addEventListener('error', () => {
        if (!isCancelled()) connectionState = 'failed'
      })
      // Closing on teardown would otherwise flag the console as failed on the
      // way out, so honour the cancelled flag here too.
      socket.addEventListener('close', () => {
        if (!isCancelled()) connectionState = 'failed'
      })
    } catch {
      connectionState = 'failed'
    }
  }

  $effect(() => {
    // Read mode synchronously so the effect re-runs when it changes; the read
    // inside connect() happens after an await, where Svelte no longer tracks.
    const consoleMode = mode
    let cancelled = false
    connect(consoleMode, () => cancelled)
    return () => {
      cancelled = true
      socket?.close()
    }
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
  {#if text.length > 0}
    <!-- Buffered history means `text` is usually non-empty, so a dead socket
         would otherwise look like a merely quiet console. Say so explicitly
         rather than letting stale output stand in for a live stream. -->
    {#if connectionState === 'failed'}
      <p class="mb-2 text-text-dim">{$_('config.terminal.disconnected')}</p>
    {/if}
    <pre class="m-0 whitespace-pre-wrap break-all">{text}</pre>
  {:else if connectionState === 'failed'}
    <p class="text-text-dim">{$_('config.terminal.unavailable')}</p>
  {:else if connectionState === 'connecting'}
    <p class="text-text-dim">{$_('config.terminal.connecting')}</p>
  {:else}
    <p class="text-text-dim">{$_('config.terminal.waiting')}</p>
  {/if}
</div>
