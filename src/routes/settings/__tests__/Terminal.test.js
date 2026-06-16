// src/routes/settings/__tests__/Terminal.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import Terminal from '../Terminal.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ cmd: '$GE', ret: '$OK 0 0^20' })
})

describe('Terminal page', () => {
  it('sends a RAPI command and shows the result', async () => {
    const { getByLabelText, getByText } = render(Terminal)
    const input = getByLabelText('config.terminal.command')
    await fireEvent.input(input, { target: { value: '$GE' } })
    await fireEvent.click(getByText('config.terminal.send'))
    expect(httpAPI).toHaveBeenCalledWith('GET', '/r?json=1&rapi=$GE')
    await vi.waitFor(() => {
      expect(getByText(/\$OK 0 0\^20/)).toBeInTheDocument()
    })
  })

  it('sends the command when Enter is pressed in the input', async () => {
    const { getByLabelText } = render(Terminal)
    const input = getByLabelText('config.terminal.command')
    await fireEvent.input(input, { target: { value: '$GE' } })
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(httpAPI).toHaveBeenCalledWith('GET', '/r?json=1&rapi=$GE')
  })

  it('does not send when the input is empty or only the "$" prefix', async () => {
    const { getByLabelText, getByText } = render(Terminal)
    const input = getByLabelText('config.terminal.command')

    // Default "$" only — Enter and Send must both be no-ops.
    await fireEvent.keyDown(input, { key: 'Enter' })
    await fireEvent.click(getByText('config.terminal.send'))

    await fireEvent.input(input, { target: { value: '   ' } })
    await fireEvent.keyDown(input, { key: 'Enter' })

    expect(httpAPI).not.toHaveBeenCalled()
  })

  it('clears the RAPI result log', async () => {
    const { getByLabelText, getByText, queryByText } = render(Terminal)
    await fireEvent.input(getByLabelText('config.terminal.command'), { target: { value: '$GE' } })
    await fireEvent.click(getByText('config.terminal.send'))
    await vi.waitFor(() => expect(queryByText(/\$OK/)).toBeInTheDocument())
    await fireEvent.click(getByText('config.terminal.clear'))
    expect(queryByText(/\$OK/)).not.toBeInTheDocument()
  })
})
