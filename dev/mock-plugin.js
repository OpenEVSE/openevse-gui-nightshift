/**
 * Vite dev-mode mock plugin.
 *
 * Intercepts /api/* HTTP requests and /ws WebSocket connections so the app
 * can be viewed locally without a real OpenEVSE device.
 *
 * Activated only when Vite is started with --mode mock (npm run dev:mock).
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function mockPlugin() {
  // Load fixture files lazily (only when mock mode is actually active)
  function loadFixture(name) {
    return readFileSync(join(__dirname, 'fixtures', name), 'utf-8')
  }

  const fixtures = {
    '/api/status':        loadFixture('status.json'),
    '/api/schedule':      loadFixture('schedule.json'),
    '/api/schedule/plan': loadFixture('plan.json'),
    '/api/config':        loadFixture('config.json'),
    '/api/override':      loadFixture('override.json'),
    '/api/claims/target': loadFixture('claims_target.json'),
    '/api/certificates':  loadFixture('certificates.json'),
    '/api/energy/raw':    loadFixture('energy_raw.json'),
    '/api/energy/daily':  loadFixture('energy_daily.json'),
    '/api/energy/monthly':loadFixture('energy_monthly.json'),
    '/api/energy/annual': loadFixture('energy_annual.json'),
  }

  // Base status object for WebSocket messages
  const baseStatus = JSON.parse(fixtures['/api/status'])

  function buildStatusMessage(tickCount) {
    // Mirror the device's real status shape; nudge only genuine live fields
    // so the connection looks alive without inventing nonexistent keys.
    const charging = baseStatus.state === 3
    return JSON.stringify({
      ...baseStatus,
      uptime: (baseStatus.uptime ?? 0) + tickCount * 2,
      session_elapsed: charging
        ? (baseStatus.session_elapsed ?? 0) + tickCount * 2
        : baseStatus.session_elapsed,
    })
  }

  return {
    name: 'openevse-mock',
    configureServer(server) {
      // ── HTTP mock middleware ──────────────────────────────────────────────
      server.middlewares.use((req, res, next) => {
        // /api/energy/raw?before=... must return empty before query is stripped
        if (req.url?.startsWith('/api/energy/raw?') && req.url.includes('before=')) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{"samples":[]}')
          return
        }

        const url = req.url?.split('?')[0] // strip query string

        // RFID scan acknowledgement
        if (url === '/api/rfid/add') {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('1')
          return
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

        if (url && Object.prototype.hasOwnProperty.call(fixtures, url)) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(fixtures[url])
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

      let tickCount = 0

      wss.on('connection', (ws) => {
        // Send an initial status message immediately
        ws.send(buildStatusMessage(tickCount))

        // Then send a live update every 2 seconds
        const interval = setInterval(() => {
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
          clearInterval(interval)
        })

        ws.on('error', () => {
          clearInterval(interval)
        })
      })
    },
  }
}
