import { describe, it, expect } from 'vitest'
import en from '../en.json'
// The translator-maintained catalogs. src/lib/i18n/{es,fr,hu}.json are
// generated, position-encoded value arrays (scripts/build-locale-values.mjs),
// so they cannot be indexed by key; these are what a translator edits.
import es from '../source/es.json'
import fr from '../source/fr.json'
import hu from '../source/hu.json'

const KEYS = [
  'upload', 'upload_confirm_title', 'upload_confirm_body', 'upload_confirm_yes',
  'upload_progress', 'upload_done', 'upload_failed',
  'upload_deferred', 'upload_cancel_deferred',
]

describe('crash upload strings', () => {
  it.each([['en', en], ['es', es], ['fr', fr], ['hu', hu]])(
    '%s has every upload string', (_name, locale) => {
      for (const k of KEYS) {
        expect(locale.config.terminal.crash[k], k).toBeTruthy()
      }
    })

  it.each([['es', es], ['fr', fr], ['hu', hu]])(
    '%s is translated, not English copied across', (_name, locale) => {
      // A missing translation falls back to English at runtime anyway; an
      // English string pasted into another catalog hides that it is missing.
      for (const k of ['upload', 'upload_confirm_body', 'upload_deferred']) {
        expect(locale.config.terminal.crash[k], k)
          .not.toBe(en.config.terminal.crash[k])
      }
    })

  it('the confirmation names the credentials, in every locale', () => {
    // A user clicking this is sending their Wi-Fi password and every stored
    // token off the device. Consent that does not say so is not consent
    // (spec section 8) -- so every locale must actually mention it, not just
    // carry some text.
    const mentions = {
      en: /wi-?fi/i, es: /wi-?fi/i, fr: /wi-?fi/i, hu: /wi-?fi/i,
    }
    for (const [name, l] of Object.entries({ en, es, fr, hu })) {
      expect(l.config.terminal.crash.upload_confirm_body, name)
        .toMatch(mentions[name])
    }
  })

  it('the progress string carries both placeholders', () => {
    for (const [name, l] of Object.entries({ en, es, fr, hu })) {
      const s = l.config.terminal.crash.upload_progress
      expect(s, name).toContain('{sent}')
      expect(s, name).toContain('{total}')
    }
  })
})
