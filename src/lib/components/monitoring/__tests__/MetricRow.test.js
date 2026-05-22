import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import MetricRow from '../MetricRow.svelte'

describe('MetricRow', () => {
  it('shows the label and value', () => {
    const { getByText } = render(MetricRow, {
      props: { labelKey: 'monitoring.energy.total', value: 7523.3, unit: 'units.kwh' },
    })
    expect(getByText('monitoring.energy.total')).toBeInTheDocument()
    expect(getByText('7523.3')).toBeInTheDocument()
  })
  it('renders an em-dash for a null value', () => {
    const { getByText } = render(MetricRow, {
      props: { labelKey: 'monitoring.energy.total', value: null, unit: 'units.kwh' },
    })
    expect(getByText('—')).toBeInTheDocument()
  })
  it('renders a zero value (not an em-dash)', () => {
    const { getByText } = render(MetricRow, {
      props: { labelKey: 'monitoring.sensor.pilot', value: 0, unit: 'units.amp' },
    })
    expect(getByText('0')).toBeInTheDocument()
  })
})
