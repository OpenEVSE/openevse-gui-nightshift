// src/routes/settings/__tests__/Terminal.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
import { uisettings_store } from '../../../lib/stores/uisettings.js'
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
    uisettings_store.update((s) => ({ ...s, dev_features: false }))
  })

  it('renders the section when heap_largest is present', () => {
    status_store.set({ ...MEM })
    const { getByText } = render(Terminal)
    expect(getByText('config.terminal.memory')).toBeInTheDocument()
    expect(getByText('config.terminal.reset_reason')).toBeInTheDocument()
    expect(getByText('config.terminal.ws_conns')).toBeInTheDocument()
  })

  it('shows the chip row from config espinfo above the reset reason', () => {
    config_store.set({ espinfo: 'ESP32-S3r2 2 core WiFi BLE' })
    status_store.set({ ...MEM })
    const { getByText } = render(Terminal)
    expect(getByText('config.terminal.chip')).toBeInTheDocument()
    expect(getByText('ESP32-S3r2 2 core WiFi BLE')).toBeInTheDocument()
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

    uisettings_store.update((s) => ({ ...s, dev_features: true }))
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
