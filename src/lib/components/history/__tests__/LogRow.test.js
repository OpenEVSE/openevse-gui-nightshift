import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import LogRow from '../LogRow.svelte'

const props = {
  stateIcon: 'mdi:flash', stateTone: 'charging', stateDesc: 'Charging',
  typeIcon: 'mdi:information-outline', typeTone: 'info', typeLabel: 'Information',
  timeText: '05/21 18:30', energyKwh: 7.4, tempC: 28.5,
}

describe('LogRow', () => {
  it('renders the state description, type, and time', () => {
    const { getByText } = render(LogRow, { props })
    expect(getByText('Charging')).toBeInTheDocument()
    expect(getByText('Information')).toBeInTheDocument()
    expect(getByText('05/21 18:30')).toBeInTheDocument()
  })
  it('renders the energy and temperature values', () => {
    const { getByText } = render(LogRow, { props })
    expect(getByText(/7\.4/)).toBeInTheDocument()
    expect(getByText(/28\.5/)).toBeInTheDocument()
  })
})
