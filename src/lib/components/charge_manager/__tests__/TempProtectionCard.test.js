import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import TempProtectionCard from '../TempProtectionCard.svelte'

describe('TempProtectionCard', () => {
  it('pushes the panic thumb up when the throttle thumb is dragged into it', async () => {
    const onThrottleChange = vi.fn()
    const onPanicChange = vi.fn()
    const { getByLabelText } = render(TempProtectionCard, {
      props: { throttle: 65, panic: 67, min: 40, max: 82, gap: 2, onThrottleChange, onPanicChange },
    })
    // Drag throttle to 70 — panic (67) must be pushed to 72 so they can't cross.
    const throttle = getByLabelText('config.safety.temp_throttle')
    await fireEvent.change(throttle, { target: { value: '70' } })
    expect(onThrottleChange).toHaveBeenCalledWith(70)
    expect(onPanicChange).toHaveBeenCalledWith(72)
  })

  it('pushes the throttle thumb down when the panic thumb is dragged into it', async () => {
    const onThrottleChange = vi.fn()
    const onPanicChange = vi.fn()
    const { getByLabelText } = render(TempProtectionCard, {
      props: { throttle: 65, panic: 67, min: 40, max: 82, gap: 2, onThrottleChange, onPanicChange },
    })
    // Drag panic to 64 — throttle (65) must be pushed to 62.
    const panic = getByLabelText('config.safety.temp_panic')
    await fireEvent.change(panic, { target: { value: '64' } })
    expect(onPanicChange).toHaveBeenCalledWith(64)
    expect(onThrottleChange).toHaveBeenCalledWith(62)
  })

  it('does not move the other thumb when there is enough room', async () => {
    const onThrottleChange = vi.fn()
    const onPanicChange = vi.fn()
    const { getByLabelText } = render(TempProtectionCard, {
      props: { throttle: 60, panic: 78, min: 40, max: 82, gap: 2, onThrottleChange, onPanicChange },
    })
    const throttle = getByLabelText('config.safety.temp_throttle')
    await fireEvent.change(throttle, { target: { value: '70' } })
    expect(onThrottleChange).toHaveBeenCalledWith(70)
    expect(onPanicChange).not.toHaveBeenCalled()
  })

  it('renders a custom title', () => {
    const { getByText } = render(TempProtectionCard, { props: { title: 'My Safety Title' } })
    expect(getByText('My Safety Title')).toBeInTheDocument()
  })

  it('shows the all-checks-on banner when checksAllOn is true', () => {
    const { getByText, queryByText } = render(TempProtectionCard, { props: { checksAllOn: true } })
    expect(getByText('config.safety.all_on')).toBeInTheDocument()
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('shows the warning banner when checksAllOn is false', () => {
    const { getByText, queryByText } = render(TempProtectionCard, { props: { checksAllOn: false } })
    expect(getByText('config.safety.warning')).toBeInTheDocument()
    expect(queryByText('config.safety.all_on')).not.toBeInTheDocument()
  })

  it('omits the banner when checksAllOn is null', () => {
    const { queryByText } = render(TempProtectionCard, { props: { checksAllOn: null } })
    expect(queryByText('config.safety.all_on')).not.toBeInTheDocument()
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('shows the EVSE temperature marker value when temperature is provided', () => {
    const { container } = render(TempProtectionCard, {
      props: { throttle: 65, panic: 72, temperature: 55 },
    })
    expect(container.textContent).toContain('55°C')
  })
})
