import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import SessionChart from '../SessionChart.svelte'

const S = (ts, a, s) => ({ ts, a, t: 0, e: 0, s })

describe('SessionChart', () => {
  it('shows the collecting placeholder when there are fewer than 2 in-session samples', () => {
    const { getByText } = render(SessionChart, {
      props: { samples: [S(1000, 32, 50)], voltage: 240, target: 80, sessionElapsed: 600 },
    })
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })

  it('clips to the current session before deciding the placeholder', () => {
    // two samples exist, but only one falls inside the 100 s session window
    const { getByText } = render(SessionChart, {
      props: { samples: [S(1000, 32, 50), S(2000, 32, 60)], voltage: 240, target: 80, sessionElapsed: 100 },
    })
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })
})
