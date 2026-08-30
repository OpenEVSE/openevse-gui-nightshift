import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('monitoring i18n keys', () => {
  it('has the monitoring block', () => {
    expect(en.monitoring.tab.data).toBeTypeOf('string')
    expect(en.monitoring.tab.health).toBeTypeOf('string')
    expect(en.monitoring.tab.manager).toBeTypeOf('string')
    expect(en.monitoring.group.energy).toBeTypeOf('string')
    expect(en.monitoring.energy.session).toBeTypeOf('string')
    expect(en.monitoring.sensor.pilot).toBeTypeOf('string')
    expect(en.monitoring.service.level).toBeTypeOf('string')
    expect(en.monitoring.vehicle.battery).toBeTypeOf('string')
    expect(en.monitoring.safety.errors).toBeTypeOf('string')
    expect(en.monitoring.safety.switches).toBeTypeOf('string')
    expect(en.monitoring.health.relay.title).toBeTypeOf('string')
    expect(en.monitoring.health.relay.reset_button).toBeTypeOf('string')
    expect(en.monitoring.manager.empty).toBeTypeOf('string')
  })
  it('has units and clients blocks', () => {
    expect(en.units.kwh).toBeTypeOf('string')
    expect(en.units.amp).toBeTypeOf('string')
    expect(en.units.celsius).toBeTypeOf('string')
    expect(en.clients.manual).toBeTypeOf('string')
    expect(en.clients.null).toBeTypeOf('string')
  })
})
