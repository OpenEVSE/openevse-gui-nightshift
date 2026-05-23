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
})
