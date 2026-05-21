import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeLimitModal from '../ChargeLimitModal.svelte'

describe('ChargeLimitModal', () => {
  it('renders nothing when closed', () => {
    const { queryByRole } = render(ChargeLimitModal, { props: { open: false } })
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('saves an energy limit with the chosen value', async () => {
    const onsave = vi.fn()
    const { getByRole, getByText } = render(ChargeLimitModal, {
      props: { open: true, onsave },
    })
    // default type is energy; set the energy slider then save
    const slider = getByRole('slider')
    slider.value = '10'
    await fireEvent.change(slider)
    await fireEvent.click(getByText('dashboard.limit.save'))
    expect(onsave).toHaveBeenCalledWith({ type: 'energy', value: 10000, auto_release: true })
  })

  it('resets to defaults when reopened after a change', async () => {
    const { getByRole, rerender, queryByRole } = render(ChargeLimitModal, {
      props: { open: true },
    })
    // Change the slider away from the default (5 kWh → 20 kWh)
    const slider = getByRole('slider')
    slider.value = '20'
    await fireEvent.change(slider)
    expect(slider.value).toBe('20')

    // Close the modal
    await rerender({ open: false })
    expect(queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen — should show default slider value of 5
    await rerender({ open: true })
    await waitFor(() => {
      const reopenedSlider = getByRole('slider')
      expect(reopenedSlider.value).toBe('5')
    })
  })
})
