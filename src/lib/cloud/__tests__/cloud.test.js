// src/lib/cloud/__tests__/cloud.test.js
import { describe, it, expect } from 'vitest'
import {
  hasCloudClient,
  localMqttHeldDown,
  localMqttNoticeKey,
  isThingName,
  identityState,
  cloudRunState,
  cloudStatus,
  droppedCount,
  THING_PATTERN,
} from '../cloud.js'

describe('hasCloudClient', () => {
  it('is true whenever cloud_enabled is present, whatever its value', () => {
    expect(hasCloudClient({ cloud_enabled: true })).toBe(true)
    // The important case: a claimed charger with the connection switched off
    // still needs the page, which is the whole reason presence is the gate.
    expect(hasCloudClient({ cloud_enabled: false })).toBe(true)
  })

  it('is false for a build that never serialises the key', () => {
    expect(hasCloudClient({ mqtt_enabled: true })).toBe(false)
  })

  it('is false for a config that has not loaded yet', () => {
    expect(hasCloudClient(null)).toBe(false)
    expect(hasCloudClient(undefined)).toBe(false)
  })
})

describe('localMqttHeldDown', () => {
  it('holds the publisher down only for the two deliberate reasons', () => {
    expect(localMqttHeldDown('one_connection')).toBe(true)
    expect(localMqttHeldDown('low_heap')).toBe(true)
  })

  it('leaves the page alone for the states it already renders', () => {
    expect(localMqttHeldDown('')).toBe(false)
    expect(localMqttHeldDown('not_configured')).toBe(false)
    expect(localMqttHeldDown(undefined)).toBe(false)
  })

  it('maps each hold-down to its own notice, and nothing else to one', () => {
    expect(localMqttNoticeKey('one_connection')).toBe('config.mqtt.held_one_connection')
    expect(localMqttNoticeKey('low_heap')).toBe('config.mqtt.held_low_heap')
    expect(localMqttNoticeKey('not_configured')).toBeNull()
    expect(localMqttNoticeKey('')).toBeNull()
  })
})

describe('isThingName', () => {
  it('accepts evse- plus twelve lowercase hex digits', () => {
    expect(isThingName('evse-a4cf12ab9cc0').ok).toBe(true)
    expect(isThingName('evse-000000000000').ok).toBe(true)
  })

  it('rejects everything the firmware rejects', () => {
    for (const bad of [
      'evse-A4CF12AB9CC0', // uppercase
      'evse-a4cf12ab9cc', // eleven digits
      'evse-a4cf12ab9cc00', // thirteen
      'evse-a4cf12ab9ccg', // not hex
      'a4cf12ab9cc0', // no prefix
      'openevse-9cc0',
      '',
      null,
      undefined,
      12,
    ]) {
      expect(isThingName(bad).ok, String(bad)).toBe(false)
    }
  })

  it('names the validation message when it rejects', () => {
    expect(isThingName('nope').msgKey).toBe('config.validation.cloud_thing')
    expect(isThingName('evse-a4cf12ab9cc0').msgKey).toBeNull()
  })

  it('anchors the pattern at both ends', () => {
    expect(THING_PATTERN.test('xevse-a4cf12ab9cc0')).toBe(false)
    expect(THING_PATTERN.test('evse-a4cf12ab9cc0x')).toBe(false)
  })
})

describe('identityState', () => {
  it('prefers the name the firmware reports on /status', () => {
    expect(identityState({ cloud_thing: '' }, 'evse-a4cf12ab9cc0')).toEqual({
      value: 'evse-a4cf12ab9cc0',
      state: 'active',
    })
  })

  it('reads an empty reported name as not-yet-claimed, not as an error', () => {
    // The firmware only fills the reported name inside a connection attempt,
    // so this is what an unclaimed charger — and one with the connection
    // switched off — looks like.
    expect(identityState({}, '')).toEqual({ value: '', state: 'unclaimed' })
    expect(identityState(null, undefined)).toEqual({ value: '', state: 'unclaimed' })
  })

  it('shows a configured-but-unused name as pending', () => {
    expect(identityState({ cloud_thing: 'evse-a4cf12ab9cc0' }, '')).toEqual({
      value: 'evse-a4cf12ab9cc0',
      state: 'pending',
    })
  })

  it('calls out a malformed configured name — the reconnect-loop case', () => {
    expect(identityState({ cloud_thing: 'evse-nope' }, '')).toEqual({
      value: 'evse-nope',
      state: 'invalid',
    })
  })
})

