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
  'upload_progress', 'upload_sending', 'upload_done', 'upload_failed',
  'upload_deferred', 'upload_cancel_deferred',
  'reporting_title', 'forget', 'forget_reporter_id', 'forget_reporter_id_label', 'forget_confirm_title', 'forget_confirm_body',
  'forget_confirm_yes', 'forget_deleting', 'forget_done', 'forget_failed',
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
      for (const k of ['upload', 'upload_confirm_body', 'upload_deferred', 'forget', 'forget_confirm_body']) {
        expect(locale.config.terminal.crash[k], k)
          .not.toBe(en.config.terminal.crash[k])
      }
    })

  it('the confirmation says the credentials stay on the charger, in every locale', () => {
    // Only the decoded summary leaves the device; the raw memory image, which
    // can hold the Wi-Fi password, does not. Consent has to say what is sent
    // (spec section 8), and in particular that credentials are not -- so every
    // locale must name Wi-Fi and say the memory copy is not sent.
    const says = {
      en: [/wi-?fi/i, /not/i], es: [/wi-?fi/i, /no /i],
      fr: [/wi-?fi/i, /pas/i], hu: [/wi-?fi/i, /nem/i],
    }
    for (const [name, l] of Object.entries({ en, es, fr, hu })) {
      for (const re of says[name]) {
        expect(l.config.terminal.crash.upload_confirm_body, name).toMatch(re)
      }
    }
    // The old wording promised the reverse; it must not survive in any locale.
    expect(en.config.terminal.crash.upload_confirm_body).not.toMatch(/can contain your Wi-Fi/i)
  })

  it('the progress string carries both placeholders', () => {
    for (const [name, l] of Object.entries({ en, es, fr, hu })) {
      const s = l.config.terminal.crash.upload_progress
      expect(s, name).toContain('{sent}')
      expect(s, name).toContain('{total}')
    }
  })

  it('the deletion result carries its count, in every locale', () => {
    for (const [name, l] of Object.entries({ en, es, fr, hu })) {
      expect(l.config.terminal.crash.forget_done, name).toContain('{count}')
    }
  })

  it('the dump card keeps its title; sending has its own Crash reporting card', () => {
    expect(en.config.terminal.crash.title).toBe('Crash core dump')
    expect(en.config.terminal.crash.reporting_title).toBe('Crash reporting')
  })

  it('explains the reporter id, then labels it on its own line', () => {
    expect(en.config.terminal.crash.forget_reporter_id).toBe(
      'Reports sent from this charger are filed under a random reporter ID which cannot be used to identify the charger.')
    expect(en.config.terminal.crash.forget_reporter_id_label).toBe('Current reporter ID:')
  })
})
