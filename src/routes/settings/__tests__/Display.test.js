// src/routes/settings/__tests__/Display.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Display from '../Display.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

describe('Display page', () => {
  it('shows the Dark/Light selector with the current theme active', () => {
    config_store.set({ tft_theme: 'dark' })
    const { getByText } = render(Display)
    expect(getByText('config.display.dark')).toHaveAttribute('aria-pressed', 'true')
    expect(getByText('config.display.light')).toHaveAttribute('aria-pressed', 'false')
  })

  it('hides the TFT section entirely when tft_theme is absent', () => {
    // A charger with the 2-line character LCD and no TFT reaches this page
    // through lcd_type; showing it a theme and clock for a panel it lacks
    // would be a lie.
    config_store.set({ lcd_type: 'rgb' })
    const { queryByText, getByText } = render(Display)
    expect(queryByText('config.display.dark')).toBeNull()
    expect(queryByText('config.display.clock_24')).toBeNull()
    expect(getByText('config.display.lcd_rgb')).toHaveAttribute('aria-pressed', 'true')
  })

  it('writes tft_theme to /config when a theme is picked', async () => {
    config_store.set({ tft_theme: 'dark' })
    const { getByText } = render(Display)
    await fireEvent.click(getByText('config.display.light'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ tft_theme: 'light' }))
  })

  it('hides brightness, timeout and LCD controls when their keys are absent', () => {
    config_store.set({ tft_theme: 'dark' })
    const { queryByLabelText, queryByText } = render(Display)
    expect(queryByLabelText('config.display.brightness')).toBeNull()
    expect(queryByLabelText('config.display.standby')).toBeNull()
    expect(queryByLabelText('config.display.timeout')).toBeNull()
    expect(queryByText('config.display.lcd_mono')).toBeNull()
    expect(queryByText('config.display.lcd')).toBeNull()
  })

  it('shows both sections when a device reports both displays', () => {
    config_store.set({ tft_theme: 'dark', lcd_type: 'mono' })
    const { getByText } = render(Display)
    expect(getByText('config.display.panel')).toBeInTheDocument()
    expect(getByText('config.display.lcd')).toBeInTheDocument()
    expect(getByText('config.display.lcd_mono')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the backlight timeout in the LCD section on an LCD-only charger', async () => {
    // Issue #8: the char-LCD driver honours lcd_backlight_timeout too, so a
    // classic V6 with no TFT gets the same slider, described for a backlight
    // that switches off rather than dims.
    config_store.set({ lcd_type: 'rgb', lcd_backlight_timeout: 300 })
    const { getByLabelText, getByText, queryByText } = render(Display)
    const slider = getByLabelText('config.display.timeout')
    expect(slider).toHaveValue('300')
    expect(getByText('config.display.lcd_timeout_desc')).toBeInTheDocument()
    expect(queryByText('config.display.timeout_desc')).toBeNull()
    await fireEvent.change(slider, { target: { value: '120' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ lcd_backlight_timeout: 120 }))
  })

  it('hides the backlight timeout on an LCD-only charger whose firmware lacks the key', () => {
    config_store.set({ lcd_type: 'rgb' })
    const { queryByLabelText } = render(Display)
    expect(queryByLabelText('config.display.timeout')).toBeNull()
  })

  it('shows the timeout once, in the TFT section, when a device has both displays', () => {
    config_store.set({ tft_theme: 'dark', lcd_type: 'rgb', lcd_backlight_timeout: 600 })
    const { getAllByLabelText, getByText, queryByText } = render(Display)
    expect(getAllByLabelText('config.display.timeout')).toHaveLength(1)
    expect(getByText('config.display.timeout_desc')).toBeInTheDocument()
    expect(queryByText('config.display.lcd_timeout_desc')).toBeNull()
  })

  it('defaults the 2-line LCD selector to RGB and writes on change', async () => {
    config_store.set({ lcd_type: 'rgb' })
    const { getByText } = render(Display)
    expect(getByText('config.display.lcd_rgb')).toHaveAttribute('aria-pressed', 'true')
    expect(getByText('config.display.lcd_mono')).toHaveAttribute('aria-pressed', 'false')
    await fireEvent.click(getByText('config.display.lcd_mono'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ lcd_type: 'mono' }))
  })

  it('renders the active brightness slider at the current value and writes on change', async () => {
    config_store.set({ tft_theme: 'dark', tft_brightness: 60 })
    const { getByLabelText } = render(Display)
    const slider = getByLabelText('config.display.brightness')
    expect(slider).toHaveAttribute('min', '10')
    expect(slider).toHaveValue('60')
    await fireEvent.change(slider, { target: { value: '80' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ tft_brightness: 80 }))
  })

  it('renders the standby slider down to 0 (screen off) and writes 0', async () => {
    config_store.set({ tft_theme: 'dark', tft_standby_brightness: 0 })
    const { getByLabelText } = render(Display)
    const slider = getByLabelText('config.display.standby')
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveValue('0')
    await fireEvent.change(slider, { target: { value: '20' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ tft_standby_brightness: 20 }))
  })

  it('shows the timeout slider enabled with Never off when timeout is non-zero', () => {
    config_store.set({ tft_theme: 'dark', lcd_backlight_timeout: 600 })
    const { getByLabelText } = render(Display)
    const slider = getByLabelText('config.display.timeout')
    expect(slider).toHaveValue('600')
    expect(slider).not.toBeDisabled()
    expect(getByLabelText('config.display.never')).toHaveAttribute('aria-checked', 'false')
  })

  it('writes 0 when Never is toggled on, and disables the slider', async () => {
    config_store.set({ tft_theme: 'dark', lcd_backlight_timeout: 600 })
    const { getByLabelText } = render(Display)
    await fireEvent.click(getByLabelText('config.display.never'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ lcd_backlight_timeout: 0 }))
  })

  it('shows Never on and the slider disabled when timeout is 0', () => {
    config_store.set({ tft_theme: 'dark', lcd_backlight_timeout: 0 })
    const { getByLabelText } = render(Display)
    expect(getByLabelText('config.display.never')).toHaveAttribute('aria-checked', 'true')
    expect(getByLabelText('config.display.timeout')).toBeDisabled()
  })

  it('restores the last non-zero value when Never is toggled back off', async () => {
    config_store.set({ tft_theme: 'dark', lcd_backlight_timeout: 900 })
    const { getByLabelText } = render(Display)
    // Never on -> writes 0
    await fireEvent.click(getByLabelText('config.display.never'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ lcd_backlight_timeout: 0 }))
    // store now reflects 0; toggling Never off should restore the remembered 900
    config_store.update((c) => ({ ...c, lcd_backlight_timeout: 0 }))
    await fireEvent.click(getByLabelText('config.display.never'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ lcd_backlight_timeout: 900 }))
  })
  it('shows 24-hour selected by default and writes tft_12h_clock when 12-hour is picked', async () => {
    config_store.set({ tft_theme: 'dark', tft_12h_clock: false })
    const { getByText } = render(Display)
    expect(getByText('config.display.clock_24')).toHaveAttribute('aria-pressed', 'true')
    await fireEvent.click(getByText('config.display.clock_12'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ tft_12h_clock: true }))
  })
})
