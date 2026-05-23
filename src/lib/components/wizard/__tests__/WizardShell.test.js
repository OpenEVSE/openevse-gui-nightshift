// src/lib/components/wizard/__tests__/WizardShell.test.js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import WizardShell from '../WizardShell.svelte'

describe('WizardShell', () => {
  it('omits the Previous button on the first step', () => {
    const { queryByText, getByText } = render(WizardShell, {
      props: { step: 0, total: 5 },
    })
    expect(queryByText('wizard.previous')).toBeNull()
    expect(getByText('wizard.next')).toBeInTheDocument()
  })

  it('shows both Previous and Next on a middle step', () => {
    const { getByText } = render(WizardShell, {
      props: { step: 2, total: 5 },
    })
    expect(getByText('wizard.previous')).toBeInTheDocument()
    expect(getByText('wizard.next')).toBeInTheDocument()
  })

  it('shows Finish (not Next) on the last step', () => {
    const { getByText, queryByText } = render(WizardShell, {
      props: { step: 4, total: 5 },
    })
    expect(getByText('wizard.previous')).toBeInTheDocument()
    expect(getByText('wizard.finish')).toBeInTheDocument()
    expect(queryByText('wizard.next')).toBeNull()
  })

  it('fires onNext / onPrev / onFinish from the right buttons', async () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    const onFinish = vi.fn()

    // middle step: Prev + Next exist
    const mid = render(WizardShell, {
      props: { step: 2, total: 5, onPrev, onNext, onFinish },
    })
    await fireEvent.click(mid.getByText('wizard.previous'))
    await fireEvent.click(mid.getByText('wizard.next'))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onFinish).not.toHaveBeenCalled()

    // last step: Finish fires onFinish
    const last = render(WizardShell, {
      props: { step: 4, total: 5, onPrev, onNext, onFinish },
    })
    await fireEvent.click(last.getByText('wizard.finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('disables advance when canAdvance is false', () => {
    const { getByText } = render(WizardShell, {
      props: { step: 4, total: 5, canAdvance: false },
    })
    expect(getByText('wizard.finish').closest('button')).toBeDisabled()
  })
})
