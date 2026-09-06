import { generateLocaleValues } from '../scripts/build-locale-values.mjs'

// Vitest globalSetup: generate the position-encoded es/fr/hu value arrays that
// src/lib/i18n/index.js and the hydrate tests import before any test module is
// collected. This makes every invocation self-sufficient — including a
// single-file `npx vitest run <file>` or an IDE test run on a fresh clone,
// which never go through an npm lifecycle hook.
export default function () {
  generateLocaleValues()
}
