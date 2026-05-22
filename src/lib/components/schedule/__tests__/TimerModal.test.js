import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import TimerModal from '../TimerModal.svelte'

describe('TimerModal', () => {
  it('renders nothing when closed', () => {
    const { queryByRole } = render(TimerModal, { props: { open: false } })
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('saves a new timer with the default days, time and state', async () => {
    const onsave = vi.fn()
    const { getByText } = render(TimerModal, { props: { open: true, timer: null, onsave } })
    await fireEvent.click(getByText('schedule.save'))
    expect(onsave).toHaveBeenCalledWith({
      state: 'active',
      time: '08:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    })
  })

  it('blocks saving with zero days selected and shows the validation message', async () => {
    const onsave = vi.fn()
    const { getByText, queryByText } = render(TimerModal, {
      props: { open: true, timer: null, onsave },
    })
    await fireEvent.click(getByText('schedule.clear_all')) // defaults are all-on → button clears all
    await fireEvent.click(getByText('schedule.save'))
    expect(onsave).not.toHaveBeenCalled()
    expect(queryByText('schedule.error_no_day')).toBeInTheDocument()
  })

  it('pre-fills from an existing timer when editing', async () => {
    const onsave = vi.fn()
    const { getByText } = render(TimerModal, {
      props: {
        open: true,
        timer: { id: 3, state: 'disabled', time: '21:15', days: ['saturday', 'sunday'] },
        onsave,
      },
    })
    await fireEvent.click(getByText('schedule.save'))
    expect(onsave).toHaveBeenCalledWith({
      state: 'disabled',
      time: '21:15',
      days: ['saturday', 'sunday'],
    })
  })
})
