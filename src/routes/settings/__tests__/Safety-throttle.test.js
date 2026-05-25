import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'

const { config, status, saveField } = vi.hoisted(() => {
  const { writable } = require('svelte/store')
  const config = writable({
    gfci_check: true, ground_check: true, relay_check: true,
    temp_check: true, diode_check: true, vent_check: true,
    temp_throttle_enabled: false, temp_throttle_setpoint: 65,
  })
  const status = writable({ gfcicount: 0, nogndcount: 0, stuckcount: 0 })
  const saveField = vi.fn(async () => true)
  return { config, status, saveField }
})

vi.mock('../../../lib/stores/config.js', () => ({ config_store: config }))
vi.mock('../../../lib/stores/status.js', () => ({ status_store: status }))
vi.mock('../../../lib/config/configForm.svelte.js', () => ({
  createConfigForm: () => ({ saveField, saveFields: vi.fn(), saveState: {}, revert: 0 }),
}))

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import Safety from '../Safety.svelte'

describe('Safety — temp throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.set({
      gfci_check: true, ground_check: true, relay_check: true,
      temp_check: true, diode_check: true, vent_check: true,
      temp_throttle_enabled: false, temp_throttle_setpoint: 65,
    })
  })

  it('hides the setpoint slider when throttle is disabled', () => {
    render(Safety)
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('shows slider when throttle is enabled and commits via saveField', async () => {
    config.update((c) => ({ ...c, temp_throttle_enabled: true }))
    render(Safety)
    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
    await fireEvent.change(slider, { target: { value: '72' } })
    expect(saveField).toHaveBeenCalledWith('temp_throttle_setpoint', 72)
  })
})
