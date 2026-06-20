// src/routes/__tests__/MonitoringLazy.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('../../lib/router.js', () => ({ redirect: vi.fn() }))

// Monitoring.svelte (loaded by the dynamic import) uses svelte-i18n; mock it
// to avoid "no initial locale" errors when the lazy import resolves.
vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// Monitoring also calls httpAPI indirectly via stores; stub it out.
vi.mock('../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({})) }))

import MonitoringLazy from '../MonitoringLazy.svelte'
import { redirect } from '../../lib/router.js'

describe('MonitoringLazy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('loads Monitoring and does NOT redirect when charts are enabled (default)', async () => {
    render(MonitoringLazy)
    await vi.dynamicImportSettled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects to / and skips the import when VITE_CHARTS is false', async () => {
    vi.stubEnv('VITE_CHARTS', 'false')
    render(MonitoringLazy)
    await vi.dynamicImportSettled()
    expect(redirect).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith('/')
  })
})
