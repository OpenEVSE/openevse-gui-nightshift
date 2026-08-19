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

  it('draws the enclosure and both cords in currentColor so they follow the theme accent', () => {
    const { container } = render(ChargePointMark)
    expect(container.querySelectorAll('[stroke="currentColor"]')).toHaveLength(3)
  })

  it('draws the plug body and its two pins in currentColor too', () => {
    const { container } = render(ChargePointMark)
    expect(container.querySelectorAll('[fill="currentColor"]')).toHaveLength(3)
  })

  it('keeps the bolt on its own token, independent of the accent', () => {
    const { container } = render(ChargePointMark)
    const bolt = container.querySelector('[fill^="var(--mark-bolt"]')
    expect(bolt).toBeInTheDocument()
  })

  it('leaves the bolt as the only shape not driven by currentColor', () => {
    const { container } = render(ChargePointMark)
    const shapes = [...container.querySelectorAll('rect, path')]
    const offAccent = shapes.filter(
      (n) => n.getAttribute('stroke') !== 'currentColor'
        && n.getAttribute('fill') !== 'currentColor',
    )
    expect(offAccent).toHaveLength(1)
    expect(offAccent[0].getAttribute('fill')).toMatch(/^var\(--mark-bolt/)
  })
})
