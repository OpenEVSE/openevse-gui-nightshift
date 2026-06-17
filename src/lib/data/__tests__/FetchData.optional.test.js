// src/lib/data/__tests__/FetchData.optional.test.js
// A reduced-capability device (JuiceBox/lite) 404s on plan/claims/certificates.
// Those steps are optional: init must still complete and call onLoaded().
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import FetchData from '../FetchData.svelte'

beforeEach(() => {
  httpAPI.mockReset()
})

// Endpoints a reduced-capability device does not implement.
const OPTIONAL_ERRORS = ['/schedule/plan', '/claims/target', '/certificates']
const ERR = { msg: 'error' }

describe('FetchData optional stores', () => {
  it('still reaches onLoaded when the optional endpoints 404', async () => {
    httpAPI.mockImplementation((method, url) =>
      Promise.resolve(OPTIONAL_ERRORS.includes(url) ? ERR : {}))
    let loaded = false
    let errored = false
    render(FetchData, {
      props: { onLoaded: () => (loaded = true), onError: () => (errored = true) },
    })
    await vi.waitFor(() => expect(loaded).toBe(true))
    expect(errored).toBe(false)
  })

  it('still errors when a mandatory endpoint fails', async () => {
    // /config is mandatory: its failure must abort init.
    httpAPI.mockImplementation((method, url) =>
      Promise.resolve(url === '/config' ? ERR : {}))
    let loaded = false
    let errored = false
    render(FetchData, {
      props: { onLoaded: () => (loaded = true), onError: () => (errored = true) },
    })
    await vi.waitFor(() => expect(errored).toBe(true))
    expect(loaded).toBe(false)
  })
})
