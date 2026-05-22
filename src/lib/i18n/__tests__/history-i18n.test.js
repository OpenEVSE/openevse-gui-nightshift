import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('history i18n keys', () => {
  it('has the history block', () => {
    expect(en.history.loading).toBeTypeOf('string')
    expect(en.history.empty).toBeTypeOf('string')
    expect(en.history.error_title).toBeTypeOf('string')
    expect(en.history.error_body).toBeTypeOf('string')
    expect(en.history.retry).toBeTypeOf('string')
    expect(en.history.types.information).toBeTypeOf('string')
    expect(en.history.types.notification).toBeTypeOf('string')
    expect(en.history.types.warning).toBeTypeOf('string')
  })
})
