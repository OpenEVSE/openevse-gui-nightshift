import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ModeSelector from '../ModeSelector.svelte'

describe('ModeSelector', () => {
  it('calls onmode with the chosen mode index', async () => {
    const onmode = vi.fn()
    const { getByText } = render(ModeSelector, { props: { mode: 0, onmode } })
    await fireEvent.click(getByText('dashboard.mode.off'))
    expect(onmode).toHaveBeenCalledWith(2)
  })
  it('does not fire when disabled', async () => {
    const onmode = vi.fn()
    const { getByText } = render(ModeSelector, { props: { mode: 0, onmode, disabled: true } })
    await fireEvent.click(getByText('dashboard.mode.on'))
    expect(onmode).not.toHaveBeenCalled()
  })
})
