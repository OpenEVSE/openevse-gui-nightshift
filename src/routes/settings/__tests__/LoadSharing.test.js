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
import { claims_target_store } from '../../../lib/stores/claims_target.js'
import { loadsharing_store } from '../../../lib/stores/loadsharing.js'
import { EvseClients } from '../../../lib/vars.js'
import LoadSharing from '../LoadSharing.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockImplementation((method, url) => {
    if (method === 'GET' && url === '/loadsharing/peers') {
      return Promise.resolve([{ id: 'peer-1', name: 'Garage', host: 'garage.local', online: true, joined: true }])
    }
    if (method === 'GET' && url === '/loadsharing/status') {
      return Promise.resolve({
        enabled: true,
        group_id: 'main',
        computed_at: 1,
        failsafe_active: false,
        online_count: 1,
        offline_count: 0,
        peers: [{ id: 'peer-1', name: 'Garage', host: 'garage.local', online: true, joined: true }],
        allocations: [{ id: 'peer-1', target_current: 12, reason: 'equal_share' }],
      })
    }
    return Promise.resolve({ msg: 'done' })
  })
  loadsharing_store.set({ peers: [], status: null })
  claims_target_store.set({ properties: {}, claims: { state: null, charge_current: null } })
})

describe('LoadSharing page', () => {
  it('shows grouped load sharing settings when enabled', () => {
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: 'controller',
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_safety_factor: 0.9,
      loadsharing_heartbeat_timeout: 15,
      loadsharing_failsafe_mode: 'safe_current',
      loadsharing_failsafe_safe_current: 6,
      loadsharing_failsafe_peer_assumed_current: 6,
      loadsharing_priority: 0,
      loadsharing_rotation_interval: 1800,
    })
    const { getByText } = render(LoadSharing)
    expect(getByText('config.loadsharing.group_id')).toBeInTheDocument()
    expect(getByText('config.loadsharing.role')).toBeInTheDocument()
    expect(getByText('config.loadsharing.site_max_current')).toBeInTheDocument()
    expect(getByText('config.loadsharing.failsafe_peer_assumed_current')).toBeInTheDocument()
    expect(getByText('config.loadsharing.priority')).toBeInTheDocument()
    expect(getByText('config.loadsharing.rotation_interval')).toBeInTheDocument()
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
      loadsharing_safety_factor: 0.9,
      loadsharing_heartbeat_timeout: 15,
      loadsharing_failsafe_mode: 'safe_current',
      loadsharing_failsafe_safe_current: 6,
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
        enabled: true,
        group_id: 'main',
        computed_at: 1,
        failsafe_active: false,
        online_count: 1,
        offline_count: 0,
      },
    })
    claims_target_store.set({
      properties: { max_current: 10 },
      claims: { state: null, max_current: EvseClients.shaper.id },
    })
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: 'member',
      loadsharing_controller_host: 'controller.local',
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_safety_factor: 0.9,
      loadsharing_heartbeat_timeout: 15,
      loadsharing_failsafe_mode: 'safe_current',
      loadsharing_failsafe_safe_current: 6,
      loadsharing_failsafe_peer_assumed_current: 6,
    })
    httpAPI.mockImplementation((method, url) => {
      if (method === 'GET' && url === '/loadsharing/peers') {
        return Promise.resolve([{ id: 'peer-controller', name: 'Main Panel', host: 'controller.local', online: true }])
      }
      if (method === 'GET' && url === '/loadsharing/status') {
        return Promise.resolve({
          enabled: true,
          group_id: 'main',
          computed_at: 1,
          failsafe_active: false,
          online_count: 1,
          offline_count: 0,
        })
      }
      return Promise.resolve({ msg: 'done' })
    })
    const { getByText, queryByText } = render(LoadSharing)
    expect(getByText('config.loadsharing.controlled_by')).toBeInTheDocument()
    expect(getByText('Main Panel')).toBeInTheDocument()
    expect(queryByText('config.loadsharing.peers')).not.toBeInTheDocument()
    expect(queryByText('config.loadsharing.group_id')).not.toBeInTheDocument()
  })
})
