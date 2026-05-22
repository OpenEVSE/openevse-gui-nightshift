// src/lib/components/config/__tests__/FormField.test.js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import FormField from '../FormField.svelte'

const control = createRawSnippet(() => ({ render: () => `<input data-testid="ctl" />` }))

describe('FormField', () => {
  it('renders the label, description and slotted control', () => {
    const { getByText, getByTestId } = render(FormField, {
      label: 'Hostname',
      description: 'The device name on the network',
      children: control,
    })
    expect(getByText('Hostname')).toBeInTheDocument()
    expect(getByText('The device name on the network')).toBeInTheDocument()
    expect(getByTestId('ctl')).toBeInTheDocument()
  })
  it('shows a saving spinner when status is saving', () => {
    const { container } = render(FormField, { label: 'X', status: 'saving', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:loading"]')).toBeTruthy()
  })
  it('shows a check when status is saved', () => {
    const { container } = render(FormField, { label: 'X', status: 'saved', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:check"]')).toBeTruthy()
  })
  it('shows an error icon when status is error', () => {
    const { container } = render(FormField, { label: 'X', status: 'error', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:alert-circle-outline"]')).toBeTruthy()
  })
  it('shows no status icon when idle', () => {
    const { container } = render(FormField, { label: 'X', status: 'idle', children: control })
    expect(container.querySelector('iconify-icon')).toBeFalsy()
  })
})
