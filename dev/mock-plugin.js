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
  }

  // Base status object for WebSocket messages
  const baseStatus = JSON.parse(fixtures['/api/status'])

  function buildStatusMessage(tickCount) {
    return JSON.stringify({
      ...baseStatus,
      // Vary a couple of live fields so the UI looks animated
      session_elapsed: baseStatus.session_elapsed + tickCount * 2,
      wattpower: baseStatus.wattpower + Math.round(Math.sin(tickCount * 0.3) * 200),
    })
  }

  return {
    name: 'openevse-mock',
    configureServer(server) {
      // ── HTTP mock middleware ──────────────────────────────────────────────
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] // strip query string

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
