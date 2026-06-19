// src/lib/data/__tests__/FetchData.rapi.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import { uistates_store } from '../../stores/uistates.js'
import FetchData from '../FetchData.svelte'

const RAPI_URL = '/r?json=1&rapi=$GV'

beforeEach(() => {
  httpAPI.mockReset()
  uistates_store.update((u) => ({ ...u, rapi_available: true }))
})

describe('FetchData RAPI probe', () => {
  it('marks RAPI unavailable when the $GV probe errors (no EVSE module), without erroring startup', async () => {
    httpAPI.mockImplementation((method, url) =>
      Promise.resolve(url === RAPI_URL ? 'error' : {}))
    let errored = false
    render(FetchData, { props: { onError: () => (errored = true), onLoaded: () => {} } })
    await vi.waitFor(() => expect(get(uistates_store).rapi_available).toBe(false))
    expect(errored).toBe(false)
  })
  it('marks RAPI available when $GV returns a RAPI reply', async () => {
    httpAPI.mockImplementation((method, url) =>
      Promise.resolve(url === RAPI_URL ? { cmd: '$GV', ret: '$OK 7.1.3 3^20' } : {}))
    render(FetchData, { props: { onLoaded: () => {} } })
    await vi.waitFor(() => expect(get(uistates_store).rapi_available).toBe(true))
  })
})
