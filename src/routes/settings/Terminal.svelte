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
  let reloadStarted = false // plain guard: the effect must not re-track migrateReload

  // After the commit the device reboots into the new layout; give it longer
  // than a normal OTA before reloading the page against the new firmware.
  $effect(() => {
    if (migrateState === 'done' && !reloadStarted) {
      reloadStarted = true
      migrateReload = 15
      const interval = setInterval(() => {
        migrateReload -= 1
        if (migrateReload <= 0) {
          clearInterval(interval)
          location.reload()
        }
      }, 1000)
      return () => clearInterval(interval)
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
  // Chip line. Newer firmware sends structured fields (chip_model, chip_rev as
  // major*100+minor, chip_cores, psram_size); older firmware only espinfo.
  let chipLabel = $derived.by(() => {
    const c = $config_store ?? {}
    if (!c.chip_model) return c.espinfo || ''
    const rev = c.chip_rev != null ? ` v${Math.floor(c.chip_rev / 100)}.${c.chip_rev % 100}` : ''
    const parts = [`${c.chip_model}${rev}`]
    if (c.chip_cores) parts.push(`${c.chip_cores} core${c.chip_cores > 1 ? 's' : ''}`)
    if (c.espflash) parts.push(`${formatBytes(c.espflash)} flash`)
    if (c.psram_size) parts.push(`${formatBytes(c.psram_size)} PSRAM`)
    return parts.join(' · ')
  })
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
  // microSD (boards with a slot, e.g. the ESP32-S3 LCD board): the firmware
  // only sends sd_size while a card is mounted. sd_log_size is the fixed-size
  // energy-log ring that lives on it.
  let sd = $derived.by(() => {
    const c = $config_store ?? {}
    if (c.sd_size == null) return null
    const free = c.sd_used != null ? c.sd_size - c.sd_used : undefined
    return { size: c.sd_size, used: c.sd_used, free, log: c.sd_log_size }
  })

  // ── Memory & health (fork-only diagnostics; every field from /status) ────
  // Live, websocket-pushed — no refresh button or poll timer (status already
  // updates itself). Whole section gates on heap_largest presence; the LVGL
  // rows gate separately on lv_used_max (TFT builds only).
  let mem = $derived($status_store ?? {})
  let memSupported = $derived(mem.heap_largest !== undefined)
  let lvglSupported = $derived(mem.lv_used_max !== undefined)

  const TONE_CLASS = { default: 'text-text', ok: 'text-accent', warn: 'text-warning', error: 'text-error' }

  // Thresholds measured on real hardware — a first cut, not settled science.
  // Below ~13 KB largest-block, OTA updates start failing partway through.
  function heapTone(bytes) {
    if (bytes == null) return 'default'
    if (bytes < 12 * 1024) return 'error'
    if (bytes < 20 * 1024) return 'warn'
    return 'default'
  }
  function stackTone(bytes) {
    // 0 is the firmware's "never sampled yet" sentinel (UINT32_MAX mapped to 0
    // before the first diagnostics_loop() sample), not an exhausted stack — so
    // it must not warn. A genuine free-stack reading under 1 KB is the alarm.
    return bytes > 0 && bytes < 1024 ? 'warn' : 'default'
  }
  // Render the 0 sentinel (and missing fields) as "no reading yet", not "0 B".
  let stackValue = (bytes) => (bytes ? formatBytes(bytes) : '—')
  // A historical low-water mark should never be coloured — a device that has
  // since recovered would otherwise flag red forever. Only live values tone.
  const SOFT_RESET = new Set(['sw', 'poweron', 'usb', 'jtag'])
  let resetTone = $derived(
    mem.reset_reason_name && !SOFT_RESET.has(mem.reset_reason_name) ? 'warn' : 'default',
  )
  // Humanise the reset token the firmware actually emits (sw → Software,
  // external → External pin, …). This mirrors the tokens diagnostics.cpp maps;
  // anything else — a future IDF cause the firmware doesn't name — falls through
  // to the raw string rather than a blank.
  const KNOWN_RESETS = new Set([
    'poweron', 'sw', 'external', 'panic', 'int_wdt', 'task_wdt', 'wdt',
    'deepsleep', 'brownout', 'sdio', 'usb', 'jtag', 'efuse', 'pwr_glitch', 'cpu_lockup', 'unknown',
  ])
  let resetLabel = $derived.by(() => {
    const name = mem.reset_reason_name
    if (!name) return undefined
    return KNOWN_RESETS.has(name) ? $_(`config.terminal.reset_reasons.${name}`) : name
  })
  let pct = (v) => (v == null ? '—' : `${v}%`)

  // Only probe0 (status JSON build) and probe1 (serialize + write) are wired in
  // firmware; the spare slots report 0 and are skipped until a build uses them.
  const PROBE_LABELS = { 0: 'config.terminal.probe_buildstatus', 1: 'config.terminal.probe_serialize' }
  let probes = $derived(
    [0, 1, 2, 3]
      .map((i) => ({ i, max: mem[`probe${i}_max`], n: mem[`probe${i}_n`] }))
      .filter((p) => p.n > 0),
  )

  // ── Crash core dump (fork firmware, PR #1210) ───────────────────────────
  // /debug/crash returns a decoded summary of the last captured dump; the block
  // renders only when one is present. The raw image is pulled straight from
  // flash via a plain link (esp_partition_mmap on the device — never buffered
  // in the browser), while the decoded summary can be saved as JSON for quick
  // sharing. It is a raw partition image, not an ELF: esp-coredump needs -t raw.
  let crash = $state(null)
  let pendingClear = $state(false) // confirmation dialog open
  let clearing = $state(false)

  async function loadCrash() {
    const res = await serialQueue.add(() => httpAPI('GET', '/debug/crash'))
    crash = res && res !== 'error' && res.present ? res : null
  }

  // In dev httpAPI rewrites device paths onto the /api proxy; the raw-dump link
  // is a plain anchor, so mirror that rewrite rather than hard-coding the path.
  let rawHref = $derived(import.meta.env.DEV ? '/api/debug/crash/raw' : '/debug/crash/raw')

  // The device sends addresses as pre-formatted hex strings; accept raw numbers
  // too so anything hand-rolled renders as 0x-prefixed hex and the backtrace
  // pastes cleanly into esp-coredump.
  let hex = (v) => (v == null ? '—' : typeof v === 'number' ? '0x' + v.toString(16) : String(v))

  // `bt` is an array only on Xtensa. RISC-V parts (C3, and the C6
  // co-processor) cannot unwind on device without parsing DWARF, so the
  // firmware sends the string "riscv-no-unwind" there and leaves the stack
  // walk to the host, working from the raw image.
  let backtrace = $derived(Array.isArray(crash?.bt) && crash.bt.length ? crash.bt.map(hex).join(' ') : '')
  let noUnwind = $derived(typeof crash?.bt === 'string' ? crash.bt : '')

  function downloadCrashSummary() {
    if (!crash) return
    const blob = new Blob([JSON.stringify(crash, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'coredump-summary.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000) // let Safari start the download
  }

  async function clearCrash() {
    pendingClear = false
    if (clearing) return
    clearing = true
    try {
      // Only {"msg":"erased"} means the flash erase succeeded. A failure
      // answers 500 {"msg":"error"}, which still parses as JSON — accepting
      // any object here would hide the dump while it is still on the device.
      const res = await serialQueue.add(() => httpAPI('DELETE', '/debug/crash'))
      if (res?.msg === 'erased') crash = null
      else showWriteError()
    } catch {
      showWriteError()
    } finally {
      clearing = false
    }
  }

  // Config is loaded globally, but refresh so the figures are current on visit.
  onMount(() => {
    config_store.download()
    loadCrash()
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
          {#if sd}
            <tr class="border-t border-border">
              <td class="px-3 py-2 text-text-dim">{$_('config.terminal.sd_card')}</td>
              <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(sd.size)}</td>
              <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(sd.used)}</td>
              <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(sd.free)}</td>
            </tr>
            {#if sd.log}
              <tr class="border-t border-border">
                <td class="px-3 py-2 pl-6 text-text-dim">{$_('config.terminal.sd_log')}</td>
                <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(sd.log)}</td>
                <td class="px-3 py-2 text-right font-medium text-text-dim">—</td>
                <td class="px-3 py-2 text-right font-medium text-text-dim">—</td>
              </tr>
            {/if}
          {/if}
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

  {#if memSupported}
    <ConfigSection title={$_('config.terminal.memory')}>
      <!-- Which silicon this is (firmware's espinfo, e.g. "ESP32-S3r2 2 core WiFi BLE"),
           then last restart: the first question anyone asks about a reboot. -->
      {#if chipLabel}
        <ReadOnlyRow label={$_('config.terminal.chip')} value={chipLabel} />
      {/if}
      <ReadOnlyRow
        label={$_('config.terminal.reset_reason')}
        value={resetLabel}
        tone={resetTone}
      />

      <!-- Heap: now / min table, mirroring the storage table above. The
           largest allocatable block is the number that predicts failure —
           free_heap can look healthy while it collapses into unusable fragments. -->
      <div class="mt-2 overflow-hidden rounded-xl border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-surface-3 text-text-dim">
              <th class="px-3 py-2 text-left font-medium"></th>
              <th class="px-3 py-2 text-right font-medium">{$_('config.terminal.now')}</th>
              <th class="px-3 py-2 text-right font-medium">{$_('config.terminal.min')}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-t border-border">
              <td class="px-3 py-2 text-text-dim">{$_('config.terminal.heap_largest')}</td>
              <td class="px-3 py-2 text-right font-medium {TONE_CLASS[heapTone(mem.heap_largest)]}">{formatBytes(mem.heap_largest)}</td>
              <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(mem.heap_largest_min)}</td>
            </tr>
            <tr class="border-t border-border">
              <td class="px-3 py-2 text-text-dim">{$_('config.terminal.heap_free')}</td>
              <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(mem.free_heap)}</td>
              <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(mem.heap_min)}</td>
            </tr>
            {#if mem.psram_free !== undefined}
              <!-- Boards with PSRAM (ESP32-S3 LCD). The rows above are internal DRAM only;
                   these show the external pool the network stack and TLS live in. -->
              <tr class="border-t border-border">
                <td class="px-3 py-2 text-text-dim">{$_('config.terminal.psram_free')}</td>
                <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(mem.psram_free)}</td>
                <td class="px-3 py-2 text-right font-medium text-text-dim">—</td>
              </tr>
              <tr class="border-t border-border">
                <td class="px-3 py-2 text-text-dim">{$_('config.terminal.psram_largest')}</td>
                <td class="px-3 py-2 text-right font-medium text-text">{formatBytes(mem.psram_largest)}</td>
                <td class="px-3 py-2 text-right font-medium text-text-dim">—</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>

      <h3 class="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{$_('config.terminal.stacks')}</h3>
      <ReadOnlyRow label={$_('config.terminal.stack_loop')} value={stackValue(mem.stack_loop_min)} tone={stackTone(mem.stack_loop_min)} />
      <ReadOnlyRow label={$_('config.terminal.stack_events')} value={stackValue(mem.stack_events_min)} tone={stackTone(mem.stack_events_min)} />

      <h3 class="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{$_('config.terminal.websockets')}</h3>
      <ReadOnlyRow label={$_('config.terminal.ws_conns')} value={mem.ws_conns} />
      <ReadOnlyRow label={$_('config.terminal.ws_send_max')} value={formatBytes(mem.ws_send_max)} />
      <ReadOnlyRow label={$_('config.terminal.ws_reaped')} value={mem.ws_reaped} tone={mem.ws_reaped > 0 ? 'warn' : 'default'} />

      {#if lvglSupported}
        <h3 class="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{$_('config.terminal.lvgl_pool')}</h3>
        <ReadOnlyRow label={$_('config.terminal.lv_used')} value={pct(mem.lv_used_max)} />
        <ReadOnlyRow label={$_('config.terminal.lv_frag')} value={pct(mem.lv_frag_max)} />
      {/if}

      {#if $uisettings_store?.dev_features && probes.length}
        <h3 class="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{$_('config.terminal.probes')}</h3>
        <p class="mb-1 text-xs text-text-dim">{$_('config.terminal.probes_desc')}</p>
        {#each probes as p (p.i)}
          <ReadOnlyRow
            label={$_(PROBE_LABELS[p.i] ?? 'config.terminal.probe_generic', { values: { n: p.i } })}
            value={formatBytes(p.max)}
            detail={$_('config.terminal.probe_calls', { values: { n: p.n } })}
          />
        {/each}
      {/if}
    </ConfigSection>
  {/if}

  {#if crash?.present}
    <ConfigSection title={$_('config.terminal.crash.title')}>
      <p class="mb-2 text-sm text-text-dim">{$_('config.terminal.crash.desc')}</p>

      <!-- A present dump always means the last boot crashed, so the summary
           rows tone error. panic_reason is absent on IDF 4.4 builds — fall
           back to a generic "crash detected" so the row is never blank. -->
      <ReadOnlyRow
        label={$_('config.terminal.crash.reason')}
        value={crash.panic_reason || $_('config.terminal.crash.reason_unknown')}
        tone="error"
      />
      <ReadOnlyRow label={$_('config.terminal.crash.task')} value={crash.task} />
      <ReadOnlyRow label={$_('config.terminal.crash.pc')} value={hex(crash.pc)} />
      <ReadOnlyRow label={$_('config.terminal.crash.size')} value={formatBytes(crash.size)} />

      <!-- A stored dump carries its own checksum. When it fails the decode is
           still returned, but the PC and backtrace are plausible nonsense —
           say so rather than letting them be trusted. -->
      {#if crash.valid === false}
        <ReadOnlyRow
          label={$_('config.terminal.crash.integrity')}
          value={$_('config.terminal.crash.integrity_bad')}
          tone="warn"
          detail={$_('config.terminal.crash.integrity_detail')}
        />
      {/if}

      {#if backtrace}
        <h3 class="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{$_('config.terminal.crash.backtrace')}</h3>
        <div class="overflow-x-auto rounded-xl bg-surface-3 p-3 font-mono text-xs text-text">{backtrace}</div>
      {:else if noUnwind}
        <p class="mt-3 text-xs text-text-dim">{$_('config.terminal.crash.no_unwind')}</p>
      {/if}

      {#if crash.elf_sha256}
        <h3 class="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">{$_('config.terminal.crash.elf')}</h3>
        <p class="mb-1 text-xs text-text-dim">{$_('config.terminal.crash.elf_detail')}</p>
        <div class="overflow-x-auto rounded-xl bg-surface-3 p-2 font-mono text-xs text-text-dim break-all">{crash.elf_sha256}</div>
      {/if}

      <div class="mt-4 flex flex-col gap-2">
        <a
          href={rawHref}
          download="coredump.bin"
          class="w-full rounded-2xl bg-accent px-4 py-3 text-center text-sm font-semibold text-surface transition"
        >{$_('config.terminal.crash.download')}</a>
        <div class="flex gap-2">
          <Button label={$_('config.terminal.crash.download_summary')} variant="ghost" onclick={downloadCrashSummary} />
          <Button label={$_('config.terminal.crash.clear')} variant="ghost" onclick={() => (pendingClear = true)} />
        </div>
      </div>
    </ConfigSection>
  {/if}

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

<!-- Clear core dump confirmation -->
<Modal visible={pendingClear} onclose={() => (pendingClear = false)}>
  <h2 class="mb-2 text-base font-semibold text-text">{$_('config.terminal.crash.clear_confirm_title')}</h2>
  <p class="mb-4 text-sm text-text-dim">{$_('config.terminal.crash.clear_confirm_body')}</p>
  <div class="flex gap-2">
    <Button label={$_('config.terminal.crash.clear_confirm_yes')} disabled={clearing} onclick={clearCrash} />
    <Button label={$_('config.terminal.crash.clear_confirm_no')} variant="ghost" onclick={() => (pendingClear = false)} />
  </div>
</Modal>
