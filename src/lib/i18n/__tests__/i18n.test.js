import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('i18n English catalog', () => {
  it('has the keys the shell needs', () => {
    expect(en.nav.home).toBeTypeOf('string')
    expect(en.nav.charge_manager).toBeTypeOf('string')
    expect(en.nav.monitoring).toBeTypeOf('string')
    expect(en.nav.history).toBeTypeOf('string')
    expect(en.connection.lost).toBeTypeOf('string')
    expect(en.loading).toBeTypeOf('string')
  })
})
