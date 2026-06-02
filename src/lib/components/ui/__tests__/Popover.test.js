import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

import Popover from '../Popover.svelte'

const panel = createRawSnippet(() => ({
  render: () => `<div data-testid="panel">panel</div>`,
}))

describe('Popover', () => {
  it('renders the panel only when open', () => {
    const closed = render(Popover, { props: { open: false, children: panel } })
    expect(closed.queryByTestId('panel')).not.toBeInTheDocument()
    closed.unmount()
    const opened = render(Popover, { props: { open: true, children: panel } })
    expect(opened.getByTestId('panel')).toBeInTheDocument()
  })

  it('calls onclose when the backdrop is clicked', async () => {
    const onclose = vi.fn()
    const { getByRole } = render(Popover, { props: { open: true, onclose, children: panel } })
    await fireEvent.click(getByRole('presentation'))
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('calls onclose on Escape', async () => {
    const onclose = vi.fn()
    render(Popover, { props: { open: true, onclose, children: panel } })
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('right-aligns the panel when align is right', () => {
    const { getByRole } = render(Popover, { props: { open: true, align: 'right', children: panel } })
    expect(getByRole('menu').className).toContain('right-0')
  })

  it('left-aligns by default', () => {
    const { getByRole } = render(Popover, { props: { open: true, children: panel } })
    expect(getByRole('menu').className).toContain('left-0')
  })
})
