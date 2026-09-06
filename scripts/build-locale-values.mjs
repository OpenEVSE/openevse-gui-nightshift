// Generates src/lib/i18n/{es,fr,hu}.json as flat, position-encoded value
// arrays from the human-maintained catalogs in src/lib/i18n/source/.
//
// en.json is the key source and ships as-is (nested, keyed) since it needs
// no transform. Each other locale repeats the same ~1,000 key names, which
// is dead weight once gzipped per-locale bundle: the key text doesn't need
// to travel more than once. So translators keep editing full nested JSON
// under source/ for readable diffs, and this projects each locale onto en's
// key order and writes just the values. src/lib/i18n/hydrate.js reverses this
// at load time using en.json, which every locale already loads as the
// svelte-i18n fallback.
//
// Generation is wired into the build pipeline (dev/i18n-plugin.js for
// Vite — dev/build/mock/screenshots — and the Vitest globalSetup), so a plain
// clone builds and tests without any separate step. Run standalone with
// `node scripts/build-locale-values.mjs` to regenerate on demand.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { keyPaths, keyEntries, PATH_SEP } from '../src/lib/i18n/hydrate.js'

const i18nDir = fileURLToPath(new URL('../src/lib/i18n/', import.meta.url))
const locales = ['es', 'fr', 'hu']

// Encoded paths use a NUL separator (see hydrate.js); show them dotted so the
// out-of-sync error names keys the way a translator reads them.
const showPath = (p) => p.replaceAll(PATH_SEP, '.')

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Regenerate src/lib/i18n/{es,fr,hu}.json from source/. Returns the filenames
 * written. Throws if a source catalog's keys are out of sync with en.json.
 */
export function generateLocaleValues() {
  const en = loadJson(i18nDir + 'en.json')
  const order = keyPaths(en)
  const orderSet = new Set(order)
  const written = []

  for (const locale of locales) {
    const source = loadJson(i18nDir + `source/${locale}.json`)
    const leaves = Object.fromEntries(keyEntries(source))

    const missing = order.filter((p) => !(p in leaves))
    const extra = Object.keys(leaves).filter((p) => !orderSet.has(p))
    if (missing.length || extra.length) {
      const detail = [
        missing.length ? `missing: ${missing.map(showPath).join(', ')}` : null,
        extra.length ? `extra: ${extra.map(showPath).join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('; ')
      throw new Error(
        `src/lib/i18n/source/${locale}.json is out of sync with en.json (${detail}). ` +
          `Every key added to en.json must be added to every other catalog under source/.`,
      )
    }

    const values = order.map((path) => leaves[path])
    writeFileSync(i18nDir + `${locale}.json`, JSON.stringify(values))
    written.push(`${locale}.json`)
  }
  return written
}

// Run as a CLI (`node scripts/build-locale-values.mjs`) — but stay silent when
// imported by the build plugin or test setup.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateLocaleValues()
  console.log(`i18n: generated positional value arrays for ${locales.join(', ')} from source/`)
}