describe('cloudRunState', () => {
  const claimed = {
    cloud_enabled: true,
    cloud_server: 'broker.example.net',
    cloud_agent_interval: 60,
  }

  it('mirrors the firmware gate: enabled, a server, a non-zero interval', () => {
    expect(cloudRunState(claimed)).toBe('running')
  })

  it('reports a build without the client as unsupported', () => {
    expect(cloudRunState({ mqtt_enabled: true })).toBe('unsupported')
  })

  it('reports the off switch', () => {
    expect(cloudRunState({ ...claimed, cloud_enabled: false })).toBe('disabled')
  })

  it('reports a missing or blank server as unclaimed', () => {
    expect(cloudRunState({ ...claimed, cloud_server: '' })).toBe('unclaimed')
    expect(cloudRunState({ ...claimed, cloud_server: '   ' })).toBe('unclaimed')
    expect(cloudRunState({ cloud_enabled: true, cloud_agent_interval: 60 })).toBe('unclaimed')
  })

  it('reports a zero interval, which stops the client in firmware', () => {
    expect(cloudRunState({ ...claimed, cloud_agent_interval: 0 })).toBe('interval_zero')
    expect(cloudRunState({ ...claimed, cloud_agent_interval: undefined })).toBe('interval_zero')
  })

  it('checks the off switch before the rest, so an off client reads as off', () => {
    expect(cloudRunState({ cloud_enabled: false })).toBe('disabled')
  })
})

describe('cloudStatus', () => {
  const claimed = {
    cloud_enabled: true,
    cloud_server: 'broker.example.net',
    cloud_agent_interval: 60,
  }

  it('reports the live connection once the client is allowed to run', () => {
    expect(cloudStatus(claimed, true)).toBe('connected')
    expect(cloudStatus(claimed, false)).toBe('disconnected')
  })

  it('reports why it is held back instead, when it is', () => {
    expect(cloudStatus({ ...claimed, cloud_enabled: false }, false)).toBe('disabled')
    expect(cloudStatus({ ...claimed, cloud_server: '' }, false)).toBe('unclaimed')
    expect(cloudStatus({ ...claimed, cloud_agent_interval: 0 }, false)).toBe('interval_zero')
  })

  it('never claims connected while the client is held back', () => {
    // Stale status_store data must not outvote the configuration.
    expect(cloudStatus({ ...claimed, cloud_enabled: false }, true)).toBe('disabled')
  })
})

describe('droppedCount', () => {
  it('takes a fresh /status as authoritative', () => {
    expect(droppedCount({ cloud_connected: 1, cloud_dropped: 3 }, {})).toBe(3)
  })

  it('reads the key missing from a fresh /status as zero', () => {
    // The firmware omits cloud_dropped when it is zero, and the WebSocket merge
    // is a shallow spread, so a value seen once would otherwise stick forever.
    expect(droppedCount({ cloud_connected: 1 }, { cloud_dropped: 3 })).toBe(0)
  })

  it('falls back to the store before the first poll lands', () => {
    expect(droppedCount(null, { cloud_dropped: 3 })).toBe(3)
    expect(droppedCount(undefined, {})).toBe(0)
    expect(droppedCount(null, null)).toBe(0)
  })

  it('never reports a negative or unparseable count', () => {
    expect(droppedCount({ cloud_dropped: -1 }, {})).toBe(0)
    expect(droppedCount({ cloud_dropped: 'lots' }, {})).toBe(0)
  })
})
