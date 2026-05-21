import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { plan_store } from '../plan.js'
import { httpAPI } from '../../api/httpAPI.js'

describe('plan_store', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exposes subscribe and download', () => {
    expect(typeof plan_store.subscribe).toBe('function')
    expect(typeof plan_store.download).toBe('function')
  })

  it('returns false when the API errors', async () => {
    httpAPI.mockResolvedValue('error')
    expect(await plan_store.download()).toBe(false)
  })
})
