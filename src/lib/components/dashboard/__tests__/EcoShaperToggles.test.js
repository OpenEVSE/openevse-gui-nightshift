import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import EcoShaperToggles from '../EcoShaperToggles.svelte'

describe('EcoShaperToggles', () => {
  it('renders nothing when neither feature is enabled', () => {
    const { container } = render(EcoShaperToggles, { props: { showEco: false, showShaper: false } })
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0)
  })
  it('fires onEco when the Eco toggle is clicked', async () => {
    const onEco = vi.fn()
    const { getByLabelText } = render(EcoShaperToggles, {
      props: { showEco: true, ecoOn: false, onEco },
    })
    await fireEvent.click(getByLabelText('dashboard.eco'))
    expect(onEco).toHaveBeenCalledWith(true)
  })
})
