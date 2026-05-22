import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('alert i18n keys', () => {
  it('has the alert block', () => {
    expect(en.alert.write_failed_title).toBeTypeOf('string')
    expect(en.alert.write_failed_body).toBeTypeOf('string')
  })
})
