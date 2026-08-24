import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import BoostCard from '../BoostCard.svelte'

const base = { active: null, hasSoc: true, canRange: true, disabled: false }

// Expand the collapsed picker, then select a dimension pill.
async function pick(getByText, dim) {
  await fireEvent.click(getByText('dashboard.boost.label')) // expand
  await fireEvent.click(getByText(`dashboard.boost.type_${dim}`))
}

describe('BoostCard', () => {
  it('stays collapsed behind a single Boost button until tapped', async () => {
    const { getByText, queryByRole } = render(BoostCard, { props: { ...base } })
    expect(getByText('dashboard.boost.label')).toBeInTheDocument()
    expect(queryByRole('slider')).not.toBeInTheDocument()
    await fireEvent.click(getByText('dashboard.boost.label'))
    expect(queryByRole('slider')).toBeInTheDocument()
  })

  it('floors the range target just above the current range', async () => {
    const { getByRole, getByText } = render(BoostCard, {
      props: { ...base, range: 206, estMaxRange: 280 },
    })
    await pick(getByText, 'range')
    // ceil((206 + 1) / 10) * 10 — can't arm an already-met range target.
    expect(getByRole('slider').getAttribute('min')).toBe('210')
  })

  it('floors the soc target just above the current level, mirroring range', async () => {
    const { getByRole, getByText } = render(BoostCard, { props: { ...base, soc: 74 } })
    await pick(getByText, 'soc')
    // ceil((74 + 1) / 5) * 5
    expect(getByRole('slider').getAttribute('min')).toBe('75')
  })

  it('arms the selected dimension in device units', async () => {
    const onarm = vi.fn()
    const { getByText } = render(BoostCard, { props: { ...base, onarm } })
    // Default dimension is time (30 min) → 1800 seconds.
    await fireEvent.click(getByText('dashboard.boost.label'))
    await fireEvent.click(getByText('dashboard.boost.arm'))
    expect(onarm).toHaveBeenCalledWith({ type: 'time', value: 1800 })
  })
})
