// src/routes/settings/__tests__/Terminal.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))
// Only the error toast is stubbed; the rest of the alert helpers stay real.
vi.mock('../../../lib/alerts.js', async (importOriginal) => ({
  ...(await importOriginal()),
  showWriteError: vi.fn(),
}))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { showWriteError } from '../../../lib/alerts.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import Terminal from '../Terminal.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ cmd: '$GE', ret: '$OK 0 0^20' })
  showWriteError.mockClear()
})

describe('Terminal page', () => {
  it('sends a RAPI command and shows the result', async () => {
    const { getByLabelText, getByText } = render(Terminal)
    const input = getByLabelText('config.terminal.command')
    await fireEvent.input(input, { target: { value: '$GE' } })
    await fireEvent.click(getByText('config.terminal.send'))
    expect(httpAPI).toHaveBeenCalledWith('GET', '/r?json=1&rapi=$GE')
    await vi.waitFor(() => {
      expect(getByText(/\$OK 0 0\^20/)).toBeInTheDocument()
    })
  })

  it('sends the command when Enter is pressed in the input', async () => {
    const { getByLabelText } = render(Terminal)
    const input = getByLabelText('config.terminal.command')
    await fireEvent.input(input, { target: { value: '$GE' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(httpAPI).toHaveBeenCalledWith('GET', '/r?json=1&rapi=$GE')
  })

  it('does not send when the input is empty or only the "$" prefix', async () => {
    const { getByLabelText, getByText } = render(Terminal)
    const input = getByLabelText('config.terminal.command')

    // Default "$" only — Enter and Send must both be no-ops.
    await fireEvent.keyDown(input, { key: 'Enter' })
    await fireEvent.click(getByText('config.terminal.send'))

    await fireEvent.input(input, { target: { value: '   ' } })
    await fireEvent.keyDown(input, { key: 'Enter' })

    // The page fetches /config on mount for the storage panel, so assert the
    // RAPI send specifically stayed a no-op rather than that nothing was called.
    expect(httpAPI).not.toHaveBeenCalledWith('GET', expect.stringContaining('/r?'))
  })

  it('clears the RAPI result log', async () => {
    const { getByLabelText, getByText, queryByText } = render(Terminal)
    await fireEvent.input(getByLabelText('config.terminal.command'), { target: { value: '$GE' } })
    await fireEvent.click(getByText('config.terminal.send'))
    await vi.waitFor(() => expect(queryByText(/\$OK/)).toBeInTheDocument())
    await fireEvent.click(getByText('config.terminal.clear'))
    expect(queryByText(/\$OK/)).not.toBeInTheDocument()
  })

  it('shows the Expand-to-16MB button only when the gateway reports it', async () => {
    httpAPI.mockImplementation((method, url) =>
      Promise.resolve(url === '/config' ? { can_expand_16mb: true, espflash: 16777216 } : { cmd: '', ret: '' }),
    )
    const { findByText } = render(Terminal)
    expect(await findByText('config.terminal.expand16mb_button')).toBeInTheDocument()
  })

  it('hides the Expand-to-16MB button when not eligible', async () => {
    httpAPI.mockImplementation((method, url) =>
      Promise.resolve(url === '/config' ? { can_expand_16mb: false } : { cmd: '', ret: '' }),
    )
    const { queryByText } = render(Terminal)
    await vi.waitFor(() =>
      expect(queryByText('config.terminal.expand16mb_button')).not.toBeInTheDocument(),
    )
  })
})

describe('Terminal — Memory & health', () => {
  // A healthy fork-firmware /status snapshot; individual tests override fields.
  const MEM = {
    heap_largest: 45000, heap_largest_min: 30000, free_heap: 77000, heap_min: 60000,
    stack_loop_min: 2048, stack_events_min: 3000,
    ws_conns: 2, ws_send_max: 4096, ws_reaped: 0,
    reset_reason_name: 'sw', reset_reason: 3,
  }

  beforeEach(() => {
    status_store.set({})
    config_store.update((c) => ({ ...c, labs_enabled: false }))
  })

  it('renders the section when heap_largest is present', () => {
    status_store.set({ ...MEM })
    const { getByText } = render(Terminal)
    expect(getByText('config.terminal.memory')).toBeInTheDocument()
    expect(getByText('config.terminal.reset_reason')).toBeInTheDocument()
    expect(getByText('config.terminal.ws_conns')).toBeInTheDocument()
  })

  it('adds microSD rows to the storage table only when a card is mounted', () => {
    config_store.set({ espflash: 16777216, sd_size: 31914983424, sd_used: 33554432, sd_log_size: 33554432 })
    const { getByText } = render(Terminal)
    expect(getByText('config.terminal.sd_card')).toBeInTheDocument()
    expect(getByText('config.terminal.sd_log')).toBeInTheDocument()
    config_store.set({ espflash: 16777216 })
  })

  it('offers to format a mounted card and POSTs after confirmation', async () => {
    config_store.set({ espflash: 16777216, sd_size: 31914983424, sd_used: 33554432, sd_log_size: 33554432 })
    status_store.set({ sd_status: 'mounted' })
    httpAPI.mockResolvedValue({ msg: 'started' })
    const { getByText } = render(Terminal)
    await fireEvent.click(getByText('config.terminal.sd_format_button'))
    await fireEvent.click(getByText('config.terminal.sd_format_confirm_yes'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/sdcard/format', '{}')
    config_store.set({ espflash: 16777216 })
    status_store.set({})
  })

  it('shows the format phase from sd_status while the card is unmounted', () => {
    config_store.set({ espflash: 16777216 })
    status_store.set({ sd_status: 'creating log' })
    const { getByText, queryByText } = render(Terminal)
    expect(getByText('config.terminal.sd_format_phase_creating')).toBeInTheDocument()
    expect(queryByText('config.terminal.sd_format_button')).not.toBeInTheDocument()
    status_store.set({})
  })

  it('omits the microSD rows without sd_size', () => {
    config_store.set({ espflash: 16777216 })
    const { queryByText } = render(Terminal)
    expect(queryByText('config.terminal.sd_card')).not.toBeInTheDocument()
    config_store.set({})
  })

  it('falls back to espinfo for the chip row on older firmware', () => {
    config_store.set({ espinfo: 'ESP32-S3r2 2 core WiFi BLE' })
    status_store.set({ ...MEM })
    const { getByText } = render(Terminal)
    expect(getByText('config.terminal.chip')).toBeInTheDocument()
    expect(getByText('ESP32-S3r2 2 core WiFi BLE')).toBeInTheDocument()
    config_store.set({})
  })

  it('composes the chip row from the structured fields when present', () => {
    config_store.set({ espinfo: 'ESP32-S3r2 2 core WiFi BLE', chip_model: 'ESP32-S3', chip_rev: 2,
      chip_cores: 2, espflash: 16777216, psram_size: 8388608 })
    status_store.set({ ...MEM })
    const { getByText, queryByText } = render(Terminal)
    // $_ is mocked to echo its key, so the three translated parts show as keys.
    expect(getByText('ESP32-S3 v0.2 · config.terminal.chip_cores · config.terminal.chip_flash · config.terminal.chip_psram')).toBeInTheDocument()
    expect(queryByText('ESP32-S3r2 2 core WiFi BLE')).not.toBeInTheDocument()
    config_store.set({})
  })

  it('shows PSRAM rows only when the firmware reports psram_free', () => {
    status_store.set({ ...MEM, psram_free: 8294468, psram_largest: 8257524 })
    const { getByText } = render(Terminal)
    expect(getByText('config.terminal.psram_free')).toBeInTheDocument()
    expect(getByText('config.terminal.psram_largest')).toBeInTheDocument()
  })

  it('omits the PSRAM rows on boards without PSRAM', () => {
    status_store.set({ ...MEM })
    const { queryByText } = render(Terminal)
    expect(queryByText('config.terminal.psram_free')).not.toBeInTheDocument()
  })

  it('names the IDF 5 USB reset without a warning tone', () => {
    status_store.set({ ...MEM, reset_reason_name: 'usb', reset_reason: 11 })
    const { getByText } = render(Terminal)
    expect(getByText('config.terminal.reset_reasons.usb')).toBeInTheDocument()
  })

  it('omits the whole section when heap_largest is absent', () => {
    status_store.set({ free_heap: 77000 }) // upstream ships free_heap but not heap_largest
    const { queryByText } = render(Terminal)
    expect(queryByText('config.terminal.memory')).not.toBeInTheDocument()
  })

  it('gates the LVGL rows on lv_used_max, independent of the heap gate', () => {
    status_store.set({ ...MEM }) // heap present, no lv_used_max
    const { queryByText, rerender } = render(Terminal)
    expect(queryByText('config.terminal.lvgl_pool')).not.toBeInTheDocument()

    status_store.set({ ...MEM, lv_used_max: 30, lv_frag_max: 5 })
    rerender({})
    expect(queryByText('config.terminal.lvgl_pool')).toBeInTheDocument()
    // Percent, not run through formatBytes.
    expect(queryByText('30%')).toBeInTheDocument()
    expect(queryByText('30 B')).not.toBeInTheDocument()
  })

  it('hides the probe block with Labs off and shows it with Labs on', async () => {
    status_store.set({ ...MEM, probe0_max: 8000, probe0_n: 120 })
    const { queryByText, rerender } = render(Terminal)
    expect(queryByText('config.terminal.probes')).not.toBeInTheDocument()

    config_store.update((c) => ({ ...c, labs_enabled: true }))
    rerender({})
    expect(queryByText('config.terminal.probes')).toBeInTheDocument()
    expect(queryByText('config.terminal.probe_buildstatus')).toBeInTheDocument()
  })

  it('tones the largest free block error below 12 KB and updates live', async () => {
    status_store.set({ ...MEM }) // 45000 → healthy
    const { findByText, queryByText } = render(Terminal)
    expect(queryByText('10.7 KB')).not.toBeInTheDocument()

    // A websocket push drops it into the danger zone — no refetch involved.
    status_store.set({ ...MEM, heap_largest: 11000 })
    const cell = await findByText('10.7 KB')
    expect(cell.className).toContain('text-error')
  })

  it('warns on reaped connections but never on the historical low-water mark', () => {
    status_store.set({ ...MEM, ws_reaped: 7 })
    const { getByText } = render(Terminal)
    expect(getByText('7').className).toContain('text-warning')
  })

  it('humanises a known reset reason and falls back to the raw token otherwise', () => {
    status_store.set({ ...MEM, reset_reason_name: 'panic' })
    const { getByText, queryByText, rerender } = render(Terminal)
    // The i18n mock echoes keys, so a mapped token routes through reset_reasons.*
    expect(getByText('config.terminal.reset_reasons.panic')).toBeInTheDocument()

    // An unmapped token from a newer IDF shows verbatim, not a missing key.
    status_store.set({ ...MEM, reset_reason_name: 'brand_new_token' })
    rerender({})
    expect(getByText('brand_new_token')).toBeInTheDocument()
    expect(queryByText('config.terminal.reset_reasons.brand_new_token')).not.toBeInTheDocument()
  })

  it('maps the external-pin token the firmware actually emits', () => {
    // Firmware returns "external" (not "ext") for ESP_RST_EXT — must route
    // through reset_reasons.external, not fall through to the raw token.
    status_store.set({ ...MEM, reset_reason_name: 'external' })
    const { getByText } = render(Terminal)
    expect(getByText('config.terminal.reset_reasons.external')).toBeInTheDocument()
  })

  it('treats an unsampled stack (0 sentinel) as no reading, not a warning', () => {
    // Fresh boot: diagnostics maps its UINT32_MAX "never sampled" to 0.
    status_store.set({ ...MEM, stack_loop_min: 0, stack_events_min: 0 })
    const { container, getByText } = render(Terminal)
    // Nothing on the page warns — the healthy heap/ws figures don't, and the
    // 0-stacks must not either.
    expect(container.querySelector('.text-warning')).toBeNull()
    // The rows read "no reading" (—), not "0 B".
    const loop = getByText('config.terminal.stack_loop').parentElement
    expect(loop.querySelector('span:last-child').textContent.trim()).toBe('—')
  })

  it('warns on a genuine sub-1KB stack reading', () => {
    status_store.set({ ...MEM, stack_loop_min: 512 })
    const { getByText } = render(Terminal)
    expect(getByText('512 B').className).toContain('text-warning')
  })
})

const RID = '0123456789abcdef0123456789abcdef'

describe('Terminal — Crash core dump', () => {
  // Mirrors the device: addresses arrive as pre-formatted hex strings.
  const CRASH = {
    present: true, valid: true, size: 65536,
    panic_reason: 'Task watchdog got triggered', task: 'loopTask',
    pc: '0x400d4b38', bt: ['0x400d4b38', '0x400d1a42'], elf_sha256: 'abc123def456',
  }

  // Route /debug/crash to the given summary; DELETE answers `del` (the
  // firmware's success body by default); everything else is a benign stub.
  function mockCrash(summary, del = { msg: 'erased' }) {
    httpAPI.mockImplementation((method, url) => {
      if (url !== '/debug/crash') return Promise.resolve({ cmd: '', ret: '' })
      return Promise.resolve(method === 'DELETE' ? del : summary)
    })
  }

  beforeEach(() => {
    status_store.set({})
  })

  it('renders the section with a raw-dump download link when a dump is present', async () => {
    mockCrash(CRASH)
    const { findByText, getByText } = render(Terminal)
    expect(await findByText('config.terminal.crash.title')).toBeInTheDocument()
    expect(getByText('Task watchdog got triggered')).toBeInTheDocument()
    expect(getByText('loopTask')).toBeInTheDocument()
    expect(getByText('0x400d4b38 0x400d1a42')).toBeInTheDocument()

    const link = getByText('config.terminal.crash.download')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toContain('/debug/crash/raw')
    expect(link.getAttribute('download')).toBe('coredump.bin')
  })

  it('omits the section when no dump is present', async () => {
    mockCrash({ present: false })
    const { queryByText } = render(Terminal)
    // Let the on-mount fetch resolve before asserting absence.
    await vi.waitFor(() => expect(httpAPI).toHaveBeenCalledWith('GET', '/debug/crash'))
    expect(queryByText('config.terminal.crash.title')).not.toBeInTheDocument()
  })

  it('falls back to a generic reason when panic_reason is absent (IDF 4.4)', async () => {
    mockCrash({ present: true, task: 'loopTask', pc: '0x00000000', bt: [] })
    const { findByText } = render(Terminal)
    expect(await findByText('config.terminal.crash.reason_unknown')).toBeInTheDocument()
  })

  it('renders the no-unwind note instead of a backtrace on RISC-V', async () => {
    // RISC-V parts send `bt` as a string, not an array — mapping over it would
    // throw and take the whole page down.
    mockCrash({ ...CRASH, bt: 'riscv-no-unwind', mcause: '0x0000000b' })
    const { findByText, queryByText } = render(Terminal)
    expect(await findByText('config.terminal.crash.no_unwind')).toBeInTheDocument()
    expect(queryByText('config.terminal.crash.backtrace')).not.toBeInTheDocument()
  })

  it('warns when the stored dump fails its checksum', async () => {
    mockCrash({ ...CRASH, valid: false, check_err: -1 })
    const { findByText } = render(Terminal)
    expect(await findByText('config.terminal.crash.integrity_bad')).toBeInTheDocument()
  })

  it('clears the dump after confirmation and hides the section', async () => {
    mockCrash(CRASH)
    const { findByText, getByText, queryByText } = render(Terminal)
    await findByText('config.terminal.crash.title')

    // Open the confirm dialog, then confirm — DELETE goes to /debug/crash.
    await fireEvent.click(getByText('config.terminal.crash.clear'))
    await fireEvent.click(getByText('config.terminal.crash.clear_confirm_yes'))
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/debug/crash')
    await vi.waitFor(() =>
      expect(queryByText('config.terminal.crash.title')).not.toBeInTheDocument(),
    )
  })

  it('keeps the section and reports an error when the erase fails', async () => {
    // A failed erase answers 500 {"msg":"error"}, which still parses as JSON —
    // accepting any object would hide a dump that is still on the device.
    mockCrash(CRASH, { msg: 'error' })
    const { findByText, getByText } = render(Terminal)
    await findByText('config.terminal.crash.title')

    await fireEvent.click(getByText('config.terminal.crash.clear'))
    await fireEvent.click(getByText('config.terminal.crash.clear_confirm_yes'))
    await vi.waitFor(() => expect(showWriteError).toHaveBeenCalled())
    expect(getByText('config.terminal.crash.title')).toBeInTheDocument()
  })

})

// Crash reporting: the browser sends the report to OpenEVSE itself. The
// charger only builds it (GET /debug/crash/report) and keeps the reporter
// identity (/debug/crash/identity); the broker is reached with fetch().
describe('Terminal — Crash reporting', () => {
  const BROKER = 'https://broker.test'
  const KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
  const CRASH = { present: true, valid: true, size: 65536, panic_reason: 'abort()', task: 'loopTask',
                  pc: '0x400d4b38', bt: ['0x400d4b38'], elf_sha256: 'abc123def' }
  const REPORT = { version: 'master_12345678', summary: { panic_reason: 'abort()' }, reporter_id: RID }

  let identity   // what GET /debug/crash/identity answers
  let calls      // device calls, as "METHOD url"
  let posted     // bodies POSTed to the device, by url
  let crash      // current /debug/crash answer

  // `id` is the stored identity; GET returns its delete key only with ?key=1.
  function device({ id = { reporter_id: RID, delete_key: KEY, broker: BROKER },
                    dump = CRASH, report = { status: 200, body: REPORT },
                    eraseStatus = 200, forgetStatus = 200, storeStatus = 200, raced = null } = {}) {
    identity = id
    crash = dump
    calls = []
    posted = {}
    httpAPI.mockImplementation((method, url, body, _type, _timeout, opts = {}) => {
      calls.push(method + ' ' + url)
      if (body) posted[url] = body
      const reply = (status, b) => Promise.resolve(opts.raw ? { status, body: b } : b)
      if (url === '/debug/crash') {
        if (method === 'DELETE') {
          if (eraseStatus !== 200) return reply(eraseStatus, { msg: 'error' })
          crash = { present: false }
          return reply(200, { msg: 'erased' })
        }
        return reply(200, crash)
      }
      if (url.startsWith('/debug/crash/identity')) {
        if (identity === 'error') return Promise.resolve('error')
        if (method === 'POST') {
          // Another tab got there first: the charger keeps that identity.
          if (raced) { identity = { ...identity, ...raced }; return reply(409, { msg: 'a different identity is already set' }) }
          if (storeStatus !== 200) return reply(storeStatus, { msg: 'error' })
          const b = JSON.parse(body)
          identity = { ...identity, reporter_id: b.reporter_id, delete_key: b.delete_key }
          return reply(200, { msg: 'stored' })
        }
        if (method === 'DELETE') {
          if (forgetStatus !== 200) return reply(forgetStatus, { msg: 'error' })
          identity = { ...identity, reporter_id: null, delete_key: null }
          return reply(200, { msg: 'forgotten' })
        }
        const { delete_key, ...rest } = identity
        return reply(200, url.endsWith('?key=1') ? identity : rest)
      }
      if (url === '/debug/crash/report') return reply(report.status, report.body)
      return reply(200, { cmd: '', ret: '' })
    })
  }

  // The broker, as fetch() sees it. `answer` is a function of (url, init).
  let broker
  function brokerAnswers(answer) {
    broker = vi.fn(answer)
    vi.stubGlobal('fetch', broker)
  }
  const ok = (body) => () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })

  beforeEach(() => {
    status_store.set({})
    brokerAnswers(ok({ report_id: 'r-1', status: 'symbolized', deleted: 2 }))
  })
  afterEach(() => vi.unstubAllGlobals())

  async function send(utils) {
    await fireEvent.click(await utils.findByText('config.terminal.crash.upload'))
    await fireEvent.click(utils.getByText('config.terminal.crash.upload_confirm_yes'))
  }

  it('sends only after the warning is confirmed, from the browser, then erases the dump', async () => {
    device()
    const utils = render(Terminal)
    await fireEvent.click(await utils.findByText('config.terminal.crash.upload'))
    // What goes, what stays, for how long: one fact per point.
    for (const k of ['upload_confirm_sent', 'upload_confirm_not_sent', 'upload_confirm_kept', 'upload_confirm_removed']) {
      expect(utils.getByText('config.terminal.crash.' + k).closest('li'), k).not.toBeNull()
    }
    expect(broker).not.toHaveBeenCalled()
    await fireEvent.click(utils.getByText('config.terminal.crash.upload_confirm_yes'))
    expect(await utils.findByText('config.terminal.crash.upload_done')).toBeInTheDocument()
    const [url, init] = broker.mock.calls[0]
    expect(url).toBe(BROKER + '/v1/reports')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(REPORT)
    // Only once the broker has it.
    expect(calls).toContain('DELETE /debug/crash')
    expect(calls.indexOf('DELETE /debug/crash')).toBeGreaterThan(calls.indexOf('GET /debug/crash/report'))
  })

  it('creates a random identity in the browser and stores it before the first report', async () => {
    device({ id: { reporter_id: null, delete_key: null, broker: BROKER } })
    const utils = render(Terminal)
    await send(utils)
    await utils.findByText('config.terminal.crash.upload_done')
    const stored = JSON.parse(posted['/debug/crash/identity'])
    expect(stored.reporter_id).toMatch(/^[0-9a-f]{32}$/)
    expect(stored.delete_key).toMatch(/^[0-9a-f]{64}$/)
    expect(calls.indexOf('POST /debug/crash/identity')).toBeLessThan(calls.indexOf('GET /debug/crash/report'))
    // And Delete is offered straight away, under that id.
    expect(await utils.findByText(stored.reporter_id)).toBeInTheDocument()
    expect(utils.getByText('config.terminal.crash.forget')).toBeInTheDocument()
  })

  it('two new identities are never the same', async () => {
    const seen = new Set()
    for (let i = 0; i < 2; i++) {
      device({ id: { reporter_id: null, delete_key: null, broker: BROKER } })
      const utils = render(Terminal)
      await send(utils)
      await utils.findByText('config.terminal.crash.upload_done')
      seen.add(JSON.parse(posted['/debug/crash/identity']).delete_key)
      utils.unmount()
    }
    expect(seen.size).toBe(2)
  })

  it('shows nothing on firmware without crash reporting', async () => {
    device({ id: 'error' })
    const utils = render(Terminal)
    await utils.findByText('config.terminal.crash.title')
    await new Promise((r) => setTimeout(r, 0))
    expect(utils.queryByText('config.terminal.crash.upload')).not.toBeInTheDocument()
    expect(utils.queryByText('config.terminal.crash.reporting_title')).not.toBeInTheDocument()
  })

  it('says when this browser cannot reach OpenEVSE, and keeps the dump', async () => {
    // A phone on the charger's own hotspot has no internet.
    device()
    brokerAnswers(() => Promise.reject(new TypeError('Failed to fetch')))
    const utils = render(Terminal)
    await send(utils)
    expect(await utils.findByText('config.terminal.crash.upload_unreachable')).toBeInTheDocument()
    expect(calls).not.toContain('DELETE /debug/crash')
    expect(utils.getByText('config.terminal.crash.upload')).toBeInTheDocument()
  })

  it('reports a refused upload, and keeps the dump to try again', async () => {
    device()
    brokerAnswers(() => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) }))
    const utils = render(Terminal)
    await send(utils)
    expect(await utils.findByText('config.terminal.crash.upload_failed')).toBeInTheDocument()
    expect(calls).not.toContain('DELETE /debug/crash')
  })

  it('sends nothing when the charger cannot build the report', async () => {
    device({ report: { status: 409, body: { msg: 'no reporter identity' } } })
    const utils = render(Terminal)
    await send(utils)
    expect(await utils.findByText('config.terminal.crash.upload_failed')).toBeInTheDocument()
    expect(broker).not.toHaveBeenCalled()
  })

  it('puts Send in the Crash reporting card, not in the dump card', async () => {
    device()
    const { findByText } = render(Terminal)
    const upload = await findByText('config.terminal.crash.upload')
    const dumpCard = (await findByText('config.terminal.crash.title')).parentElement
    const reportCard = (await findByText('config.terminal.crash.reporting_title')).parentElement
    expect(dumpCard.contains(upload)).toBe(false)
    expect(reportCard.contains(upload)).toBe(true)
    expect(reportCard.textContent).toContain(RID)
  })

  it('offers no deletion until this charger has an identity', async () => {
    device({ id: { reporter_id: null, delete_key: null, broker: BROKER }, dump: { present: false } })
    const { queryByText, findByText } = render(Terminal)
    await findByText('config.terminal.labs')
    await new Promise((r) => setTimeout(r, 0))
    expect(queryByText('config.terminal.crash.forget')).not.toBeInTheDocument()
  })

  it('shows the reporter id with no dump stored, and deletes from the browser after confirming', async () => {
    device({ dump: { present: false } })
    const utils = render(Terminal)
    const id = await utils.findByText(RID)
    expect(id.parentElement.textContent).toContain('config.terminal.crash.forget_reporter_id_label')
    await fireEvent.click(utils.getByText('config.terminal.crash.forget'))
    for (const k of ['forget_confirm_now', 'forget_confirm_unlinked']) {
      expect(utils.getByText('config.terminal.crash.' + k).closest('li'), k).not.toBeNull()
    }
    expect(broker).not.toHaveBeenCalled()
    await fireEvent.click(utils.getByText('config.terminal.crash.forget_confirm_yes'))
    expect(await utils.findByText('config.terminal.crash.forget_done')).toBeInTheDocument()
    const [url, init] = broker.mock.calls[0]
    expect(url).toBe(`${BROKER}/v1/reporters/${RID}/delete`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ delete_key: KEY })
    // The identity goes only after the broker has erased the reports.
    expect(calls).toContain('DELETE /debug/crash/identity')
    expect(utils.queryByText(RID)).not.toBeInTheDocument()
  })

  it('keeps the identity when the broker cannot be reached, so Delete can be retried', async () => {
    device({ dump: { present: false } })
    brokerAnswers(() => Promise.reject(new TypeError('Failed to fetch')))
    const utils = render(Terminal)
    await fireEvent.click(await utils.findByText('config.terminal.crash.forget'))
    await fireEvent.click(utils.getByText('config.terminal.crash.forget_confirm_yes'))
    expect(await utils.findByText('config.terminal.crash.forget_unreachable')).toBeInTheDocument()
    expect(calls).not.toContain('DELETE /debug/crash/identity')
    expect(utils.getByText(RID)).toBeInTheDocument()
  })

  it('keeps the identity when the broker refuses the deletion', async () => {
    device({ dump: { present: false } })
    brokerAnswers(() => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) }))
    const utils = render(Terminal)
    await fireEvent.click(await utils.findByText('config.terminal.crash.forget'))
    await fireEvent.click(utils.getByText('config.terminal.crash.forget_confirm_yes'))
    expect(await utils.findByText('config.terminal.crash.forget_failed')).toBeInTheDocument()
    expect(calls).not.toContain('DELETE /debug/crash/identity')
  })

  it('fetches the delete key only when Delete is pressed', async () => {
    // It erases this charger's reports; it is not needed to show the page or
    // to send one, so it is not on the wire until it is.
    device()
    const utils = render(Terminal)
    await send(utils)
    await utils.findByText('config.terminal.crash.upload_done')
    expect(calls.some((c) => c.includes('?key='))).toBe(false)
    await fireEvent.click(utils.getByText('config.terminal.crash.forget'))
    await fireEvent.click(utils.getByText('config.terminal.crash.forget_confirm_yes'))
    await utils.findByText('config.terminal.crash.forget_done')
    expect(calls).toContain('GET /debug/crash/identity?key=1')
  })

  it('says so when the report was sent but the charger could not remove its copy', async () => {
    // Saying "removed" here would invite sending the same report again.
    device({ eraseStatus: 500 })
    const utils = render(Terminal)
    await send(utils)
    expect(await utils.findByText('config.terminal.crash.upload_not_erased')).toBeInTheDocument()
    expect(utils.queryByText('config.terminal.crash.upload_done')).not.toBeInTheDocument()
  })

  it('says so when the reports were erased but the charger kept its id, and offers Delete again', async () => {
    // Otherwise the next report would quietly reuse the old id, linking it to
    // the erased ones. Deleting again is safe: nothing is left to erase.
    device({ dump: { present: false }, forgetStatus: 500 })
    const utils = render(Terminal)
    await fireEvent.click(await utils.findByText('config.terminal.crash.forget'))
    await fireEvent.click(utils.getByText('config.terminal.crash.forget_confirm_yes'))
    expect(await utils.findByText('config.terminal.crash.forget_not_forgotten')).toBeInTheDocument()
    expect(utils.queryByText('config.terminal.crash.forget_done')).not.toBeInTheDocument()
    expect(utils.getByText(RID)).toBeInTheDocument()
    expect(utils.getByText('config.terminal.crash.forget')).toBeInTheDocument()
  })

  it('a tab that lost the race to set the identity carries on with the stored one', async () => {
    const OTHER = 'fedcba9876543210fedcba9876543210'
    device({ id: { reporter_id: null, delete_key: null, broker: BROKER },
             raced: { reporter_id: OTHER, delete_key: KEY } })
    const utils = render(Terminal)
    await send(utils)
    expect(await utils.findByText('config.terminal.crash.upload_done')).toBeInTheDocument()
    expect(utils.getByText(OTHER)).toBeInTheDocument()
  })

  it('reports a failure when the charger cannot store the identity', async () => {
    device({ id: { reporter_id: null, delete_key: null, broker: BROKER }, storeStatus: 500 })
    const utils = render(Terminal)
    await send(utils)
    expect(await utils.findByText('config.terminal.crash.upload_failed')).toBeInTheDocument()
    expect(broker).not.toHaveBeenCalled()
  })
})

describe('Terminal — OpenEVSE Labs', () => {
  beforeEach(() => config_store.set({ labs_enabled: false }))

  it('lists the Labs features, linking them only once Labs is on', async () => {
    const { getByText, getByRole } = render(Terminal)
    const name = getByText('config.terminal.labs_features.loadsharing')
    expect(name.closest('a')).toBeNull()

    httpAPI.mockResolvedValue({ msg: 'done' })
    await fireEvent.click(getByRole('switch', { name: 'config.terminal.labs_enable' }))
    // Saved on the device, not in browser localStorage.
    await vi.waitFor(() =>
      expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ labs_enabled: true })),
    )
    await vi.waitFor(() =>
      expect(getByText('config.terminal.labs_features.loadsharing').closest('a'))
        .toHaveAttribute('href', '#/settings/loadsharing'),
    )
    expect(showWriteError).not.toHaveBeenCalled()
  })

  it('surfaces a failed save', async () => {
    const { getByRole } = render(Terminal)
    httpAPI.mockResolvedValue({ msg: 'error' })
    await fireEvent.click(getByRole('switch', { name: 'config.terminal.labs_enable' }))
    await vi.waitFor(() => expect(showWriteError).toHaveBeenCalled())
  })
})
