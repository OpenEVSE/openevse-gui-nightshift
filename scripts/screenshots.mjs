// Automated UI screenshot generator.
//
//   npm run screenshots            regenerate docs/screenshots/*.png
//   node scripts/screenshots.mjs --only dashboard-charging,settings
//
// Starts the Vite dev server in mock mode with MOCK_STATIC=1 (no WebSocket
// ticks, frozen server clock), then drives every manifest entry from
// screenshots.config.js through headless Chromium with a frozen browser
// clock, fixed locale/timezone and animations disabled — so successive runs
// of an unchanged UI produce identical images.

import { mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'
import { SHOTS, VIEWPORTS, FROZEN_TIME, TIMEZONE, LOCALE } from './screenshots.config.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs', 'screenshots')

const onlyArg = process.argv.indexOf('--only')
const only = onlyArg !== -1 ? process.argv[onlyArg + 1].split(',') : null
const shots = only ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS
if (shots.length === 0) {
  console.error('No manifest entries match --only', only)
  process.exit(1)
}

process.env.MOCK_STATIC = '1'
const { createServer } = await import('vite')
const server = await createServer({
  root,
  mode: 'mock',
  logLevel: 'error',
  // No HMR error overlay: a server error must fail the run (see the response
  // check below), never get captured inside an image.
  server: { host: '127.0.0.1', port: 5199, strictPort: false, hmr: { overlay: false } },
})
await server.listen()
const port = server.config.server.port ?? server.httpServer.address().port
const base = `http://127.0.0.1:${server.httpServer.address().port ?? port}`
console.log(`mock server: ${base}`)

mkdirSync(outDir, { recursive: true })
// Full regeneration: clear stale images so renamed/removed entries don't linger.
if (!only) {
  for (const f of readdirSync(outDir)) if (f.endsWith('.png')) unlinkSync(join(outDir, f))
}

const browser = await chromium.launch()
let count = 0
let failed = 0

try {
  for (const shot of shots) {
    for (const themeName of shot.themes) {
      for (const viewportName of shot.viewports) {
        const file = `${shot.name}-${themeName}-${viewportName}.png`
        const context = await browser.newContext({
          viewport: VIEWPORTS[viewportName],
          locale: LOCALE,
          timezoneId: TIMEZONE,
          colorScheme: themeName,
          reducedMotion: 'reduce',
        })
        const page = await context.newPage()
        const requestErrors = []
        page.on('response', (r) => {
          if (r.status() >= 400) requestErrors.push(`${r.status()} ${r.url()}`)
        })
        page.on('pageerror', (e) => requestErrors.push(`pageerror: ${e.message}`))
        try {
          await page.clock.setFixedTime(new Date(FROZEN_TIME))
          // Explicit theme override — don't rely on colorScheme inference.
          await page.addInitScript(
            (t) => localStorage.setItem('oevse-theme', JSON.stringify(t)),
            themeName,
          )

          // Scenario/state are server-global; set (or reset) them per shot.
          const scenarioRes = await page.request.get(
            `${base}/api/_mock/scenario/${shot.scenario ?? 'reset'}`,
          )
          if (!scenarioRes.ok()) throw new Error(`scenario ${shot.scenario}: HTTP ${scenarioRes.status()}`)
          const stateRes = await page.request.get(`${base}/api/_mock/state/${shot.state ?? 'reset'}`)
          if (!stateRes.ok()) throw new Error(`state ${shot.state}: HTTP ${stateRes.status()}`)

          await page.goto(`${base}/#${shot.route}`, { waitUntil: 'networkidle' })
          // The app shell (or the wizard) is the "fully booted" signal.
          await page.waitForSelector('main, [data-wizard], .wizard, form', { timeout: 15000 })
          // Kill residual animation/transitions and the text caret.
          await page.addStyleTag({
            content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }',
          })
          await page.waitForTimeout(400) // icon font / chart settle

          if (requestErrors.length) throw new Error(requestErrors.join('; '))
          await page.screenshot({ path: join(outDir, file), fullPage: shot.fullPage })
          count++
          console.log(`  ✓ ${file}`)
        } catch (err) {
          failed++
          console.error(`  ✗ ${file}: ${err.message}`)
        } finally {
          await context.close()
        }
      }
    }
  }
} finally {
  await browser.close()
  await server.close()
}

console.log(`\n${count} screenshots written to docs/screenshots/${failed ? `, ${failed} FAILED` : ''}`)
process.exit(failed ? 1 : 0)
