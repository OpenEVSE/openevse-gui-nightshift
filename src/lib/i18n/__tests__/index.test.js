import { describe, it, expect, beforeAll } from 'vitest'
import { get } from 'svelte/store'
import { dictionary, waitLocale } from 'svelte-i18n'
import { setupI18n } from '../index.js'
import esSource from '../source/es.json'
import frSource from '../source/fr.json'
import huSource from '../source/hu.json'

// index.js registers es/fr/hu behind an async loader (import en.json + the
// position-encoded values, then hydrateLocale) rather than a plain JSON
// import. hydrate.test.js checks hydrateLocale itself is correct; this
// drives the loaders svelte-i18n actually calls, so a wiring mistake in
// index.js (wrong import, swapped Promise.all order, etc.) would fail here
// even if hydrateLocale in isolation is fine.
describe('registered locale loaders', () => {
  beforeAll(() => {
    setupI18n()
  })

  for (const [locale, source] of [
    ['es', esSource],
    ['fr', frSource],
    ['hu', huSource],
  ]) {
    it(`${locale} resolves through svelte-i18n to the full source dictionary`, async () => {
      await waitLocale(locale)
      expect(get(dictionary)[locale]).toEqual(source)
    })
  }
})
