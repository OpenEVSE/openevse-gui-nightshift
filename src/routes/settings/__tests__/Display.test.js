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

  it('defaults to dark when tft_theme is absent', () => {
    config_store.set({})
    const { getByText } = render(Display)
    expect(getByText('config.display.dark')).toHaveAttribute('aria-pressed', 'true')
  })

  it('writes tft_theme to /config when a theme is picked', async () => {
    config_store.set({ tft_theme: 'dark' })
    const { getByText } = render(Display)
    await fireEvent.click(getByText('config.display.light'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ tft_theme: 'light' }))
  })
})
