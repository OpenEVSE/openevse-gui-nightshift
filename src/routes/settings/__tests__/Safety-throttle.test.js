import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'

const { config, status, saveField } = vi.hoisted(() => {
  const { writable } = require('svelte/store')
  const config = writable({
    gfci_check: true, ground_check: true, relay_check: true,
    temp_check: true, diode_check: true, vent_check: true,
    temp_throttle_enabled: false, temp_throttle_setpoint: 65,
    over_temp_shutdown: 78,
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
      over_temp_shutdown: 78,
    })
  })

  it('hides the temperature sliders when throttle is disabled', () => {
    render(Safety)
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('shows the combined throttle/panic slider when enabled and commits throttle via saveField', async () => {
    config.update((c) => ({ ...c, temp_throttle_enabled: true }))
    render(Safety)
    // Dual-thumb: two range inputs (throttle + panic).
    expect(screen.getAllByRole('slider')).toHaveLength(2)
    const throttle = screen.getByLabelText('config.safety.temp_throttle')
    await fireEvent.change(throttle, { target: { value: '72' } })
    expect(saveField).toHaveBeenCalledWith('temp_throttle_setpoint', 72)
  })

  it('commits the panic threshold via saveField', async () => {
    config.update((c) => ({ ...c, temp_throttle_enabled: true }))
    render(Safety)
    const panic = screen.getByLabelText('config.safety.temp_panic')
    await fireEvent.change(panic, { target: { value: '80' } })
    expect(saveField).toHaveBeenCalledWith('over_temp_shutdown', 80)
  })
})
