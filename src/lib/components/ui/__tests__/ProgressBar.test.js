import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ProgressBar from '../ProgressBar.svelte'

describe('ProgressBar', () => {
  it('exposes the value via aria attributes', () => {
    const { getByRole } = render(ProgressBar, { props: { value: 60 } })
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  })

  it('clamps values above 100', () => {
    const { getByRole } = render(ProgressBar, { props: { value: 150 } })
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
})
