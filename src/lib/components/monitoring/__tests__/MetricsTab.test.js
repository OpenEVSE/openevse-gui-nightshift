import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import MetricsTab from '../MetricsTab.svelte'

const groups = [
  { group: { titleKey: 'monitoring.group.energy', rows: [] }, expanded: true },
  { group: { titleKey: 'monitoring.group.sensors', rows: [] }, expanded: false },
]

describe('MetricsTab', () => {
  it('renders a group per entry', () => {
    const { getByText } = render(MetricsTab, { props: { groups } })
    expect(getByText('monitoring.group.energy')).toBeInTheDocument()
    expect(getByText('monitoring.group.sensors')).toBeInTheDocument()
  })
})
