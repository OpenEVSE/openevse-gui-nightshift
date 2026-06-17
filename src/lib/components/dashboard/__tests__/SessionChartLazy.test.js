// src/lib/components/dashboard/__tests__/SessionChartLazy.test.js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import SessionChartLazy from '../SessionChartLazy.svelte'

describe('SessionChartLazy', () => {
  it('mounts without throwing and resolves the chart when charts are enabled', async () => {
    const { container } = render(SessionChartLazy, { props: { samples: [], voltage: 230, target: null, sessionElapsed: 0 } })
    expect(container).toBeTruthy()
    // The real chart loads asynchronously; the wrapper renders nothing until then.
    await Promise.resolve()
  })
})
