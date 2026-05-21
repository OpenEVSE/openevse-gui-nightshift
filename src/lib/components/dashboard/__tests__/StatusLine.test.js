import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import StatusLine from '../StatusLine.svelte'

describe('StatusLine', () => {
  it('shows the charging status text', () => {
    const { getByText } = render(StatusLine, { props: { display: 'charging' } })
    expect(getByText(/dashboard\.status\.charging/)).toBeInTheDocument()
  })
  it('shows the error status text', () => {
    const { getByText } = render(StatusLine, { props: { display: 'error' } })
    expect(getByText(/dashboard\.status\.error/)).toBeInTheDocument()
  })
})
