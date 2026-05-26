import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../lib/api/httpAPI.js'
import { history_store } from '../../lib/stores/history.js'
import { config_store } from '../../lib/stores/config.js'
import { uisettings_store } from '../../lib/stores/uisettings.js'
import { rfid_users_store } from '../../lib/stores/rfid_users.js'
import History from '../History.svelte'

const LOGS = [
  { time: '2026-05-21T18:30:00Z', type: 'information', evseState: 3, energy: 7400, temperature: 28.5, rfidTag: 'AA11' },
  { time: '2026-05-20T22:05:00Z', type: 'warning', evseState: 8, energy: 0, temperature: 41.2 },
]

describe('History', () => {
  beforeEach(() => {
    history_store.set(undefined)
    config_store.set({})
    httpAPI.mockReset()
    uisettings_store.update((s) => ({ ...s, dev_features: false }))
    rfid_users_store.reset()
  })

  it('loads the log and renders a row per entry', async () => {
    httpAPI.mockImplementation((method, path) =>
      path === '/logs' ? Promise.resolve({ min: 1, max: 1 }) : Promise.resolve(LOGS),
    )
    const { getByText } = render(History)
    // getStateDesc resolves to the i18n key under the mocked catalog
    await vi.waitFor(() => {
      expect(getByText('logs-states.active-charge')).toBeInTheDocument()
    })
  })

  it('shows the error card when the index call fails', async () => {
    httpAPI.mockResolvedValue('error')
    const { getByText } = render(History)
    await vi.waitFor(() => {
      expect(getByText('history.error_title')).toBeInTheDocument()
    })
  })

  it('shows the empty state when the log has no entries', async () => {
    httpAPI.mockImplementation((method, path) =>
      path === '/logs' ? Promise.resolve({ min: 1, max: 1 }) : Promise.resolve([]),
    )
    const { getByText } = render(History)
    await vi.waitFor(() => {
      expect(getByText('history.empty')).toBeInTheDocument()
    })
  })

  it('shows the error card when a page download fails', async () => {
    httpAPI.mockImplementation((method, path) =>
      path === '/logs' ? Promise.resolve({ min: 1, max: 1 }) : Promise.resolve('error'),
    )
    const { getByText } = render(History)
    await vi.waitFor(() => {
      expect(getByText('history.error_title')).toBeInTheDocument()
    })
  })

  it('hides the export button when Labs is off', async () => {
    httpAPI.mockImplementation((method, path) =>
      path === '/logs' ? Promise.resolve({ min: 1, max: 1 }) : Promise.resolve(LOGS),
    )
    const { queryByText } = render(History)
    await vi.waitFor(() => {
      expect(queryByText('logs-states.active-charge')).toBeInTheDocument()
    })
    expect(queryByText('history.export_csv')).not.toBeInTheDocument()
  })

  it('shows the export button and user names when Labs is on', async () => {
    uisettings_store.update((s) => ({ ...s, dev_features: true }))
    rfid_users_store.set({ users: { AA11: 'Alice' }, loading: false, error: false })
    httpAPI.mockImplementation((method, path) => {
      if (path === '/rfid/users') return Promise.resolve({ AA11: 'Alice' })
      if (path === '/logs') return Promise.resolve({ min: 1, max: 1 })
      return Promise.resolve(LOGS)
    })
    const { getByText } = render(History)
    await vi.waitFor(() => {
      expect(getByText('history.export_csv')).toBeInTheDocument()
      expect(getByText('Alice')).toBeInTheDocument()
    })
  })

  it('retries the load when Retry is clicked', async () => {
    httpAPI.mockResolvedValue('error')
    const { getByText } = render(History)
    await vi.waitFor(() => expect(getByText('history.error_title')).toBeInTheDocument())

    httpAPI.mockImplementation((method, path) =>
      path === '/logs' ? Promise.resolve({ min: 1, max: 1 }) : Promise.resolve(LOGS),
    )
    await fireEvent.click(getByText('history.retry'))
    await vi.waitFor(() => {
      expect(getByText('logs-states.active-charge')).toBeInTheDocument()
    })
  })
})
