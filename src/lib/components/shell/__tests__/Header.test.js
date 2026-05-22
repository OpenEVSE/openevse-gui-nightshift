import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import Header from '../Header.svelte'

describe('Header', () => {
  it('shows the device name', () => {
    const { getByText } = render(Header, {
      props: { deviceName: 'Garage EVSE', wsConnected: true, evseConnected: true },
    })
    expect(getByText('Garage EVSE')).toBeInTheDocument()
  })

  it('labels the dot as connected when both links are up', () => {
    const { getByLabelText } = render(Header, {
      props: { deviceName: 'X', wsConnected: true, evseConnected: true },
    })
    const dot = getByLabelText('connection.connected')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('title', 'connection.connected')
  })

  it('labels the dot lost when the websocket is down', () => {
    const { getByLabelText } = render(Header, {
      props: { deviceName: 'X', wsConnected: false, evseConnected: true },
    })
    expect(getByLabelText('connection.lost')).toBeInTheDocument()
  })

  it('labels the dot evse-missing when only the EVSE link is down', () => {
    const { getByLabelText } = render(Header, {
      props: { deviceName: 'X', wsConnected: true, evseConnected: false },
    })
    expect(getByLabelText('connection.evse_missing')).toBeInTheDocument()
  })
})
