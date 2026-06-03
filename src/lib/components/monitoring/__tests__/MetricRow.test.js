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
  it('passes a string value through unchanged', () => {
    const { getByText } = render(MetricRow, {
      props: { labelKey: 'monitoring.vehicle.updated', value: '01:01:01', unit: '' },
    })
    expect(getByText('01:01:01')).toBeInTheDocument()
  })
  it('renders a translated textKey instead of the value', () => {
    const { getByText, queryByText } = render(MetricRow, {
      props: { labelKey: 'monitoring.vehicle.plugged', textKey: 'monitoring.vehicle.plugged_yes', unit: '' },
    })
    expect(getByText('monitoring.vehicle.plugged_yes')).toBeInTheDocument()
    expect(queryByText('—')).toBeNull()
  })
})
