// src/lib/data/__tests__/FetchData.history.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))
// Every store download resolves true except history, which we vary per test.
vi.mock('../../stores/history.js', () => ({ history_store: { download: vi.fn() } }))

import { httpAPI } from '../../api/httpAPI.js'
import { history_store } from '../../stores/history.js'
import { uistates_store } from '../../stores/uistates.js'
import FetchData from '../FetchData.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({}) // bulk-load steps succeed
  uistates_store.update((u) => ({ ...u, history_available: true }))
})

describe('FetchData history probe', () => {
  it('marks history unavailable when the probe fails, without erroring startup', async () => {
    history_store.download.mockResolvedValue(false)
    let errored = false
    render(FetchData, { props: { onError: () => (errored = true), onLoaded: () => {} } })
    await vi.waitFor(() => expect(get(uistates_store).history_available).toBe(false))
    expect(errored).toBe(false)
  })
  it('marks history available when the probe succeeds', async () => {
    history_store.download.mockResolvedValue(true)
    render(FetchData, { props: { onLoaded: () => {} } })
    await vi.waitFor(() => expect(get(uistates_store).history_available).toBe(true))
  })
})
