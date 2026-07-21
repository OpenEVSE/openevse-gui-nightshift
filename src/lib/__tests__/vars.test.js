import { describe, it, expect } from 'vitest'
import { EvseClients } from '../vars.js'

describe('EvseClients', () => {
  it('should have all expected client keys', () => {
    const expectedKeys = [
      'manual', 'divert', 'boost', 'timer', 'limit',
      'error', 'ohm', 'ocpp', 'rfid', 'mqtt', 'shaper', 'loadsharing', 'tempThrottle'
    ]
    expect(Object.keys(EvseClients)).toEqual(expectedKeys)
  })

  it('should have unique client ids', () => {
    const ids = Object.values(EvseClients).map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have correct id values', () => {
    expect(EvseClients.manual.id).toBe(65537)
    expect(EvseClients.divert.id).toBe(65538)
    expect(EvseClients.boost.id).toBe(65539)
    expect(EvseClients.timer.id).toBe(65540)
    expect(EvseClients.limit.id).toBe(65542)
    expect(EvseClients.error.id).toBe(65543)
    expect(EvseClients.ohm.id).toBe(65544)
    expect(EvseClients.ocpp.id).toBe(65545)
    expect(EvseClients.rfid.id).toBe(65546)
    expect(EvseClients.mqtt.id).toBe(65547)
    expect(EvseClients.shaper.id).toBe(65548)
    expect(EvseClients.loadsharing.id).toBe(0x0001000E)
    expect(EvseClients.tempThrottle.id).toBe(0x0001000D)
  })

  it('should have correct priority values', () => {
    expect(EvseClients.manual.priority).toBe(1000)
    expect(EvseClients.divert.priority).toBe(50)
    expect(EvseClients.boost.priority).toBe(200)
    expect(EvseClients.timer.priority).toBe(100)
    expect(EvseClients.limit.priority).toBe(1100)
    expect(EvseClients.error.priority).toBe(10000)
    expect(EvseClients.ohm.priority).toBe(500)
    expect(EvseClients.ocpp.priority).toBe(1050)
    expect(EvseClients.rfid.priority).toBe(1030)
    expect(EvseClients.mqtt.priority).toBe(500)
    expect(EvseClients.shaper.priority).toBe(5000)
    expect(EvseClients.loadsharing.priority).toBe(5000)
    expect(EvseClients.tempThrottle.priority).toBe(10000)
  })

  it('error client should have highest priority', () => {
    const maxPriority = Math.max(...Object.values(EvseClients).map(c => c.priority))
    expect(EvseClients.error.priority).toBe(maxPriority)
  })

  it('divert client should have lowest priority', () => {
    const minPriority = Math.min(...Object.values(EvseClients).map(c => c.priority))
    expect(EvseClients.divert.priority).toBe(minPriority)
  })

  it('each client should have id and priority properties', () => {
    for (const [key, client] of Object.entries(EvseClients)) {
      expect(client).toHaveProperty('id')
      expect(client).toHaveProperty('priority')
      expect(typeof client.id).toBe('number')
      expect(typeof client.priority).toBe('number')
    }
  })

  it('exposes the temperature-throttle client with id 0x0001000D and Safety priority', () => {
    expect(EvseClients.tempThrottle).toEqual({ id: 0x0001000D, priority: 10000 })
  })
})
