import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import LogRow from '../LogRow.svelte'

const props = {
  stateIcon: 'mdi:flash', stateTone: 'charging', stateDesc: 'Charging',
  typeIcon: 'mdi:information-outline', typeTone: 'info', typeLabel: 'Information',
  timeText: '05/21 18:30', energyKwh: 7.4, temp: 28.5, tempUnit: 'units.celsius',
}

describe('LogRow', () => {
  it('renders the state description, type, and time', () => {
    const { getByText } = render(LogRow, { props })
    expect(getByText('Charging')).toBeInTheDocument()
    expect(getByText('Information')).toBeInTheDocument()
    expect(getByText('05/21 18:30')).toBeInTheDocument()
  })
  it('renders the energy and temperature values with the unit key', () => {
    const { getByText } = render(LogRow, { props })
    expect(getByText(/7\.4/)).toBeInTheDocument()
    expect(getByText(/28\.5/)).toBeInTheDocument()
    expect(getByText(/units\.celsius/)).toBeInTheDocument()
  })
  it('renders fahrenheit when the unit prop says so', () => {
    const { getByText } = render(LogRow, {
      props: { ...props, temp: 83.3, tempUnit: 'units.fahrenheit' },
    })
    expect(getByText(/83\.3/)).toBeInTheDocument()
    expect(getByText(/units\.fahrenheit/)).toBeInTheDocument()
  })
  it('omits the user line when userText is null', () => {
    const { queryByText } = render(LogRow, { props: { ...props, userText: null } })
    // — em-dash is the "no rfid" fallback when userText is passed; null hides line entirely
    expect(queryByText('—')).not.toBeInTheDocument()
  })
  it('shows the user line when userText is passed', () => {
    const { getByText } = render(LogRow, { props: { ...props, userText: 'Alice' } })
    expect(getByText('Alice')).toBeInTheDocument()
  })
  it('shows the pilot current when passed', () => {
    const { getByText } = render(LogRow, { props: { ...props, pilotAmps: 47 } })
    expect(getByText('47 A')).toBeInTheDocument()
  })
  it('omits the pilot metric when null', () => {
    const { queryByText } = render(LogRow, { props: { ...props, pilotAmps: null } })
    expect(queryByText(/\d+\s*A\b/)).not.toBeInTheDocument()
  })
  it('renders the reason line when reasonText is passed', () => {
    const { getByText } = render(LogRow, { props: { ...props, reasonText: 'Pilot 47 → 42 A' } })
    expect(getByText('Pilot 47 → 42 A')).toBeInTheDocument()
  })
  it('shows a labelled glyph for a periodic sample and no reason text', () => {
    const { getByTitle, queryByText } = render(LogRow, {
      props: { ...props, periodic: true, periodicLabel: 'Periodic sample', reasonText: 'unused' },
    })
    expect(getByTitle('Periodic sample')).toBeInTheDocument()
    expect(queryByText('unused')).not.toBeInTheDocument()
  })
})
