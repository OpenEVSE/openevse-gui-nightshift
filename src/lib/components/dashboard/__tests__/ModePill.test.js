import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ModePill from '../ModePill.svelte'

describe('ModePill', () => {
  it('shows the current mode label', () => {
    const { getByText } = render(ModePill, { props: { mode: 0 } })
    expect(getByText('dashboard.mode.auto')).toBeInTheDocument()
  })

  it('opens the popover and emits onmode for the chosen mode', async () => {
    const onmode = vi.fn()
    const { getByRole, getByText } = render(ModePill, { props: { mode: 0, onmode } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.mode.aria' }))
    await fireEvent.click(getByText('dashboard.mode.off'))
    expect(onmode).toHaveBeenCalledWith(2)
  })

  it('when locked, shows the lock label and does not open a popover', async () => {
    const onmode = vi.fn()
    const { getByText, queryByText, getByRole } = render(ModePill, {
      props: { mode: 0, locked: true, lockLabel: 'RFID', onmode },
    })
    expect(getByText('RFID')).toBeInTheDocument()
    await fireEvent.click(getByRole('button', { name: 'dashboard.mode.aria' }))
    expect(queryByText('dashboard.mode.off')).not.toBeInTheDocument()
    expect(onmode).not.toHaveBeenCalled()
  })

  it('does not open when disabled', async () => {
    const { getByRole, queryByText } = render(ModePill, { props: { mode: 0, disabled: true } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.mode.aria' }))
    expect(queryByText('dashboard.mode.off')).not.toBeInTheDocument()
  })
})
