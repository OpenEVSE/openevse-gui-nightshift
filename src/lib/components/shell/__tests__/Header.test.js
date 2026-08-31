import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// Drive the native-host bridge from the test: a writable stands in for the
// host store so we can flip hasDrawer, and openDrawer is a spy.
vi.mock('../../../nativeHost.js', async () => {
  const { writable } = await import('svelte/store')
  return { host: writable({ embedded: false, hasDrawer: false }), openDrawer: vi.fn() }
})

import { host as mockHost, openDrawer } from '../../../nativeHost.js'
import Header from '../Header.svelte'

beforeEach(() => {
  mockHost.set({ embedded: false, hasDrawer: false })
  openDrawer.mockClear()
})

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

  it('hides the app-menu button outside the phone app', () => {
    // Default bridge state: not embedded — a plain browser shows no app menu.
    const { queryByLabelText } = render(Header, { props: { deviceName: 'X' } })
    expect(queryByLabelText('header.app_menu')).toBeNull()
  })

  it('shows an app-menu button inside the app that opens the drawer', async () => {
    mockHost.set({ embedded: true, hasDrawer: true })
    const { getByLabelText } = render(Header, { props: { deviceName: 'X' } })

    const btn = getByLabelText('header.app_menu')
    expect(btn.tagName).toBe('BUTTON')

    await fireEvent.click(btn)
    expect(openDrawer).toHaveBeenCalledTimes(1)
  })
})
