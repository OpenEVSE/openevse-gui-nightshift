// src/routes/settings/__tests__/Ohmconnect.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import Ohmconnect from '../Ohmconnect.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ ohm_hour: 'NotConnected' })
})

describe('OhmConnect page', () => {
  it('hides the key field until ohm is enabled', () => {
    config_store.set({ ohm_enabled: false })
    const { queryByText } = render(Ohmconnect)
    expect(queryByText('config.ohmconnect.key')).not.toBeInTheDocument()
  })

  it('shows the key field when ohm is enabled', () => {
    config_store.set({ ohm_enabled: true, ohm: '' })
    const { getByText } = render(Ohmconnect)
    expect(getByText('config.ohmconnect.key')).toBeInTheDocument()
  })

  it('saves the enable toggle', async () => {
    config_store.set({ ohm_enabled: false })
    const { getByRole } = render(Ohmconnect)
    await fireEvent.click(getByRole('switch'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ ohm_enabled: true }))
  })
})
