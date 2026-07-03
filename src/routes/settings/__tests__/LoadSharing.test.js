import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { loadsharing_store } from '../../../lib/stores/loadsharing.js'
import LoadSharing from '../LoadSharing.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockImplementation((method, url) => {
    if (method === 'GET' && url === '/loadsharing/peers') {
      return Promise.resolve([{ id: 'peer-1', name: 'Garage', host: 'garage.local', online: true, joined: true }])
    }
    if (method === 'GET' && url === '/loadsharing/status') {
      return Promise.resolve({
        peers: [{ id: 'peer-1', name: 'Garage', host: 'garage.local', online: true, joined: true }],
        allocations: [{ id: 'peer-1', target_current: 12, reason: 'equal_share' }],
      })
    }
    return Promise.resolve({ msg: 'done' })
  })
  loadsharing_store.set({ peers: [], status: null })
})

describe('LoadSharing page', () => {
  it('shows grouped load sharing settings when enabled', () => {
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: 'controller',
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_failsafe_peer_assumed_current: 6,
    })
    const { getByText } = render(LoadSharing)
    expect(getByText('config.loadsharing.group_id')).toBeInTheDocument()
    expect(getByText('config.loadsharing.site_max_current')).toBeInTheDocument()
    expect(getByText('config.loadsharing.min_per_evse_current')).toBeInTheDocument()
  })

  it('renders peer management for controller role', async () => {
    loadsharing_store.set({
      peers: [{ id: 'peer-1', name: 'Garage', host: 'garage.local', online: true, joined: true }],
      status: {
        peers: [{ id: 'peer-1', name: 'Garage', host: 'garage.local', online: true, joined: true }],
        allocations: [{ id: 'peer-1', target_current: 12, reason: 'equal_share' }],
      },
    })
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: 'controller',
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_failsafe_peer_assumed_current: 6,
    })
    const { getByText, queryByText } = render(LoadSharing)
    expect(getByText('config.loadsharing.peers')).toBeInTheDocument()
    expect(getByText('Garage')).toBeInTheDocument()
    expect(queryByText('config.loadsharing.controlled_by')).not.toBeInTheDocument()
  })

  it('renders controlled-by panel for member role', async () => {
    loadsharing_store.set({
      peers: [{ id: 'peer-controller', name: 'Main Panel', host: 'controller.local', online: true }],
      status: {
        controller: { id: 'peer-controller', name: 'Main Panel', url: 'http://controller.local' },
        member: { assigned_limit: 10, last_command_age: 4, comms_status: 'online' },
      },
    })
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: 'member',
      loadsharing_controller_host: 'controller.local',
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_failsafe_peer_assumed_current: 6,
    })
    httpAPI.mockImplementation((method, url) => {
      if (method === 'GET' && url === '/loadsharing/peers') {
        return Promise.resolve([{ id: 'peer-controller', name: 'Main Panel', host: 'controller.local', online: true }])
      }
      if (method === 'GET' && url === '/loadsharing/status') {
        return Promise.resolve({
          controller: { id: 'peer-controller', name: 'Main Panel', url: 'http://controller.local' },
          member: { assigned_limit: 10, last_command_age: 4, comms_status: 'online' },
        })
      }
      return Promise.resolve({ msg: 'done' })
    })
    const { getByText, queryByText } = render(LoadSharing)
    expect(getByText('config.loadsharing.controlled_by')).toBeInTheDocument()
    expect(getByText('Main Panel')).toBeInTheDocument()
    expect(queryByText('config.loadsharing.peers')).not.toBeInTheDocument()
  })
})
