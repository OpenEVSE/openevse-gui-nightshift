// src/routes/settings/__tests__/Safety.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Safety from '../Safety.svelte'

const ALL_ON = {
  gfci_check: true, ground_check: true, relay_check: true,
  temp_check: true, diode_check: true, vent_check: true,
}

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ gfcicount: 0, nogndcount: 0, stuckcount: 0 })
})

describe('Safety page', () => {
  it('shows the warning banner when a check is off', () => {
    config_store.set({ ...ALL_ON, vent_check: false })
    const { getByText } = render(Safety)
    expect(getByText('config.safety.warning')).toBeInTheDocument()
  })

  it('hides the warning banner when every check is on', () => {
    config_store.set({ ...ALL_ON })
    const { queryByText } = render(Safety)
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('shows the fault counters', () => {
    config_store.set({ ...ALL_ON })
    status_store.set({ gfcicount: 3, nogndcount: 0, stuckcount: 1 })
    const { getByText } = render(Safety)
    expect(getByText('3')).toBeInTheDocument()
    expect(getByText('1')).toBeInTheDocument()
  })

  it('saves a check toggle on change', async () => {
    config_store.set({ ...ALL_ON })
    const { getAllByRole } = render(Safety)
    await fireEvent.click(getAllByRole('switch')[0])
    expect(httpAPI).toHaveBeenCalled()
    const [, , body] = httpAPI.mock.calls[0]
    expect(body).toBe(JSON.stringify({ gfci_check: false }))
  })

  it('shows the alert box when a save fails', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ ...ALL_ON })
    const { getAllByRole } = render(Safety)
    await fireEvent.click(getAllByRole('switch')[0])
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
