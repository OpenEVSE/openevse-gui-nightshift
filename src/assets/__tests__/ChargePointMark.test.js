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

  it('is decorative by default, so it is not announced beside the text that names it', () => {
    const { container } = render(ChargePointMark)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('role')).toBeNull()
    expect(svg.getAttribute('aria-label')).toBeNull()
  })

  it('takes a label for standalone use, and stops being decorative when given one', () => {
    const { container } = render(ChargePointMark, { props: { label: 'OpenEVSE' } })
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('OpenEVSE')
    expect(svg.getAttribute('aria-hidden')).toBeNull()
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
