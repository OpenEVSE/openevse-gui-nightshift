import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({})) }))

import { httpAPI } from '../../lib/api/httpAPI.js'
import { schedule_store } from '../../lib/stores/schedule.js'
import { uistates_store } from '../../lib/stores/uistates.js'
import Schedule from '../Schedule.svelte'

describe('Schedule', () => {
  beforeEach(() => {
    schedule_store.set([])
    uistates_store.resetAlertBox()
    httpAPI.mockReset()
    httpAPI.mockResolvedValue({})
  })

  it('shows the empty state when there are no timers', () => {
    const { getByText } = render(Schedule)
    expect(getByText('schedule.empty')).toBeInTheDocument()
  })

  it('renders a row per timer from the store', () => {
    schedule_store.set([
      { id: 1, state: 'active', time: '07:00', days: ['monday'] },
      { id: 2, state: 'active', time: '19:00', days: ['friday'] },
    ])
    const { getAllByLabelText } = render(Schedule)
    expect(getAllByLabelText('schedule.delete')).toHaveLength(2)
  })

  it('opens the editor when New timer is clicked', async () => {
    const { getByText, queryByRole, getByRole } = render(Schedule)
    expect(queryByRole('dialog')).not.toBeInTheDocument()
    await fireEvent.click(getByText('+ schedule.new'))
    expect(getByRole('dialog')).toBeInTheDocument()
  })

  it('disables the New timer button at the 50-timer cap', () => {
    schedule_store.set(
      Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        state: 'active',
        time: '08:00',
        days: ['monday'],
      })),
    )
    const { getByText } = render(Schedule)
    expect(getByText('+ schedule.new')).toBeDisabled()
  })

  it('uploads a new timer with a fresh id and re-downloads on success', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    schedule_store.set([
      { id: 2, state: 'active', time: '07:00', days: ['monday'] },
      { id: 5, state: 'active', time: '19:00', days: ['friday'] },
    ])
    const { getByText } = render(Schedule)
    await fireEvent.click(getByText('+ schedule.new'))
    await fireEvent.click(getByText('schedule.save'))

    // a successful write triggers a re-download; waiting for the GET
    // guarantees the preceding POST has already resolved
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('GET', '/schedule')
    })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/schedule', expect.stringContaining('"id":6'))
  })

  it('surfaces the global AlertBox when a save fails', async () => {
    httpAPI.mockResolvedValue({}) // upload() needs msg:"done" — anything else is a failure
    const { getByText } = render(Schedule)
    await fireEvent.click(getByText('+ schedule.new'))
    await fireEvent.click(getByText('schedule.save'))

    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
    expect(get(uistates_store).alertbox.title).toBe('alert.write_failed_title')
  })
})
