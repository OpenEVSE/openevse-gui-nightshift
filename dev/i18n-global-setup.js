import { generateLocaleValues } from '../scripts/build-locale-values.mjs'

// Vitest globalSetup: generate the position-encoded es/fr/hu value arrays that
// src/lib/i18n/index.js and the hydrate tests import before any test module is
// collected. This makes every invocation self-sufficient — including a
// single-file `npx vitest run <file>` or an IDE test run on a fresh clone,
// which never go through an npm lifecycle hook.
//
// Non-strict on purpose: if a source catalog is out of sync with en.json, we
// still write the arrays (best-effort) and warn, rather than throwing — a
// throw here aborts the whole run before any test is collected, and would take
// down the 130+ unrelated files plus the locale-parity test whose entire job
// is to name the drifted keys. Best-effort lets that diagnostic run; the
// hydrate round-trip test then fails on exactly the affected key.
export default function () {
  const { problems } = generateLocaleValues({ strict: false })
  if (problems.length) {
    console.error(
      '\n[i18n] source catalogs are out of sync with en.json — value arrays were ' +
        'written best-effort so the suite still runs; the locale-parity / hydrate ' +
        'tests will pinpoint the drift:\n' +
        problems.map((p) => '  - ' + p).join('\n') +
        '\n',
    )
  }
}
