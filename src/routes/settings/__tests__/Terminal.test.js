// src/routes/settings/__tests__/Terminal.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))
// Real writable so the component's get(uistates_store) reads what we set.
vi.mock('../../../lib/stores/uistates.js', async () => {
  const { writable } = await vi.importActual('svelte/store')
  return { uistates_store: writable({ rapi_available: true }) }
})

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Terminal from '../Terminal.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ cmd: '$GE', ret: '$OK 0 0^20' })
  // Default: a RAPI-capable device (the startup probe sets this; see FetchData).
  uistates_store.set({ rapi_available: true })
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

  it('on a RAPI device the input defaults to the "$" prefix', () => {
    const { getByLabelText } = render(Terminal)
    expect(getByLabelText('config.terminal.command').value).toBe('$')
  })

  it('on a non-RAPI device the console drops RAPI branding and the "$" default', () => {
    uistates_store.set({ rapi_available: false })
    const { getByLabelText, getByText, queryByText } = render(Terminal)
    // Generic title, not the RAPI one.
    expect(getByText('config.terminal.console')).toBeInTheDocument()
    expect(queryByText('config.terminal.rapi')).not.toBeInTheDocument()
    // Command box starts empty — no "$" prefix.
    expect(getByLabelText('config.terminal.command').value).toBe('')
  })

  it('on a non-RAPI device an empty command (no "$" default) does not send', async () => {
    uistates_store.set({ rapi_available: false })
    const { getByLabelText, getByText } = render(Terminal)
    await fireEvent.keyDown(getByLabelText('config.terminal.command'), { key: 'Enter' })
    await fireEvent.click(getByText('config.terminal.send'))
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
