import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/svelte'

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
      return Promise.resolve([{ id: 'peer-1', name: 'Garage', host: 'garage.local', url: 'http://garage.local', online: true, joined: true }])
    }
    if (method === 'GET' && url === '/loadsharing/status') {
      return Promise.resolve({
        enabled: true,
        group_id: 'main',
        computed_at: 1,
        failsafe_active: false,
        online_count: 1,
        offline_count: 0,
        peers: [{ id: 'peer-1', name: 'Garage', host: 'garage.local', url: 'http://garage.local', online: true, joined: true }],
        allocations: [{ id: 'peer-1', target_current: 12, reason: 'equal_share' }],
      })
    }
    return Promise.resolve({ msg: 'done' })
  })
  loadsharing_store.set({ peers: [], status: null })
  claims_target_store.set({ properties: {}, claims: { state: null, charge_current: null } })
  // Page is Labs-gated; default it on so the existing cases render it.
  config_store.update((c) => ({ ...c, labs_enabled: true }))
  window.location.hash = '#/settings/loadsharing'
})

describe('LoadSharing page', () => {
  it('redirects to the settings index when Labs (dev features) is off', () => {
    config_store.update((c) => ({ ...c, labs_enabled: false }))
    config_store.set({ loadsharing_enabled: true, loadsharing_role: false })
    render(LoadSharing)
    expect(window.location.hash).toBe('#/settings')
  })

  it('shows grouped load sharing settings when enabled', () => {
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: false,
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_safety_factor: 0.9,
      loadsharing_heartbeat_timeout: 15,
      loadsharing_failsafe_mode: 'safe_current',
      loadsharing_failsafe_safe_current: 6,
      loadsharing_failsafe_peer_assumed_current: 6,
      loadsharing_rotation_interval: 1800,
    })
    const { getByText, queryByText } = render(LoadSharing)
    expect(getByText('config.loadsharing.group_id')).toBeInTheDocument()
    expect(getByText('config.loadsharing.site_max_current')).toBeInTheDocument()
    expect(getByText('config.loadsharing.failsafe_peer_assumed_current')).toBeInTheDocument()
    expect(getByText('config.loadsharing.rotation_interval')).toBeInTheDocument()
    // No top-level Priority field: firmware has no loadsharing_priority key;
    // priority is per-peer only (peer_priority in the peer table/details).
    expect(queryByText('config.loadsharing.priority')).not.toBeInTheDocument()
    // Role is a read-only row in Group status now, not a selectable field.
    expect(getByText('config.loadsharing.role')).toBeInTheDocument()
    expect(getByText('config.loadsharing.role_controller')).toBeInTheDocument()
  })

  it('offers the group key to a member, which holds its own copy', () => {
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: true,
      loadsharing_controller_host: 'controller.local',
      loadsharing_group_key: '',
    })
    const { getByText } = render(LoadSharing)
    expect(getByText('config.loadsharing.group_key')).toBeInTheDocument()
    expect(getByText('config.loadsharing.group_key_generate')).toBeInTheDocument()
  })

  it('shows a generated key once it has been saved, and never before', async () => {
    config_store.set({ loadsharing_enabled: true, loadsharing_role: false, loadsharing_group_key: '' })
    httpAPI.mockImplementation((method, path) =>
      Promise.resolve(method === 'POST' && path === '/config' ? { msg: 'done' } : []),
    )
    const { getByText, queryByText } = render(LoadSharing)
    expect(queryByText('config.loadsharing.group_key_generated')).not.toBeInTheDocument()

    await fireEvent.click(getByText('config.loadsharing.group_key_generate'))

    await waitFor(() =>
      expect(getByText('config.loadsharing.group_key_generated')).toBeInTheDocument(),
    )
    const post = httpAPI.mock.calls.find(([m, p]) => m === 'POST' && p === '/config')
    const { loadsharing_group_key: key } = JSON.parse(post[2])
    expect(key).toMatch(/^[0-9a-f]{48}$/)
    expect(getByText(key)).toBeInTheDocument()
  })

  it('hides the group key on firmware that does not report one', () => {
    // Older firmware ignores the key, so Generate would "save" a key that
    // protects nothing and invite the user to copy it everywhere.
    config_store.set({ loadsharing_enabled: true, loadsharing_role: false })
    const { queryByText } = render(LoadSharing)
    expect(queryByText('config.loadsharing.group_key')).not.toBeInTheDocument()
    expect(queryByText('config.loadsharing.group_key_generate')).not.toBeInTheDocument()
  })

  it('asks before replacing a key that is already set', async () => {
    config_store.set({ loadsharing_enabled: true, loadsharing_role: false, loadsharing_group_key: '_DUMMY_PASSWORD' })
    httpAPI.mockImplementation((method, path) =>
      Promise.resolve(method === 'POST' && path === '/config' ? { msg: 'done' } : []),
    )
    const { getByText, getByRole } = render(LoadSharing)

    await fireEvent.click(getByText('config.loadsharing.group_key_generate'))
    expect(getByText('config.loadsharing.group_key_replace_warning')).toBeInTheDocument()
    expect(httpAPI.mock.calls.some(([m, p]) => m === 'POST' && p === '/config')).toBe(false)

    await fireEvent.click(getByRole('button', { name: 'config.loadsharing.group_key_replace' }))
    await waitFor(() =>
      expect(getByText('config.loadsharing.group_key_generated')).toBeInTheDocument(),
    )
    const post = httpAPI.mock.calls.find(([m, p]) => m === 'POST' && p === '/config')
    expect(JSON.parse(post[2]).loadsharing_group_key).toMatch(/^[0-9a-f]{48}$/)
  })

  it('removes a set key after confirmation', async () => {
    config_store.set({ loadsharing_enabled: true, loadsharing_role: false, loadsharing_group_key: '_DUMMY_PASSWORD' })
    httpAPI.mockImplementation((method, path) =>
      Promise.resolve(method === 'POST' && path === '/config' ? { msg: 'done' } : []),
    )
    const { getByText, getAllByText } = render(LoadSharing)

    await fireEvent.click(getByText('config.loadsharing.group_key_remove'))
    expect(getByText('config.loadsharing.group_key_remove_warning')).toBeInTheDocument()
    const buttons = getAllByText('config.loadsharing.group_key_remove')
    await fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() =>
      expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ loadsharing_group_key: '' })),
    )
  })

  it('offers no Remove when no key is set', () => {
    config_store.set({ loadsharing_enabled: true, loadsharing_role: false, loadsharing_group_key: '' })
    const { queryByText } = render(LoadSharing)
    expect(queryByText('config.loadsharing.group_key_remove')).not.toBeInTheDocument()
  })

  it('refuses a key shorter than the firmware accepts', async () => {
    config_store.set({ loadsharing_enabled: true, loadsharing_role: false, loadsharing_group_key: '' })
    const { container, getByText } = render(LoadSharing)
    const input = container.querySelector('input[type="password"][maxlength="64"]')
    await fireEvent.focus(input)
    await fireEvent.input(input, { target: { value: 'too-short' } })
    await fireEvent.blur(input)
    expect(getByText('config.loadsharing.group_key_length')).toBeInTheDocument()
    expect(httpAPI.mock.calls.some(([m, p]) => m === 'POST' && p === '/config')).toBe(false)
  })

  it('names a group key mismatch instead of a generic peer state', async () => {
    loadsharing_store.set({
      status: {
        peers: [{ host: 'peer.local', joined: true, online: false, error: 'auth_failed' }],
      },
    })
    config_store.set({ loadsharing_enabled: true, loadsharing_role: false })
    const { findByText } = render(LoadSharing)
    expect(await findByText('config.loadsharing.auth_failed')).toBeInTheDocument()
  })

  it('renders peer management for controller role', async () => {
    loadsharing_store.set({
      peers: [{ id: 'peer-1', name: 'Garage', host: 'garage.local', url: 'http://garage.local', online: true, joined: true }],
      status: {
        peers: [{ id: 'peer-1', name: 'Garage', host: 'garage.local', url: 'http://garage.local', online: true, joined: true }],
        allocations: [{ id: 'peer-1', target_current: 12, reason: 'equal_share' }],
      },
    })
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: false,
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
    expect(getByText('config.loadsharing.peer_online_value')).toBeInTheDocument()
    expect(queryByText('config.connected')).not.toBeInTheDocument()
    expect(queryByText('config.loadsharing.controlled_by')).not.toBeInTheDocument()
  })

  it('renders controlled-by panel for member role', async () => {
    loadsharing_store.set({
      peers: [{ id: 'peer-controller', name: 'Main Panel', host: 'controller.local', url: 'http://controller.local', online: true }],
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
      claims: { state: null, max_current: EvseClients.loadsharing.id },
    })
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: true,
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
        return Promise.resolve([{ id: 'peer-controller', name: 'Main Panel', host: 'controller.local', url: 'http://controller.local', online: true }])
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
    // Role reads "Member" (read-only) rather than exposing a role selector.
    expect(getByText('config.loadsharing.role_member')).toBeInTheDocument()
  })

  it('lets a member force-leave the group from the confirmation modal', async () => {
    loadsharing_store.set({
      peers: [{ id: 'peer-controller', name: 'Main Panel', host: 'controller.local', url: 'http://controller.local', online: true }],
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
      claims: { state: null, max_current: EvseClients.loadsharing.id },
    })
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: true,
      loadsharing_controller_host: 'controller.local',
      loadsharing_group_id: 'main',
    })
    httpAPI.mockImplementation((method, url) => {
      if (method === 'GET' && url === '/loadsharing/peers') {
        return Promise.resolve([{ id: 'peer-controller', name: 'Main Panel', host: 'controller.local', url: 'http://controller.local', online: true }])
      }
      if (method === 'GET' && url === '/loadsharing/status') {
        return Promise.resolve({ enabled: true, group_id: 'main', computed_at: 1, failsafe_active: false, online_count: 1, offline_count: 0 })
      }
      return Promise.resolve({ msg: 'done' })
    })

    const { getByText, queryByText } = render(LoadSharing)
    expect(queryByText('config.loadsharing.leave_warning')).not.toBeInTheDocument()

    await fireEvent.click(getByText('config.loadsharing.leave_group'))
    expect(getByText('config.loadsharing.leave_warning')).toBeInTheDocument()

    await fireEvent.click(getByText('config.loadsharing.force_removal'))

    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ loadsharing_role: false }))
    expect(queryByText('config.loadsharing.leave_warning')).not.toBeInTheDocument()
  })

  it('allows adding discovered peers from the peers list', async () => {
    loadsharing_store.set({
      peers: [{ id: 'peer-2', name: 'Yard', host: 'yard.local', url: 'http://yard.local', online: true, joined: false }],
      status: {
        peers: [{ id: 'peer-2', name: 'Yard', host: 'yard.local', url: 'http://yard.local', online: true, joined: false }],
        allocations: [],
      },
    })
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: false,
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_safety_factor: 0.9,
    })

    const addPeerSpy = vi.spyOn(loadsharing_store, 'addPeer').mockResolvedValue(true)
    const refreshSpy = vi.spyOn(loadsharing_store, 'refresh').mockResolvedValue(true)

    const { getByLabelText } = render(LoadSharing)
    const addButton = getByLabelText('config.loadsharing.add_peer')
    expect(addButton).toBeInTheDocument()

    await fireEvent.click(addButton)

    expect(addPeerSpy).toHaveBeenCalledWith('yard.local')
    expect(refreshSpy).toHaveBeenCalled()
  })

  it('allows refreshing peers from the controller toolbar', async () => {
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: false,
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_safety_factor: 0.9,
    })

    const refreshSpy = vi.spyOn(loadsharing_store, 'refresh').mockResolvedValue(true)

    const { getByText } = render(LoadSharing)
    await fireEvent.click(getByText('config.loadsharing.refresh'))

    expect(refreshSpy).toHaveBeenCalled()
  })

  it('shows peer details in a modal when clicking the details info button', async () => {
    loadsharing_store.set({
      peers: [{ id: 'peer-details-1', name: 'Secret Garden', host: 'secret.local', url: 'http://secret.local', online: true, joined: true }],
      status: {
        peers: [{ id: 'peer-details-1', name: 'Secret Garden', host: 'secret.local', url: 'http://secret.local', online: true, joined: true }],
        allocations: [{ id: 'peer-details-1', target_current: 16, reason: 'high_priority' }],
      },
    })
    config_store.set({
      loadsharing_enabled: true,
      loadsharing_role: false,
      loadsharing_group_id: 'main',
      loadsharing_group_max_current: 50,
      loadsharing_safety_factor: 1.0,
    })

    const { getByLabelText, getByText, queryByText } = render(LoadSharing)
    const detailsButton = getByLabelText('config.loadsharing.peer_details')
    expect(detailsButton).toBeInTheDocument()

    // Initially modal-only fields should not be present (or closed)
    expect(queryByText('secret.local')).not.toBeInTheDocument()

    // Trigger details modal
    await fireEvent.click(detailsButton)

    // Now it should be visible showing the detailed fields
    expect(getByText('config.loadsharing.close')).toBeInTheDocument()
    expect(getByText('secret.local')).toBeInTheDocument()
    expect(getByText('peer-details-1')).toBeInTheDocument()
    expect(getByText('16 A')).toBeInTheDocument()
  })
})
