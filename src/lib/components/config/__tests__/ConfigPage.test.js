// src/lib/components/config/__tests__/ConfigPage.test.js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

import { vi } from 'vitest'
vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ConfigPage from '../ConfigPage.svelte'

const body = createRawSnippet(() => ({ render: () => `<p>page body</p>` }))

describe('ConfigPage', () => {
  it('renders the title and a back link to the hub', () => {
    const { getByText, getByRole } = render(ConfigPage, { title: 'Network', children: body })
    expect(getByText('Network')).toBeInTheDocument()
    expect(getByRole('link')).toHaveAttribute('href', '#/settings')
  })
  it('renders slotted content', () => {
    const { getByText } = render(ConfigPage, { title: 'Network', children: body })
    expect(getByText('page body')).toBeInTheDocument()
  })
})
