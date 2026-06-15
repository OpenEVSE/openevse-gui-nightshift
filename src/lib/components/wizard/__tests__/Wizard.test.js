// src/lib/components/wizard/__tests__/Wizard.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// We don't care about the queue's batching for unit tests — just resolve.
vi.mock('../../../queue.js', () => ({
  serialQueue: { add: (fn) => Promise.resolve(fn()) },
}))

// Each step pulls in real stores / form helpers / http — stub them so the
// route renders without an exploded dependency graph. vi.mock is hoisted,
// so the spy has to live inside vi.hoisted to be reachable from the factory.
const { saveParam } = vi.hoisted(() => ({
  saveParam: vi.fn(() => Promise.resolve(true)),
}))
vi.mock('../../../stores/config.js', async () => {
  const { writable } = await import('svelte/store')
  const config_store = writable({ wizard_passed: false, hostname: 'openevse' })
  return { config_store: Object.assign(config_store, { saveParam }) }
})

import { writable } from 'svelte/store'
import { status_store } from '../../../stores/status.js'

import Wizard from '../../../../routes/Wizard.svelte'

beforeEach(() => {
  saveParam.mockClear()
  status_store.set({ ipaddress: '10.0.0.5' })
})

describe('Wizard route', () => {
  it('starts on the welcome step', () => {
    const { getByText } = render(Wizard)
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()
    expect(getByText('wizard.step_count')).toBeInTheDocument()
  })

  it('advances and rewinds with Next / Previous', async () => {
    const { getByText, queryByText } = render(Wizard)
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()

    await fireEvent.click(getByText('wizard.next'))
    expect(getByText('wizard.evse.title')).toBeInTheDocument()

    await fireEvent.click(getByText('wizard.previous'))
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()
    expect(queryByText('wizard.previous')).toBeNull()
  })

  it('shows the max current value while the slider is dragged', async () => {
    const { getByText, getByRole } = render(Wizard)
    await fireEvent.click(getByText('wizard.next'))

    const slider = getByRole('slider')
    slider.value = '20'
    await fireEvent.input(slider)

    expect(getByText('20 A')).toBeInTheDocument()
  })

  it('saves wizard_passed and stays put when finishing off the device AP', async () => {
    status_store.set({ ipaddress: '10.0.0.5' })
    const { getByText, queryByText } = render(Wizard)
    // Click Next four times to land on step 4 (firmware).
    for (let i = 0; i < 4; i++) await fireEvent.click(getByText('wizard.next'))
    await fireEvent.click(getByText('wizard.finish'))

    expect(saveParam).toHaveBeenCalledWith('wizard_passed', true)
    // No reconnect dialog when we already have a routable IP — App.svelte
    // swaps to the dashboard once wizard_passed flips.
    expect(queryByText('wizard.reconnect.title')).toBeNull()
  })

  it('shows the reconnect dialog when finishing while still on the device AP', async () => {
    status_store.set({ ipaddress: '192.168.4.1' })
    const { getByText } = render(Wizard)
    for (let i = 0; i < 4; i++) await fireEvent.click(getByText('wizard.next'))
    await fireEvent.click(getByText('wizard.finish'))

    expect(saveParam).toHaveBeenCalledWith('wizard_passed', true)
    expect(getByText('wizard.reconnect.title')).toBeInTheDocument()
  })
})
