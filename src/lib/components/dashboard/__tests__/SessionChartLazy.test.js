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
  it('resolves the dynamic import and renders the chart collecting placeholder', async () => {
    const { getByText } = render(SessionChartLazy, { props: { samples: [], voltage: 230, target: null, sessionElapsed: 0 } })
    // Wait for the dynamic import of SessionChart.svelte to fully settle
    await vi.dynamicImportSettled()
    // With samples:[] SessionChart shows its "collecting" placeholder
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })
})
