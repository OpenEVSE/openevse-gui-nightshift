import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ProgressRing from '../ProgressRing.svelte'

describe('ProgressRing', () => {
  it('renders a conic-gradient sized by fill (0.5 -> 180deg)', () => {
    const { container } = render(ProgressRing, { props: { fill: 0.5 } })
    const ring = container.firstElementChild
    expect(ring.getAttribute('style')).toContain('180deg')
  })
  it('clamps fill above 1 to 360deg', () => {
    const { container } = render(ProgressRing, { props: { fill: 5 } })
    expect(container.firstElementChild.getAttribute('style')).toContain('360deg')
  })
})
