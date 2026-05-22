import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import MetricGroup from '../MetricGroup.svelte'

const group = {
  titleKey: 'monitoring.group.energy',
  rows: [{ labelKey: 'monitoring.energy.total', value: 12, unit: 'units.kwh' }],
}

describe('MetricGroup', () => {
  it('hides rows when collapsed and shows them after the header is clicked', async () => {
    const { getByText, queryByText } = render(MetricGroup, { props: { group, expanded: false } })
    expect(queryByText('monitoring.energy.total')).not.toBeInTheDocument()
    await fireEvent.click(getByText('monitoring.group.energy'))
    expect(getByText('monitoring.energy.total')).toBeInTheDocument()
  })
  it('shows rows immediately when expanded by default', () => {
    const { getByText } = render(MetricGroup, { props: { group, expanded: true } })
    expect(getByText('monitoring.energy.total')).toBeInTheDocument()
  })
})
