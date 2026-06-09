import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import LimitSliderBar from '../LimitSliderBar.svelte'

describe('LimitSliderBar', () => {
  it('commits a time limit in minutes', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'time', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_time' })
    input.value = '120'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(120)
  })

  it('commits an energy limit converted from kWh to Wh', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'energy', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    input.value = '10'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(10000)
  })

  it('drag to zero emits 0 (clear) when a limit is active', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'energy', value: 10000, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    input.value = '0'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(0)
  })

  it('suppresses no-change commits (idle editor cannot clear another limit)', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'time', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_time' })
    input.value = '0'
    await fireEvent.change(input)
    expect(onchange).not.toHaveBeenCalled()
  })

  it('shows the drag hint when no limit is set and the remaining when active', () => {
    const idle = render(LimitSliderBar, { props: { kind: 'time', value: 0 } })
    expect(idle.getByText('dashboard.limit.drag_to_set')).toBeInTheDocument()
    const active = render(LimitSliderBar, {
      props: { kind: 'time', value: 120, progress: 2880, charging: true },
    })
    // 120 min limit, 2880 s (48 min) elapsed → 1h 12m left
    expect(active.getByText(/1h 12m/)).toBeInTheDocument()
  })

  it('caps the progress fill at the knob and only fills while a limit is active', () => {
    const over = render(LimitSliderBar, {
      props: { kind: 'energy', value: 5000, progress: 9000, charging: true },
    })
    const fill = over.container.querySelector('[data-fill]')
    // The scale is inset 7% from each rail (86% usable zone). A 5 kWh limit on
    // the 100 kWh scale puts the knob 5% into that zone; over-delivered
    // progress caps the fill AT the knob, never past it.
    expect(fill.style.left).toBe('7%')
    expect(fill.style.width).toBe(`${(5 / 100) * 86}%`)
    const none = render(LimitSliderBar, { props: { kind: 'energy', value: 0, progress: 9000 } })
    expect(none.container.querySelector('[data-fill]').style.width).toBe('0%')
  })

  it('disables the input when disabled (system limit)', () => {
    const { getByRole } = render(LimitSliderBar, {
      props: { kind: 'time', value: 120, disabled: true },
    })
    expect(getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeDisabled()
  })

  it('clears a sub-step limit (displays as 0 but is active)', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'energy', value: 400, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    input.value = '0'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(0)
  })

  it('renders no NaN fill for a sub-step limit', () => {
    const { container } = render(LimitSliderBar, { props: { kind: 'energy', value: 400, progress: 0 } })
    expect(container.querySelector('[data-fill]').style.width).toBe('0%')
  })

  it('insets the rendered knob ~7% from the rails (commits still span 0..max)', () => {
    const zero = render(LimitSliderBar, { props: { kind: 'time', value: 0 } })
    expect(zero.container.querySelector('[data-knob]').style.left).toBe('7%')
    const full = render(LimitSliderBar, { props: { kind: 'time', value: 480 } })
    expect(full.container.querySelector('[data-knob]').style.left).toBe('93%')
  })
})
