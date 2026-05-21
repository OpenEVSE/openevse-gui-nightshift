import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import GearMark from '../GearMark.svelte'

describe('GearMark', () => {
  it('renders an svg sized by the size prop', () => {
    const { container } = render(GearMark, { props: { size: 40 } })
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('width')).toBe('40')
  })

  it('uses currentColor so it inherits theme color', () => {
    const { container } = render(GearMark)
    expect(container.querySelector('[fill="currentColor"]')).toBeInTheDocument()
  })
})
