import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ChargePointMark from '../ChargePointMark.svelte'

describe('ChargePointMark', () => {
  it('renders an svg sized by the size prop', () => {
    const { container } = render(ChargePointMark, { props: { size: 40 } })
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('width')).toBe('40')
  })

  it('draws the enclosure and cord in currentColor so they follow the theme accent', () => {
    const { container } = render(ChargePointMark)
    expect(container.querySelectorAll('[stroke="currentColor"]')).toHaveLength(2)
  })

  it('keeps the bolt on its own token, independent of the accent', () => {
    const { container } = render(ChargePointMark)
    const bolt = container.querySelector('[fill^="var(--mark-bolt"]')
    expect(bolt).toBeInTheDocument()
  })
})
