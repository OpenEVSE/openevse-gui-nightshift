import { fileURLToPath } from 'node:url'
import { generateLocaleValues } from '../scripts/build-locale-values.mjs'

const i18nDir = fileURLToPath(new URL('../src/lib/i18n/', import.meta.url))
const sourceDir = i18nDir + 'source/'
const enFile = i18nDir + 'en.json'

/**
 * Generates the position-encoded es/fr/hu value arrays that src/lib/i18n/
 * index.js imports (see scripts/build-locale-values.mjs). Runs on every Vite
 * entrypoint — dev, build, mock, and the screenshot server — so a plain clone
 * needs no separate generate step and the generated (gitignored) files always
 * exist before the module graph resolves them.
 *
 * In dev it also watches the source catalogs AND en.json and regenerates on
 * edit, so a translator's change (or an en.json key add/remove/reorder, which
 * shifts every encoded position) shows up live instead of only at the next
 * server restart.
 */
export function i18nPlugin() {
  return {
    name: 'openevse-i18n-locale-values',
    enforce: 'pre',
    // Covers `vite build`, and dev/serve where Vite runs buildStart on startup.
    buildStart() {
      generateLocaleValues()
    },
    configureServer(server) {
      // Belt-and-suspenders: guarantee the files exist before the first
      // request, independent of buildStart timing in serve mode.
      generateLocaleValues()
      server.watcher.add([sourceDir, enFile])
      server.watcher.on('change', (file) => {
        // en.json defines the key order the value arrays are encoded against,
        // so a change to it OR to a source catalog must regenerate.
        const isSource = file.startsWith(sourceDir) && file.endsWith('.json')
        if (file !== enFile && !isSource) return
        try {
          // Rewriting the generated es/fr/hu.json (they are in index.js's
          // module graph) triggers Vite's own full reload — no explicit
          // ws.send needed.
          generateLocaleValues()
        } catch (err) {
          server.config.logger.error(`[i18n] ${err.message}`)
        }
      })
    },
  }
}
