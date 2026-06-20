// src/lib/data/__tests__/FetchData.history.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import { uistates_store } from '../../stores/uistates.js'
import FetchData from '../FetchData.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  uistates_store.update((u) => ({ ...u, history_available: true }))
})

describe('FetchData history probe', () => {
  it('marks history unavailable when the probe fails, without erroring startup', async () => {
    httpAPI.mockImplementation((method, url) =>
      Promise.resolve(url === '/logs' ? 'error' : {}))
    let errored = false
    render(FetchData, { props: { onError: () => (errored = true), onLoaded: () => {} } })
    await vi.waitFor(() => expect(get(uistates_store).history_available).toBe(false))
    expect(errored).toBe(false)
  })
  it('marks history available when the probe succeeds', async () => {
    httpAPI.mockImplementation((method, url) =>
      Promise.resolve(url === '/logs' ? { min: 0, max: 5 } : {}))
    render(FetchData, { props: { onLoaded: () => {} } })
    await vi.waitFor(() => expect(get(uistates_store).history_available).toBe(true))
  })
})
