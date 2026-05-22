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
import History from '../History.svelte'

const LOGS = [
  { time: '2026-05-21T18:30:00Z', type: 'information', evseState: 3, energy: 7400, temperature: 28.5 },
  { time: '2026-05-20T22:05:00Z', type: 'warning', evseState: 8, energy: 0, temperature: 41.2 },
]

describe('History', () => {
  beforeEach(() => {
    history_store.set(undefined)
    config_store.set({})
    httpAPI.mockReset()
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
