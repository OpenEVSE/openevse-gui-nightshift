import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../stores/uistates.js', () => ({
  uistates_store: { update: vi.fn((fn) => fn({ has_fetched: true })) },
}))
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store')
  return { ...actual, get: vi.fn(() => ({ has_fetched: true })) }
})

import { httpAPI } from '../httpAPI.js'

describe('httpAPI', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GETs JSON and returns the parsed body', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ ok: 1 }) }),
    )
    const res = await httpAPI('GET', '/status')
    expect(res).toEqual({ ok: 1 })
  })

  it('returns the string "error" when fetch rejects', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network')))
    const res = await httpAPI('GET', '/status')
    expect(res).toBe('error')
  })

  it('with raw: true, resolves to { status, body } instead of just the body', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ status: 400, text: () => Promise.resolve('nope') }),
    )
    const res = await httpAPI('GET', '/rfid/add', null, 'txt', 60000, { raw: true })
    expect(res).toEqual({ status: 400, body: 'nope' })
  })

  it('with raw: true, still resolves to the plain "error" string on a network failure', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network')))
    const res = await httpAPI('GET', '/status', null, 'json', 60000, { raw: true })
    expect(res).toBe('error')
  })
})
