/**
 * Vite dev-mode mock plugin.
 *
 * Intercepts /api/* HTTP requests and /ws WebSocket connections so the app
 * can be viewed locally without a real OpenEVSE device.
 *
 * Activated only when Vite is started with --mode mock (npm run dev:mock).
 */

import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Deep-merge for scenario overlays: objects merge recursively, everything
// else (including arrays) replaces the base value.
function deepMerge(base, overlay) {
  if (
    base && overlay
    && typeof base === 'object' && typeof overlay === 'object'
    && !Array.isArray(base) && !Array.isArray(overlay)
  ) {
    const out = { ...base }
    for (const key of Object.keys(overlay)) out[key] = deepMerge(base[key], overlay[key])
    return out
  }
  return overlay === undefined ? base : overlay
}

export function mockPlugin() {
  // Load fixture files lazily (only when mock mode is actually active)
  function loadFixture(name) {
    return readFileSync(join(__dirname, 'fixtures', name), 'utf-8')
  }

  // Base fixtures, keyed by endpoint. Values are parsed objects so a
  // scenario overlay can deep-merge onto them; the fixture key (used in
  // scenario files) is the filename stem.
  const fixtureFiles = {
    '/api/status':        'status.json',
    '/api/schedule':      'schedule.json',
    '/api/schedule/plan': 'plan.json',
    '/api/config':        'config.json',
    '/api/override':      'override.json',
    '/api/claims':        'claims.json',
    '/api/claims/target': 'claims_target.json',
    '/api/certificates':  'certificates.json',
    '/api/energy/raw':    'energy_raw.json',
    '/api/energy/daily':  'energy_daily.json',
    '/api/energy/monthly':'energy_monthly.json',
    '/api/energy/annual': 'energy_annual.json',
  }
  const baseFixtures = {}
  const fixtureKeyByUrl = {}
  for (const [url, file] of Object.entries(fixtureFiles)) {
    baseFixtures[url] = JSON.parse(loadFixture(file))
    fixtureKeyByUrl[url] = file.replace(/\.json$/, '')
  }

  // Named scenario overlay, loaded from fixtures/scenarios/<name>.json.
  // A scenario file is keyed by fixture stem (status, config, schedule, ...)
  // with partial objects deep-merged over the base fixture. Switch at runtime
  // with GET /api/_mock/scenario/<name> ("reset" clears). Used by the
  // screenshot runner and handy for manual dev.
  let scenario = null

  function effectiveFixture(url) {
    const base = baseFixtures[url]
    const overlay = scenario?.[fixtureKeyByUrl[url]]
    return overlay ? deepMerge(base, overlay) : base
  }

  // Static mode (MOCK_STATIC=1): no periodic WebSocket ticks and a frozen
  // server-side clock, so every request is deterministic. The screenshot
  // runner sets this so captured images are reproducible run-to-run.
  const staticMode = process.env.MOCK_STATIC === '1'
  const FROZEN_TIME_MS = Date.parse(
    JSON.parse(loadFixture('status.json')).time ?? '2026-05-21T22:00:30Z',
  )
  const nowMs = () => (staticMode ? FROZEN_TIME_MS : Date.now())

  // In-memory state for endpoints that mutate. Seeded once per dev-server
  // run; reset by restarting the server.
  const rfidUsers = JSON.parse(loadFixture('rfid_users.json'))

  // Dev-only runtime state override. Lets the resting/charging layouts be
  // previewed without a real device: GET /api/_mock/state/<code> flips it
  // (1 idle, 2 plugged/paused, 3 charging, 4-11 fault, 254 sleeping,
  // 255 off; "reset" returns to the fixture). null = use the fixture state.
  let stateOverride = null

  // Dev-only claims/target served to the dashboard. getMode() turns a
  // manual + "disabled" claim into Off mode, and displayState() then renders
  // EVSE state 254 as "off" instead of "sleeping". So the switcher keeps the
  // derived mode coherent with the previewed state: Off only for the dedicated
  // off code (255), Auto otherwise (so 254 -> sleeping). Bumping claimsVersion
  // makes DataManager re-download claims/target live over the WebSocket.
  const claimsOff = baseFixtures['/api/claims/target']
  const claimsAuto = { properties: {}, claims: { state: null, charge_current: null } }
  let claimsState = claimsOff
  let claimsVersion = baseFixtures['/api/status'].claims_version ?? 1

  function buildStatusMessage(tickCount) {
    // Mirror the device's real status shape; nudge only genuine live fields
    // so the connection looks alive without inventing nonexistent keys.
    const baseStatus = effectiveFixture('/api/status')
    const state = stateOverride == null ? baseStatus.state : stateOverride
    const charging = state === 3
    return JSON.stringify({
      ...baseStatus,
      state,
      claims_version: claimsVersion,
      uptime: (baseStatus.uptime ?? 0) + tickCount * 2,
      session_elapsed: charging
        ? (baseStatus.session_elapsed ?? 0) + tickCount * 2
        : baseStatus.session_elapsed,
    })
  }

  return {
    name: 'openevse-mock',
    configureServer(server) {
      // Connected WS clients + tick, shared so the state switcher can push an
      // updated status frame to every open tab the moment it's flipped.
      const clients = new Set()
      let tickCount = 0

      // ── HTTP mock middleware ──────────────────────────────────────────────
      server.middlewares.use((req, res, next) => {
        // /api/energy/raw?before=... must return empty before query is stripped
        if (req.url?.startsWith('/api/energy/raw?') && req.url.includes('before=')) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{"samples":[]}')
          return
        }

        const url = req.url?.split('?')[0] // strip query string

        // Dev-only scenario switcher: overlay fixtures/scenarios/<name>.json
        // onto the base fixtures and push a fresh status frame to every open
        // tab ("reset" clears the overlay).
        if (url && url.startsWith('/api/_mock/scenario/')) {
          const name = url.slice('/api/_mock/scenario/'.length)
          if (name === 'reset') {
            scenario = null
          } else {
            const file = join(__dirname, 'fixtures', 'scenarios', name + '.json')
            if (!/^[\w-]+$/.test(name) || !existsSync(file)) {
              res.writeHead(404, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ msg: 'unknown scenario: ' + name }))
              return
            }
            scenario = JSON.parse(readFileSync(file, 'utf-8'))
          }
          const msg = buildStatusMessage(tickCount)
          for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(msg)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ scenario: name === 'reset' ? null : name }))
          return
        }

        // Dev-only runtime state switcher: flip the dashboard's EVSE state and
        // push the new frame to every open tab immediately (no restart).
        if (url && url.startsWith('/api/_mock/state/')) {
          const raw = url.slice('/api/_mock/state/'.length)
          stateOverride = raw === 'reset' ? null : Number(raw)
          // Keep the derived mode coherent: Off only for the explicit off code.
          const effectiveState = stateOverride == null
            ? effectiveFixture('/api/status').state
            : stateOverride
          const nextClaims = effectiveState === 255 ? claimsOff : claimsAuto
          if (nextClaims !== claimsState) {
            claimsState = nextClaims
            claimsVersion++
          }
          const msg = buildStatusMessage(tickCount)
          for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(msg)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ state: stateOverride, claims_version: claimsVersion }))
          return
        }

        // /time: GET returns NTP status; POST with sync_now=true triggers sync
        if (url === '/api/time') {
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (c) => { body += c })
            req.on('end', () => {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end('{"msg":"done"}')
            })
            return
          }
          // GET: return a plausible NTP status snapshot
          const nowSec = Math.floor(nowMs() / 1000)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            sntp_enabled: true,
            time: new Date(nowMs()).toISOString(),
            time_zone: 'Europe/London|GMT0BST,M3.5.0/1,M10.5.0',
            ntp_status: 'synchronized',
            ntp_last_sync: nowSec - 312,        // 5m 12s ago
            ntp_next_sync_ms: 28440000,          // ~7h 54m
            ntp_server_ip: '185.96.2.100',
          }))
          return
        }

        // Status reflects any runtime override so a fresh load matches the WS.
        if (url === '/api/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(buildStatusMessage(tickCount))
          return
        }

        // Claims/target reflects the switcher so the derived mode is coherent.
        if (url === '/api/claims/target') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(claimsState))
          return
        }

        // RFID scan acknowledgement
        if (url === '/api/rfid/add') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('1')
          return
        }

        // RFID user-name map (Labs feature — firmware support pending)
        if (url === '/api/rfid/users') {
          if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(rfidUsers))
            return
          }
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', () => {
              try {
                const { rfid, name } = JSON.parse(body)
                if (rfid && typeof name === 'string') rfidUsers[rfid] = name
              } catch { /* ignore malformed body */ }
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ msg: 'done' }))
            })
            return
          }
          if (req.method === 'DELETE') {
            const m = req.url?.match(/[?&]rfid=([^&]*)/)
            if (m) delete rfidUsers[decodeURIComponent(m[1])]
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ msg: 'done' }))
            return
          }
        }

        if (url === '/api/scan' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(loadFixture('scan.json'))
          return
        }

        if (url === '/api/tesla/vehicles' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(loadFixture('tesla-vehicles.json'))
          return
        }

        // System page mock routes
        if (url === '/api/restart' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            let device = 'gateway'
            try { device = JSON.parse(body).device ?? 'gateway' } catch { /* ignore */ }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ msg: 'restart ' + device }))
          })
          return
        }

        if (url === '/api/reset' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ msg: 'done' }))
          return
        }

        if (url === '/api/update' && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('OK')
          return
        }

        if (url === '/api/r') {
          const rapiParam = req.url?.match(/[?&]rapi=([^&]*)/)
          const rapi = rapiParam ? decodeURIComponent(rapiParam[1]) : ''
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ cmd: rapi, ret: '$OK^20' }))
          return
        }

        if (url === '/api/certificates' && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ msg: 'done', id: String(Date.now()) }))
          return
        }

        if (url && url.startsWith('/api/certificates/') && req.method === 'DELETE') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ msg: 'done' }))
          return
        }

        // Session history CSV export (Labs feature — firmware support pending)
        if (url === '/api/logs/export') {
          res.writeHead(200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="session-history.csv"',
          })
          res.end('time,type,evseState,energy,temperature,rfidTag\n' +
            '2026-05-21T18:30:00Z,information,3,7400,28.5,AA11BB22\n' +
            '2026-05-20T08:00:00Z,information,3,11200,30.0,CC33DD44\n')
          return
        }

        // History log endpoints (dynamic — not in the exact-match table)
        if (url === '/api/logs') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ min: 1, max: 1 }))
          return
        }
        if (url && url.startsWith('/api/logs/')) {
          const idx = url.slice('/api/logs/'.length)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(idx === '1' ? loadFixture('logs.json') : '[]')
          return
        }

        if (url && Object.prototype.hasOwnProperty.call(baseFixtures, url)) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(effectiveFixture(url)))
          return
        }

        next()
      })

      // ── WebSocket mock ────────────────────────────────────────────────────
      // Use require() to load `ws` (CJS) from within an ESM plugin
      const require = createRequire(import.meta.url)
      const { WebSocketServer } = require('ws')

      const wss = new WebSocketServer({ noServer: true })

      // Intercept HTTP upgrade events — only handle /ws, leave others for Vite
      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (request.url === '/ws') {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request)
          })
        }
        // Any other path (e.g. Vite HMR /__vite_hmr) is intentionally ignored
        // so Vite's own upgrade handler fires normally.
      })

      wss.on('connection', (ws) => {
        clients.add(ws)
        // Send an initial status message immediately
        ws.send(buildStatusMessage(tickCount))

        // Then send a live update every 2 seconds — unless static mode is on,
        // where nothing may change between frames (deterministic screenshots).
        const interval = staticMode ? null : setInterval(() => {
          tickCount++
          if (ws.readyState === ws.OPEN) {
            ws.send(buildStatusMessage(tickCount))
          }
        }, 2000)

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString())
            if (msg.ping !== undefined) {
              ws.send(JSON.stringify({ pong: 1 }))
            }
          } catch {
            // ignore non-JSON messages
          }
        })

        ws.on('close', () => {
          clients.delete(ws)
          clearInterval(interval)
        })

        ws.on('error', () => {
          clients.delete(ws)
          clearInterval(interval)
        })
      })
    },
  }
}
