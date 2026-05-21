import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('logs-states i18n keys', () => {
  it('has descriptions for every EVSE state getStateDesc looks up', () => {
    const states = en['logs-states']
    expect(states).toBeTypeOf('object')
    for (const key of [
      'loading', 'active-nocar', 'active-car', 'active-charge',
      'error-vent', 'error-diode', 'error-gfi', 'error-ground',
      'error-relay', 'error-gfitest', 'error-temp', 'error-current',
      'sleeping', 'disabled',
    ]) {
      expect(states[key]).toBeTypeOf('string')
    }
  })
})
