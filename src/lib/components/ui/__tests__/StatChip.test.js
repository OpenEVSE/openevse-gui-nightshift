import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import StatChip from '../StatChip.svelte'

describe('StatChip', () => {
  it('shows value and label', () => {
    const { getByText } = render(StatChip, { props: { value: '12.3', label: 'Session kWh' } })
    expect(getByText('12.3')).toBeInTheDocument()
    expect(getByText('Session kWh')).toBeInTheDocument()
  })
})
