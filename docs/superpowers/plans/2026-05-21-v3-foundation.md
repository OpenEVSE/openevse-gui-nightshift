# OpenEVSE GUI v3 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v3 foundation — a booting, themed Svelte 5 SPA that loads OpenEVSE device data over HTTP/WebSocket and renders an app shell with navigation and placeholder screens.

**Architecture:** v3 keeps v2's correct domain layer (stores, WebSocket data layer, version-counter refresh, claims system) and rebuilds the presentation. This plan ports the domain layer, adds a CSS-variable theme system (dark default + light, OS-aware), an app shell (header + bottom nav + connection banners), a startup loader, hash routing with placeholder screens, and i18n. The four real screens are separate plans.

**Tech Stack:** Svelte 5, Vite, Tailwind CSS 4, `svelte-i18n`, `vite-plugin-pwa`, `vite-plugin-compression`, Vitest + `@testing-library/svelte` + jsdom.

**Preconditions:**
- The v2 reference repo is available at `/home/rar/openevse-gui-v2` (referred to below as `$V2`). Several tasks port files from it verbatim or with stated adaptations.
- Work happens in `/home/rar/openevse-gui-v3` (the v3 repo, currently containing only `.gitignore` and `docs/`).
- Node 20+ and npm available.

**Plan-level decisions:**
- **UI primitives are built just-in-time.** This plan builds only the primitives the shell and loader need (`Button`, `IconButton`, `Loader`, `ProgressBar`, `Modal`, `AlertBox`). The remaining primitives from the spec's design system (`ProgressRing`, `StatChip`, `Toggle`, `Slider`, `Select`, `Tabs`, `Card`) are built in the screen plans that first consume them. All still get built; this just keeps the foundation plan reviewable.
- **Routing** uses a small in-repo hash router (shown in full in Task 18), avoiding a dependency whose Svelte 5 support is uncertain. The spec permits this.
- Data components (`WebSocket`, `FetchData`, `DataManager`) are rewritten for Svelte 5 (`$:` → `$effect`); shown in full. Domain stores are plain Svelte stores and port unchanged except import paths.

---

## File Structure

```
openevse-gui-v3/
  package.json, vite.config.js, vitest.config.js, jsconfig.json
  index.html, postcss (none — Tailwind 4 uses a Vite plugin)
  .env.example
  src/
    main.js                    Svelte 5 mount()
    App.svelte                 loader ↔ shell switch, global data components
    app.css                    Tailwind entry + theme tokens
    test-setup.js              jest-dom matchers
    lib/
      api/httpAPI.js           fetch client (extracted from v2 utils.js)
      queue.js                 serialQueue (ported)
      vars.js                  EvseClients (ported)
      utils.js                 helpers (ported, minus httpAPI)
      routes.js                route table
      router.js                minimal hash router
      stores/                  status, config, schedule, plan, override,
                               limit, claims_target, history, certificates,
                               uistates, uisettings, theme  (+ json/)
      data/                    WebSocket.svelte, FetchData.svelte, DataManager.svelte
      i18n/                    index.js + en.json
      icons/                   bundled icon subset + Icon.svelte
      components/
        ui/                    Button, IconButton, Loader, ProgressBar,
                               Modal, AlertBox
        shell/                 AppShell, Header, BottomNav, ConnectionBanners
    routes/                    Dashboard, Schedule, Monitoring, History, NotFound
    assets/                    gear.svg + GearMark.svelte
  scripts/gen-icons.mjs        rasterizes gear.svg → PWA icons
  public/                     favicon + generated PWA icons
```

---

## Phase 1 — Project Scaffold & Build

### Task 1: Initialize the Svelte 5 + Vite project

**Files:**
- Create: `package.json`, `index.html`, `src/main.js`, `src/App.svelte`, `src/app.css`, `jsconfig.json`, `.env.example`

- [ ] **Step 1: Scaffold with the Vite Svelte template**

Run in `/home/rar/openevse-gui-v3`:
```bash
npm create vite@latest . -- --template svelte
```
If prompted that the directory is not empty, choose **"Ignore files and continue"** (it must keep `.gitignore` and `docs/`). This creates `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/App.svelte`, `src/app.css`, `src/lib/`, `public/`, `jsconfig.json`.

- [ ] **Step 2: Install dependencies and runtime libraries**

```bash
npm install
npm install luxon svelte-i18n svelte-local-storage-store promise-batching-queue iconify-icon
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa vite-plugin-compression \
  vitest @vitest/coverage-v8 jsdom @testing-library/svelte @testing-library/jest-dom sharp
```

- [ ] **Step 3: Replace `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.5, user-scalable=no" />
    <meta name="description" content="OpenEVSE WiFi UI" />
    <link rel="icon" href="./favicon.ico" />
    <title>OpenEVSE WiFi</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Replace `src/main.js`**

```js
import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const app = mount(App, { target: document.getElementById('app') })

export default app
```

- [ ] **Step 5: Replace `src/App.svelte` with a temporary placeholder**

```svelte
<script>
  let message = $state('OpenEVSE v3')
</script>

<main>{message}</main>
```

- [ ] **Step 6: Create `.env.example`**

```
VITE_OPENEVSEHOST="openevse.local"
```

- [ ] **Step 7: Verify the dev server boots**

Run: `npm run dev`
Expected: Vite prints a `localhost:5173` URL with no errors. Stop it with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Scaffold Svelte 5 + Vite project"
```

### Task 2: Configure Tailwind 4 and the theme entry stylesheet

**Files:**
- Modify: `vite.config.js`
- Replace: `src/app.css`

- [ ] **Step 1: Replace `vite.config.js`** (PWA/compression added in Task 3; this step wires Tailwind + dev proxy)

```js
import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const host = env.VITE_OPENEVSEHOST || 'openevse.local'
  return {
    base: './',
    plugins: [svelte(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': { target: `http://${host}`, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
        '/ws': { target: `ws://${host}`, ws: true },
        '/debug/console': { target: `ws://${host}`, ws: true },
        '/evse/console': { target: `ws://${host}`, ws: true },
        '/debug': { target: `http://${host}`, changeOrigin: true },
        '/evse': { target: `http://${host}`, changeOrigin: true },
      },
    },
  }
})
```

- [ ] **Step 2: Replace `src/app.css`** with the Tailwind entry plus theme tokens

```css
@import "tailwindcss";

/* Expose theme colors as Tailwind utilities (bg-surface, text-accent, ...).
   Each maps to a CSS variable that the active theme sets below. */
@theme {
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-text: var(--text);
  --color-text-dim: var(--text-dim);
  --color-accent: var(--accent);
  --color-border: var(--border);
  --color-charging: var(--charging);
  --color-error: var(--error);
  --color-warning: var(--warning);
}

/* Light theme — also the fallback when no data-theme is set */
:root,
[data-theme="light"] {
  --surface: #ffffff;
  --surface-2: #eef4f3;
  --surface-3: #dde7e6;
  --text: #13202b;
  --text-dim: #5b6b72;
  --accent: #0f9b98;
  --border: #e4eae9;
  --charging: #0f9b98;
  --error: #d6453d;
  --warning: #d98a2b;
  --accent-glow: 0 0 0 transparent;
  color-scheme: light;
}

[data-theme="dark"] {
  --surface: #0c0e13;
  --surface-2: #10141c;
  --surface-3: #161b26;
  --text: #e8ecf2;
  --text-dim: #6b7585;
  --accent: #3cc6bd;
  --border: #1c2230;
  --charging: #3cc6bd;
  --error: # f06e66;
  --warning: #e7a948;
  --accent-glow: 0 0 8px rgba(60, 198, 189, 0.55);
  color-scheme: dark;
}

html, body, #app { height: 100%; }
body {
  margin: 0;
  background: var(--surface);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

Note: fix the typo before saving — `--error` under `[data-theme="dark"]` must be `#f06e66` (no space).

- [ ] **Step 3: Verify the build still boots**

Run: `npm run dev`
Expected: no errors; the page background renders white (light fallback). Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add Tailwind 4 and CSS-variable theme tokens"
```

### Task 3: Add PWA, gzip compression, and chunk splitting to the build

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Update `vite.config.js`** — add the three plugins. Replace the `plugins` array and add a `build` block:

```js
import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const host = env.VITE_OPENEVSEHOST || 'openevse.local'
  return {
    base: './',
    plugins: [
      svelte(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: null,
        selfDestroying: true,
        workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,gz}'] },
        includeAssets: ['favicon.ico'],
        manifest: {
          name: 'OpenEVSE UI',
          short_name: 'OpenEVSE',
          description: 'OpenEVSE User Interface',
          theme_color: '#0c0e13',
          background_color: '#0c0e13',
          display: 'standalone',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
      viteCompression({ deleteOriginFile: true, algorithm: 'gzip', filter: /\.(js|mjs|json|css|html|svg)$/i }),
    ],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: { vendor: ['luxon', 'svelte-i18n', 'iconify-icon'] },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': { target: `http://${host}`, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
        '/ws': { target: `ws://${host}`, ws: true },
        '/debug/console': { target: `ws://${host}`, ws: true },
        '/evse/console': { target: `ws://${host}`, ws: true },
        '/debug': { target: `http://${host}`, changeOrigin: true },
        '/evse': { target: `http://${host}`, changeOrigin: true },
      },
    },
  }
})
```

- [ ] **Step 2: Verify the production build**

Run: `npm run build`
Expected: build succeeds; `dist/` contains `index.html`, `assets/*.js.gz`, `assets/*.css.gz`, and a generated service worker. (PWA icon-missing warnings are fine — icons are added in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add PWA, gzip compression, and vendor chunk splitting"
```

### Task 4: Configure Vitest

**Files:**
- Create: `vitest.config.js`, `src/test-setup.js`
- Test: `src/lib/__tests__/smoke.test.js`

- [ ] **Step 1: Write a smoke test** — `src/lib/__tests__/smoke.test.js`

```js
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 2: Create `src/test-setup.js`**

```js
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.js'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/lib/**/*.js'],
      exclude: ['src/lib/**/__tests__/**'],
    },
  },
})
```

- [ ] **Step 4: Add test scripts to `package.json`** — in the `"scripts"` block add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: Run the smoke test**

Run: `npm test`
Expected: PASS — 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Configure Vitest with jsdom and jest-dom matchers"
```

---

## Phase 2 — Brand Assets

### Task 5: Keyhole gear mark and PWA icons

**Files:**
- Create: `src/assets/gear.svg`, `src/assets/GearMark.svelte`, `scripts/gen-icons.mjs`
- Create (generated): `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png`, `public/favicon.ico`
- Test: `src/assets/__tests__/GearMark.test.js`

- [ ] **Step 1: Create `src/assets/gear.svg`** — the softened OpenEVSE gear (8 rounded teeth, old-fashioned keyhole). Fill is `currentColor` so it themes automatically.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <mask id="oevse-keyhole">
      <rect width="100" height="100" fill="white"/>
      <circle cx="50" cy="43" r="9" fill="black"/>
      <path d="M46 43 L54 43 L58 60 Q59 64 55 64 L45 64 Q41 64 42 60 Z" fill="black"/>
    </mask>
  </defs>
  <g fill="currentColor" mask="url(#oevse-keyhole)">
    <g>
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate(0 50 50)"/>
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate(45 50 50)"/>
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate(90 50 50)"/>
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate(135 50 50)"/>
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate(180 50 50)"/>
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate(225 50 50)"/>
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate(270 50 50)"/>
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate(315 50 50)"/>
    </g>
    <circle cx="50" cy="50" r="31"/>
  </g>
</svg>
```

- [ ] **Step 2: Write the failing test** — `src/assets/__tests__/GearMark.test.js`

```js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import GearMark from '../GearMark.svelte'

describe('GearMark', () => {
  it('renders an svg sized by the size prop', () => {
    const { container } = render(GearMark, { props: { size: 40 } })
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('width')).toBe('40')
  })

  it('uses currentColor so it inherits theme color', () => {
    const { container } = render(GearMark)
    expect(container.querySelector('[fill="currentColor"]')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- GearMark`
Expected: FAIL — cannot find `../GearMark.svelte`.

- [ ] **Step 4: Create `src/assets/GearMark.svelte`** — inlines the gear so `currentColor` works

```svelte
<script>
  let { size = 32, class: klass = '' } = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 100 100"
  width={size}
  height={size}
  class={klass}
  role="img"
  aria-label="OpenEVSE"
>
  <defs>
    <mask id="oevse-keyhole">
      <rect width="100" height="100" fill="white" />
      <circle cx="50" cy="43" r="9" fill="black" />
      <path d="M46 43 L54 43 L58 60 Q59 64 55 64 L45 64 Q41 64 42 60 Z" fill="black" />
    </mask>
  </defs>
  <g fill="currentColor" mask="url(#oevse-keyhole)">
    {#each [0, 45, 90, 135, 180, 225, 270, 315] as a}
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate({a} 50 50)" />
    {/each}
    <circle cx="50" cy="50" r="31" />
  </g>
</svg>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- GearMark`
Expected: PASS — 2 passed.

- [ ] **Step 6: Create `scripts/gen-icons.mjs`** — rasterizes the gear to PWA icons with `sharp`

```js
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync(new URL('../src/assets/gear.svg', import.meta.url))
const teal = '#3cc6bd'
const bg = '#0c0e13'

// Recolor currentColor to the brand teal for raster output.
const colored = Buffer.from(svg.toString().replace(/currentColor/g, teal))

async function icon(size, pad, file) {
  const inner = Math.round(size * (1 - pad))
  const gear = await sharp(colored, { density: 384 }).resize(inner, inner).png().toBuffer()
  const off = Math.round((size - inner) / 2)
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: gear, top: off, left: off }])
    .png()
    .toFile(new URL(`../public/${file}`, import.meta.url).pathname)
}

await icon(192, 0.16, 'pwa-192x192.png')
await icon(512, 0.16, 'pwa-512x512.png')
await icon(512, 0.30, 'pwa-maskable-512x512.png')

// favicon: a 48px PNG written as favicon.ico (browsers accept PNG data here)
const fav = await sharp(colored, { density: 384 }).resize(40, 40).extend({
  top: 4, bottom: 4, left: 4, right: 4, background: bg,
}).png().toBuffer()
writeFileSync(new URL('../public/favicon.ico', import.meta.url).pathname, fav)

console.log('icons generated')
```

- [ ] **Step 7: Generate the icons**

Run: `node scripts/gen-icons.mjs`
Expected: prints `icons generated`; `public/` now has `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `favicon.ico`.

- [ ] **Step 8: Verify the build picks up the icons**

Run: `npm run build`
Expected: build succeeds with no PWA icon-missing warnings.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add keyhole gear mark and generate PWA icons"
```

---

## Phase 3 — Data Layer

> The v2 domain layer is correct. These tasks **port it from `$V2`**. Domain stores are plain Svelte stores and work in Svelte 5 unchanged except for import paths. `httpAPI` moves from v2's `utils.js` into its own module. Data components are rewritten for Svelte 5.

### Task 6: Port `serialQueue` and `EvseClients`

**Files:**
- Create: `src/lib/queue.js`, `src/lib/vars.js`
- Test: `src/lib/__tests__/queue.test.js`, `src/lib/__tests__/vars.test.js`

- [ ] **Step 1: Copy the v2 tests** (they define expected behavior)

```bash
cp $V2/src/lib/__tests__/queue.test.js src/lib/__tests__/queue.test.js
cp $V2/src/lib/__tests__/vars.test.js src/lib/__tests__/vars.test.js
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- queue vars`
Expected: FAIL — cannot resolve `../queue.js` / `../vars.js`.

- [ ] **Step 3: Copy the v2 source files verbatim**

```bash
cp $V2/src/lib/queue.js src/lib/queue.js
cp $V2/src/lib/vars.js src/lib/vars.js
```
Both files are framework-agnostic plain JS — no changes needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- queue vars`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Port serialQueue and EvseClients from v2"
```

### Task 7: Extract the `httpAPI` client

**Files:**
- Create: `src/lib/api/httpAPI.js`
- Test: `src/lib/api/__tests__/httpAPI.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/api/__tests__/httpAPI.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../stores/uistates.js', () => ({
  uistates_store: { update: vi.fn((fn) => fn({ has_fetched: true })) },
}))
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store')
  return { ...actual, get: vi.fn(() => ({ has_fetched: true })) }
})

import { httpAPI } from '../httpAPI.js'

describe('httpAPI', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GETs JSON and returns the parsed body', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ ok: 1 }) }),
    )
    const res = await httpAPI('GET', '/status')
    expect(res).toEqual({ ok: 1 })
  })

  it('returns the string "error" when fetch rejects', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network')))
    const res = await httpAPI('GET', '/status')
    expect(res).toBe('error')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- httpAPI`
Expected: FAIL — cannot resolve `../httpAPI.js`.

- [ ] **Step 3: Create `src/lib/api/httpAPI.js`** — the `httpAPI` function from `$V2/src/lib/utils.js` (lines 11-51), with its `uistates_store` import path adjusted for the new location

```js
import { get } from 'svelte/store'
import { uistates_store } from '../stores/uistates.js'

export async function httpAPI(method, url, body = null, type = 'json', timeout = 60000) {
  const content_type =
    type === 'json'
      ? 'application/json'
      : 'application/x-www-form-urlencoded; charset=UTF-8'
  const controller = new AbortController()
  const data = {
    method,
    signal: controller.signal,
    headers: { 'Content-Type': content_type },
  }
  if (body) data.body = body
  // do not timeout on the first request, in case authentication is needed
  if (get(uistates_store).has_fetched) {
    setTimeout(() => controller.abort(), timeout)
  }
  if (import.meta.env.DEV) {
    if (!url.includes('http', 0)) url = '/api' + url
  }
  const res = await fetch(url, data)
    .then((response) => (type === 'json' ? response.json() : response.text()))
    .catch((error) => {
      console.log(error)
      return 'error'
    })
  uistates_store.update((x) => {
    x.has_fetched = true
    return x
  })
  return res
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- httpAPI`
Expected: PASS — 2 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Extract httpAPI client into lib/api"
```

### Task 8: Port `utils.js` helpers

**Files:**
- Create: `src/lib/utils.js`
- Test: `src/lib/__tests__/utils.test.js`

- [ ] **Step 1: Copy the v2 utils test**

```bash
cp $V2/src/lib/__tests__/utils.test.js src/lib/__tests__/utils.test.js
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/utils`
Expected: FAIL — cannot resolve `../utils.js`.

- [ ] **Step 3: Create `src/lib/utils.js`** — copy `$V2/src/lib/utils.js`, then make exactly these edits:
  1. **Delete** the `httpAPI` function (lines 11-51 in v2) — it now lives in `lib/api/httpAPI.js`.
  2. **Delete** the now-unused import `import {uistates_store} from "./stores/uistates.js"` only if no remaining function uses it. (`submitFormData` and `reload2ip` use it — so **keep** the import.)
  3. Leave every other helper unchanged (`sec2time`, `formatDate`, `round`, `temp_round`, `clientid2name`, `compareVersion`, `JSONTryParse`, `getBreakpoint`, `validateFormData`, etc.).

```bash
cp $V2/src/lib/utils.js src/lib/utils.js
```
Then open `src/lib/utils.js` and delete the `httpAPI` export (the `export async function httpAPI(...) { ... }` block, ~40 lines). Keep all remaining imports and exports.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/utils`
Expected: PASS — all `utils` describe blocks pass.

> Note: `state2icon`/`displayIcon` return v2-era Bulma class names and icon IDs. They are ported as-is here and will be revised by the screen plans that consume them — not a foundation concern.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Port utils.js helpers from v2"
```

### Task 9: Port the `status`, `config`, and `uistates` stores

**Files:**
- Create: `src/lib/stores/status.js`, `src/lib/stores/config.js`, `src/lib/stores/uistates.js`
- Test: `src/lib/stores/__tests__/status.test.js`, `src/lib/stores/__tests__/config.test.js`, `src/lib/stores/__tests__/uistates.test.js`

- [ ] **Step 1: Copy the v2 store tests**

```bash
mkdir -p src/lib/stores/__tests__
cp $V2/src/lib/stores/__tests__/status.test.js src/lib/stores/__tests__/status.test.js
cp $V2/src/lib/stores/__tests__/config.test.js src/lib/stores/__tests__/config.test.js
cp $V2/src/lib/stores/__tests__/uistates.test.js src/lib/stores/__tests__/uistates.test.js
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- stores/__tests__/status stores/__tests__/config stores/__tests__/uistates`
Expected: FAIL — store modules cannot be resolved.

- [ ] **Step 3: Copy the v2 store sources and fix the `httpAPI` import**

```bash
cp $V2/src/lib/stores/status.js src/lib/stores/status.js
cp $V2/src/lib/stores/config.js src/lib/stores/config.js
cp $V2/src/lib/stores/uistates.js src/lib/stores/uistates.js
```
In `status.js` and `config.js`, change the import:
`import {httpAPI} from '../utils.js'` → `import { httpAPI } from '../api/httpAPI.js'`
`uistates.js` has no `httpAPI` import — leave it unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- stores/__tests__/status stores/__tests__/config stores/__tests__/uistates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Port status, config, and uistates stores from v2"
```

### Task 10: Port the `schedule`, `plan`, `override`, and `limit` stores

**Files:**
- Create: `src/lib/stores/schedule.js`, `src/lib/stores/plan.js`, `src/lib/stores/override.js`, `src/lib/stores/limit.js`
- Test: `src/lib/stores/__tests__/schedule.test.js`, `src/lib/stores/__tests__/override.test.js`, `src/lib/stores/__tests__/limit.test.js`, `src/lib/stores/__tests__/plan.test.js`

- [ ] **Step 1: Copy the v2 tests that exist** (`schedule`, `override`, `limit`)

```bash
cp $V2/src/lib/stores/__tests__/schedule.test.js src/lib/stores/__tests__/schedule.test.js
cp $V2/src/lib/stores/__tests__/override.test.js src/lib/stores/__tests__/override.test.js
cp $V2/src/lib/stores/__tests__/limit.test.js src/lib/stores/__tests__/limit.test.js
```

- [ ] **Step 2: Write a test for `plan`** (v2 has none) — `src/lib/stores/__tests__/plan.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { plan_store } from '../plan.js'
import { httpAPI } from '../../api/httpAPI.js'

describe('plan_store', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exposes subscribe and download', () => {
    expect(typeof plan_store.subscribe).toBe('function')
    expect(typeof plan_store.download).toBe('function')
  })

  it('returns false when the API errors', async () => {
    httpAPI.mockResolvedValue('error')
    expect(await plan_store.download()).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- stores/__tests__/schedule stores/__tests__/override stores/__tests__/limit stores/__tests__/plan`
Expected: FAIL — store modules cannot be resolved.

- [ ] **Step 4: Copy the v2 store sources and fix imports**

```bash
cp $V2/src/lib/stores/schedule.js src/lib/stores/schedule.js
cp $V2/src/lib/stores/plan.js src/lib/stores/plan.js
cp $V2/src/lib/stores/override.js src/lib/stores/override.js
cp $V2/src/lib/stores/limit.js src/lib/stores/limit.js
```
In each of the four files, if it imports `httpAPI`, change `from '../utils.js'` to `from '../api/httpAPI.js'`. If a v2 test file imports `httpAPI` from `'../../utils.js'`, edit that test to import from `'../../api/httpAPI.js'` instead (match the `vi.mock` path too).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- stores/__tests__/schedule stores/__tests__/override stores/__tests__/limit stores/__tests__/plan`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Port schedule, plan, override, and limit stores from v2"
```

### Task 11: Port the `claims_target`, `history`, `certificates`, and `uisettings` stores

**Files:**
- Create: `src/lib/stores/claims_target.js`, `src/lib/stores/history.js`, `src/lib/stores/certificates.js`, `src/lib/stores/uisettings.js`, `src/lib/stores/json/claims_target.json`
- Test: `src/lib/stores/__tests__/history.test.js`, `src/lib/stores/__tests__/certificates.test.js`, `src/lib/stores/__tests__/claims.test.js`, `src/lib/stores/__tests__/uisettings.test.js`

- [ ] **Step 1: Copy the v2 tests that exist** (`history`, `certificates`, `claims`)

```bash
cp $V2/src/lib/stores/__tests__/history.test.js src/lib/stores/__tests__/history.test.js
cp $V2/src/lib/stores/__tests__/certificates.test.js src/lib/stores/__tests__/certificates.test.js
cp $V2/src/lib/stores/__tests__/claims.test.js src/lib/stores/__tests__/claims.test.js
```
If `claims.test.js` imports `claims_target.js`, keep it; if it imports a `claims.js` store not being ported, delete `claims.test.js` instead and skip it in Step 3.

- [ ] **Step 2: Write a test for `uisettings`** — `src/lib/stores/__tests__/uisettings.test.js`

```js
import { describe, it, expect } from 'vitest'
import { get } from 'svelte/store'
import { uisettings_store } from '../uisettings.js'

describe('uisettings_store', () => {
  it('is a writable store with an object value', () => {
    expect(typeof uisettings_store.subscribe).toBe('function')
    expect(typeof get(uisettings_store)).toBe('object')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- stores/__tests__/history stores/__tests__/certificates stores/__tests__/uisettings`
Expected: FAIL — store modules cannot be resolved.

- [ ] **Step 4: Copy the v2 store sources, the JSON model, and fix imports**

```bash
mkdir -p src/lib/stores/json
cp $V2/src/lib/stores/claims_target.js src/lib/stores/claims_target.js
cp $V2/src/lib/stores/history.js src/lib/stores/history.js
cp $V2/src/lib/stores/certificates.js src/lib/stores/certificates.js
cp $V2/src/lib/stores/uisettings.js src/lib/stores/uisettings.js
cp $V2/src/lib/stores/json/claims_target.json src/lib/stores/json/claims_target.json
```
In any of these that import `httpAPI`, change `from '../utils.js'` to `from '../api/httpAPI.js'`. Apply the same import fix to the copied test files' real and `vi.mock` import paths.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — every ported store test passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Port claims_target, history, certificates, and uisettings stores from v2"
```

### Task 12: Port the data components (WebSocket, FetchData, DataManager)

**Files:**
- Create: `src/lib/data/WebSocket.svelte`, `src/lib/data/FetchData.svelte`, `src/lib/data/DataManager.svelte`
- Test: `src/lib/data/__tests__/data-components.test.js`

> These are rewritten for Svelte 5: `onMount`/`onDestroy` stay; v2's `$:` reactive statements become `$effect`. Behavior is unchanged. `FetchData` exposes an `onLoaded` callback prop instead of mutating routing directly, so `App.svelte` owns the loader↔shell switch.

- [ ] **Step 1: Write the failing smoke test** — `src/lib/data/__tests__/data-components.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import WebSocket from '../WebSocket.svelte'
import DataManager from '../DataManager.svelte'

describe('data components', () => {
  it('WebSocket mounts without throwing', () => {
    expect(() => render(WebSocket)).not.toThrow()
  })
  it('DataManager mounts without throwing', () => {
    expect(() => render(DataManager)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- data-components`
Expected: FAIL — components cannot be resolved.

- [ ] **Step 3: Create `src/lib/data/WebSocket.svelte`** — Svelte 5 port of `$V2/src/components/data/WebSocket.svelte`. Logic unchanged; only import paths updated.

```svelte
<script>
  import { onMount, onDestroy } from 'svelte'
  import { DateTime } from 'luxon'
  import { uistates_store } from '../stores/uistates.js'
  import { status_store } from '../stores/status.js'
  import { JSONTryParse } from '../utils.js'

  let socket
  let timerId
  let lastmsg
  let ping_cnt = 0

  onMount(() => connect2socket())
  onDestroy(() => {
    if (socket) socket.close()
    cancelKeepAlive()
  })

  function connect2socket() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
    const s = new globalThis.WebSocket(proto + window.location.host + '/ws')
    socket = s
    s.addEventListener('open', () => {
      $uistates_store.ws_connected = true
      keepAlive(s)
    })
    s.addEventListener('message', (e) => {
      lastmsg = DateTime.now().toUnixInteger()
      if (parseMessage(e.data.toString())) ping_cnt = 0
    })
    s.addEventListener('error', () => {
      lastmsg = DateTime.now().toUnixInteger()
      $uistates_store.ws_connected = false
      cancelKeepAlive()
    })
    s.addEventListener('close', () => {
      lastmsg = DateTime.now().toUnixInteger()
      cancelKeepAlive()
      $uistates_store.ws_connected = false
      setTimeout(() => connect2socket(), 1000)
    })
  }

  function parseMessage(msg) {
    const jsondata = JSONTryParse(msg)
    if (!jsondata) return false
    lastmsg = DateTime.now().toUnixInteger()
    if (!jsondata.pong) {
      status_store.update((cur) => ({ ...(cur || {}), ...jsondata }))
    }
    return true
  }

  function keepAlive(s) {
    const now = DateTime.now().toUnixInteger()
    const timing = now - lastmsg
    if ((!ping_cnt && timing >= 5) || (ping_cnt && ping_cnt <= 3)) {
      if (s && s.readyState === s.OPEN) {
        s.send('{"ping": 1}')
        ping_cnt += 1
      }
    } else if (ping_cnt > 3 && timing >= 5) {
      ping_cnt = 0
      $uistates_store.ws_connected = false
      s.close()
      lastmsg = DateTime.now().toUnixInteger()
      cancelKeepAlive()
      return
    }
    timerId = setTimeout(() => keepAlive(s), ping_cnt ? 1000 : 5000)
  }

  function cancelKeepAlive() {
    if (timerId) clearTimeout(timerId)
  }
</script>
```

- [ ] **Step 4: Create `src/lib/data/FetchData.svelte`** — Svelte 5 port of `$V2/src/components/data/FetchData.svelte`'s loading logic. It does the staged bulk download, reports progress and status via props, and calls `onLoaded()` on success. It renders nothing (the loader UI is `Loader.svelte`, wired in Task 22).

```svelte
<script>
  import { onMount } from 'svelte'
  import { status_store } from '../stores/status.js'
  import { schedule_store } from '../stores/schedule.js'
  import { plan_store } from '../stores/plan.js'
  import { config_store } from '../stores/config.js'
  import { override_store } from '../stores/override.js'
  import { claims_target_store } from '../stores/claims_target.js'
  import { certificate_store } from '../stores/certificates.js'
  import { uistates_store } from '../stores/uistates.js'

  let { onProgress = () => {}, onStatus = () => {}, onLoaded = () => {}, onError = () => {} } = $props()

  const steps = [
    { store: status_store, progress: 20 },
    { store: schedule_store, progress: 30, after: () => ($uistates_store.schedule_version = $status_store.schedule_version) },
    { store: plan_store, progress: 40, after: () => ($uistates_store.schedule_plan_version = $status_store.schedule_plan_version) },
    { store: config_store, progress: 60, after: () => ($uistates_store.config_version = $status_store.config_version) },
    { store: override_store, progress: 80, after: () => ($uistates_store.override_version = $status_store.override_version) },
    { store: claims_target_store, progress: 90, after: () => ($uistates_store.claims_version = $status_store.claims_version) },
    { store: certificate_store, progress: 100 },
  ]

  async function loadData() {
    for (const step of steps) {
      onStatus('loading')
      const ok = await step.store.download()
      if (!ok) {
        onStatus('error')
        onError()
        return
      }
      step.after?.()
      onProgress(step.progress)
    }
    onStatus('ok')
    onLoaded()
  }

  onMount(loadData)
</script>
```

> If a copied store export name differs (e.g. v2 exports `certificate_store` vs `certificates_store`), match the actual export name from the file ported in Task 11.

- [ ] **Step 5: Create `src/lib/data/DataManager.svelte`** — Svelte 5 port of `$V2/src/components/data/DataManager.svelte`. v2's `$:` refresh triggers become `$effect`; the refresh functions and the version-counter guards are unchanged. Copy `$V2/src/components/data/DataManager.svelte` and apply these mechanical changes:
  1. Update every import path: `./../../lib/stores/X.js` → `../stores/X.js`, `./../../lib/utils.js` → `../utils.js`, `./../../lib/queue.js` → `../queue.js`, `./../../lib/vars.js` → `../vars.js`.
  2. Replace each `$: someFn($someStore)` reactive line with `$effect(() => { someFn($someStore) })`.
  3. Keep `keyed` from `svelte-keyed` **only if** that package is installed; otherwise replace each `keyed(status_store, 'field')` with a `derived(status_store, ($s) => $s?.field)` store (import `derived` from `svelte/store`). Since `svelte-keyed` is not in v3's dependencies, use the `derived` replacement.
  4. Keep `onMount`, all `refresh*Store` functions, `getMode`, the counter functions, and `serialQueue` usage as-is.

The reactive block at the end becomes:
```js
$effect(() => { refreshConfigStore($config_version) })
$effect(() => { refreshSchedulestore($schedule_version) })
$effect(() => { refreshPlanStore($schedule_plan_version) })
$effect(() => { refreshClaimsTargetStore($claims_version) })
$effect(() => { refreshOverrideStore($override_version) })
$effect(() => { refreshLimitStore($limit_version) })
$effect(() => { refreshDateTime($time, $config_store?.time_zone) })
$effect(() => { refreshChargingState($charging) })
$effect(() => { refreshLocale($config_store?.lang) })
$effect(() => { countDivertUpdate($status_store?.divert_update) })
$effect(() => { countVehicleUpdate($status_store?.vehicle_state_update) })
$effect(() => { countRFIDScan($rfid_waiting) })
$effect(() => { countElapsed($elapsed, $charging) })
$effect(() => { redirect2ip($ipaddress) })
$effect(() => { setErrorState($state) })
```
And each keyed store becomes, e.g.: `const time = derived(status_store, ($s) => $s?.time)`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- data-components`
Expected: PASS — both components mount without throwing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Port WebSocket, FetchData, and DataManager data components to Svelte 5"
```

---

## Phase 4 — Theme System

### Task 13: Theme store (OS preference + manual override + persistence)

**Files:**
- Create: `src/lib/stores/theme.js`
- Test: `src/lib/stores/__tests__/theme.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/stores/__tests__/theme.test.js`

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'

function mockMatchMedia(prefersDark) {
  window.matchMedia = vi.fn(() => ({
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('theme store', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('resolves to the OS preference when no override is set', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    expect(get(theme).resolved).toBe('dark')
  })

  it('applies the resolved theme to the document element', async () => {
    mockMatchMedia(false)
    const { theme } = await import('../theme.js')
    theme.init()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setTheme overrides the OS preference and persists it', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    theme.setTheme('light')
    expect(get(theme).resolved).toBe('light')
    expect(JSON.parse(localStorage.getItem('oevse-theme'))).toBe('light')
  })

  it('setTheme("system") clears the override', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    theme.setTheme('light')
    theme.setTheme('system')
    expect(get(theme).override).toBe(null)
    expect(get(theme).resolved).toBe('dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- theme`
Expected: FAIL — cannot resolve `../theme.js`.

- [ ] **Step 3: Create `src/lib/stores/theme.js`**

```js
import { writable } from 'svelte/store'

const STORAGE_KEY = 'oevse-theme'

function osPrefersDark() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readOverride() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const val = raw ? JSON.parse(raw) : null
    return val === 'light' || val === 'dark' ? val : null
  } catch {
    return null
  }
}

function resolve(override) {
  if (override) return override
  return osPrefersDark() ? 'dark' : 'light'
}

function createThemeStore() {
  const override = readOverride()
  const { subscribe, set } = writable({ override, resolved: resolve(override) })
  let current = { override, resolved: resolve(override) }

  function apply(state) {
    current = state
    set(state)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', state.resolved)
    }
  }

  function setTheme(choice) {
    const next = choice === 'system' ? null : choice
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable — keep in-memory only */
    }
    apply({ override: next, resolved: resolve(next) })
  }

  function init() {
    apply(current)
    if (typeof window !== 'undefined' && window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (!current.override) apply({ override: null, resolved: resolve(null) })
        })
    }
  }

  return { subscribe, setTheme, init }
}

export const theme = createThemeStore()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- theme`
Expected: PASS — 4 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add OS-aware theme store with manual override"
```

---

## Phase 5 — Internationalization

### Task 14: i18n setup and English catalog

**Files:**
- Create: `src/lib/i18n/index.js`, `src/lib/i18n/en.json`
- Test: `src/lib/i18n/__tests__/i18n.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/i18n/__tests__/i18n.test.js`

```js
import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('i18n English catalog', () => {
  it('has the keys the shell needs', () => {
    expect(en.nav.home).toBeTypeOf('string')
    expect(en.nav.schedule).toBeTypeOf('string')
    expect(en.nav.monitoring).toBeTypeOf('string')
    expect(en.nav.history).toBeTypeOf('string')
    expect(en.connection.lost).toBeTypeOf('string')
    expect(en.loading).toBeTypeOf('string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n`
Expected: FAIL — cannot resolve `../en.json`.

- [ ] **Step 3: Create `src/lib/i18n/en.json`**

```json
{
  "app": "OpenEVSE",
  "loading": "Loading…",
  "nav": {
    "home": "Home",
    "schedule": "Schedule",
    "monitoring": "Monitoring",
    "history": "History"
  },
  "connection": {
    "lost": "Connection lost",
    "lost_body": "Trying to reconnect to the charger…",
    "evse_missing": "EVSE not connected",
    "evse_missing_body": "The WiFi module can't reach the EVSE controller.",
    "error": "Charger error",
    "reconnect": "Reload"
  },
  "screen": {
    "dashboard": "Dashboard",
    "schedule": "Schedule",
    "monitoring": "Monitoring",
    "history": "History",
    "notfound": "Page not found"
  }
}
```

- [ ] **Step 4: Create `src/lib/i18n/index.js`**

```js
import { register, init, getLocaleFromNavigator } from 'svelte-i18n'

register('en', () => import('./en.json'))

export function setupI18n() {
  init({
    fallbackLocale: 'en',
    initialLocale: 'en',
  })
}

export { getLocaleFromNavigator }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- i18n`
Expected: PASS — 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add svelte-i18n setup and English catalog"
```

---

## Phase 6 — Core UI Primitives

> Only the primitives the shell and loader need. Each is small, themed via the CSS-variable Tailwind tokens, and independently testable.

### Task 15: `Button` and `IconButton`

**Files:**
- Create: `src/lib/components/ui/Button.svelte`, `src/lib/components/ui/IconButton.svelte`, `src/lib/icons/Icon.svelte`
- Test: `src/lib/components/ui/__tests__/Button.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/ui/__tests__/Button.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Button from '../Button.svelte'

describe('Button', () => {
  it('renders its label', () => {
    const { getByRole } = render(Button, { props: { label: 'Stop' } })
    expect(getByRole('button')).toHaveTextContent('Stop')
  })

  it('calls onclick when clicked', async () => {
    const onclick = vi.fn()
    const { getByRole } = render(Button, { props: { label: 'Go', onclick } })
    await fireEvent.click(getByRole('button'))
    expect(onclick).toHaveBeenCalledOnce()
  })

  it('is disabled when the disabled prop is set', () => {
    const { getByRole } = render(Button, { props: { label: 'X', disabled: true } })
    expect(getByRole('button')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ui/__tests__/Button`
Expected: FAIL — cannot resolve `../Button.svelte`.

- [ ] **Step 3: Create `src/lib/icons/Icon.svelte`** — thin wrapper over `iconify-icon`

```svelte
<script>
  import 'iconify-icon'
  let { icon, size = 20, class: klass = '' } = $props()
</script>

<iconify-icon icon={icon} width={size} height={size} class={klass}></iconify-icon>
```

- [ ] **Step 4: Create `src/lib/components/ui/Button.svelte`**

```svelte
<script>
  let {
    label = '',
    variant = 'primary',
    disabled = false,
    type = 'button',
    onclick = () => {},
    children,
  } = $props()

  const variants = {
    primary: 'bg-accent text-surface',
    ghost: 'bg-transparent text-text border border-border',
  }
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="w-full rounded-2xl px-4 py-3 font-semibold text-sm transition
         disabled:opacity-40 disabled:cursor-not-allowed {variants[variant]}"
>
  {#if children}{@render children()}{:else}{label}{/if}
</button>
```

- [ ] **Step 5: Create `src/lib/components/ui/IconButton.svelte`**

```svelte
<script>
  import Icon from '../../icons/Icon.svelte'
  let { icon, size = 22, label = '', disabled = false, onclick = () => {} } = $props()
</script>

<button
  type="button"
  {disabled}
  {onclick}
  aria-label={label}
  class="grid place-items-center rounded-full p-2 text-text-dim
         hover:text-text disabled:opacity-40"
>
  <Icon {icon} {size} />
</button>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- ui/__tests__/Button`
Expected: PASS — 3 passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add Button, IconButton, and Icon primitives"
```

### Task 16: `ProgressBar` and `Loader`

**Files:**
- Create: `src/lib/components/ui/ProgressBar.svelte`, `src/lib/components/ui/Loader.svelte`
- Test: `src/lib/components/ui/__tests__/ProgressBar.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/ui/__tests__/ProgressBar.test.js`

```js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ProgressBar from '../ProgressBar.svelte'

describe('ProgressBar', () => {
  it('exposes the value via aria attributes', () => {
    const { getByRole } = render(ProgressBar, { props: { value: 60 } })
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  })

  it('clamps values above 100', () => {
    const { getByRole } = render(ProgressBar, { props: { value: 150 } })
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ProgressBar`
Expected: FAIL — cannot resolve `../ProgressBar.svelte`.

- [ ] **Step 3: Create `src/lib/components/ui/ProgressBar.svelte`**

```svelte
<script>
  let { value = 0 } = $props()
  let clamped = $derived(Math.max(0, Math.min(100, value)))
</script>

<div
  role="progressbar"
  aria-valuenow={clamped}
  aria-valuemin="0"
  aria-valuemax="100"
  class="h-2 w-full overflow-hidden rounded-full bg-surface-3"
>
  <div class="h-full rounded-full bg-accent transition-[width] duration-300" style="width:{clamped}%"></div>
</div>
```

- [ ] **Step 4: Create `src/lib/components/ui/Loader.svelte`** — the startup screen (gear + progress)

```svelte
<script>
  import GearMark from '../../assets/GearMark.svelte'
  import ProgressBar from './ProgressBar.svelte'
  let { progress = 0 } = $props()
</script>

<div class="fixed inset-0 z-50 grid place-items-center bg-surface">
  <div class="flex w-56 flex-col items-center gap-6">
    <GearMark size={84} class="text-accent" />
    <ProgressBar value={progress} />
  </div>
</div>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- ProgressBar`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add ProgressBar and startup Loader"
```

### Task 17: `Modal` and `AlertBox`

**Files:**
- Create: `src/lib/components/ui/Modal.svelte`, `src/lib/components/ui/AlertBox.svelte`
- Test: `src/lib/components/ui/__tests__/AlertBox.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/ui/__tests__/AlertBox.test.js`

```js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import AlertBox from '../AlertBox.svelte'

describe('AlertBox', () => {
  it('renders nothing when not visible', () => {
    const { queryByRole } = render(AlertBox, { props: { visible: false, title: 'T', body: 'B' } })
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the title and body when visible', () => {
    const { getByRole } = render(AlertBox, { props: { visible: true, title: 'Error', body: 'Bad' } })
    const dialog = getByRole('dialog')
    expect(dialog).toHaveTextContent('Error')
    expect(dialog).toHaveTextContent('Bad')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AlertBox`
Expected: FAIL — cannot resolve `../AlertBox.svelte`.

- [ ] **Step 3: Create `src/lib/components/ui/Modal.svelte`**

```svelte
<script>
  let { visible = false, closable = true, onclose = () => {}, children } = $props()
</script>

{#if visible}
  <div
    class="fixed inset-0 z-40 grid place-items-center bg-black/55 p-6"
    onclick={() => closable && onclose()}
    role="presentation"
  >
    <div
      class="w-full max-w-sm rounded-2xl bg-surface-2 p-5 shadow-xl"
      role="dialog"
      aria-modal="true"
      onclick={(e) => e.stopPropagation()}
    >
      {@render children?.()}
    </div>
  </div>
{/if}
```

- [ ] **Step 4: Create `src/lib/components/ui/AlertBox.svelte`**

```svelte
<script>
  import Modal from './Modal.svelte'
  import Button from './Button.svelte'
  let {
    visible = false,
    title = '',
    body = '',
    button = false,
    label = 'OK',
    closable = true,
    action = () => {},
    onclose = () => {},
  } = $props()
</script>

<Modal {visible} {closable} {onclose}>
  <h2 class="text-base font-semibold text-text">{title}</h2>
  <p class="mt-2 text-sm text-text-dim">{body}</p>
  {#if button}
    <div class="mt-4">
      <Button {label} onclick={action} />
    </div>
  {/if}
</Modal>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- AlertBox`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Modal and AlertBox primitives"
```

---

## Phase 7 — Routing & Placeholder Screens

### Task 18: Minimal hash router

**Files:**
- Create: `src/lib/router.js`, `src/lib/components/Router.svelte`
- Test: `src/lib/__tests__/router.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/router.test.js`

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { currentPath, navigate } from '../router.js'

describe('hash router', () => {
  beforeEach(() => { window.location.hash = '' })

  it('defaults to "/" when the hash is empty', () => {
    expect(get(currentPath)).toBe('/')
  })

  it('navigate updates the path and the location hash', () => {
    navigate('/schedule')
    expect(get(currentPath)).toBe('/schedule')
    expect(window.location.hash).toBe('#/schedule')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/router`
Expected: FAIL — cannot resolve `../router.js`.

- [ ] **Step 3: Create `src/lib/router.js`**

```js
import { readable } from 'svelte/store'

function readHash() {
  const h = window.location.hash.replace(/^#/, '')
  return h || '/'
}

export const currentPath = readable(readHash(), (set) => {
  const update = () => set(readHash())
  window.addEventListener('hashchange', update)
  update()
  return () => window.removeEventListener('hashchange', update)
})

export function navigate(path) {
  window.location.hash = path
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/router`
Expected: PASS — 2 passed.

- [ ] **Step 5: Create `src/lib/components/Router.svelte`** — resolves the current path against the route table

```svelte
<script>
  import { currentPath } from '../router.js'
  let { routes = {}, fallback } = $props()
  let Component = $derived(routes[$currentPath] ?? fallback)
</script>

{#if Component}
  <Component />
{/if}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add minimal hash router"
```

### Task 19: Route table and placeholder screens

**Files:**
- Create: `src/routes/Dashboard.svelte`, `src/routes/Schedule.svelte`, `src/routes/Monitoring.svelte`, `src/routes/History.svelte`, `src/routes/NotFound.svelte`, `src/lib/routes.js`
- Test: `src/lib/__tests__/routes.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/routes.test.js`

```js
import { describe, it, expect } from 'vitest'
import { routes } from '../routes.js'

describe('route table', () => {
  it('maps the four primary paths', () => {
    expect(routes['/']).toBeDefined()
    expect(routes['/schedule']).toBeDefined()
    expect(routes['/monitoring']).toBeDefined()
    expect(routes['/history']).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/routes`
Expected: FAIL — cannot resolve `../routes.js`.

- [ ] **Step 3: Create the five placeholder screens.** Each is the same shape — create all five, changing only the i18n key and file name.

`src/routes/Dashboard.svelte`:
```svelte
<script>
  import { _ } from 'svelte-i18n'
</script>
<section class="p-4">
  <h1 class="text-lg font-semibold text-text">{$_('screen.dashboard')}</h1>
</section>
```

`src/routes/Schedule.svelte` — identical but `{$_('screen.schedule')}`.
`src/routes/Monitoring.svelte` — identical but `{$_('screen.monitoring')}`.
`src/routes/History.svelte` — identical but `{$_('screen.history')}`.
`src/routes/NotFound.svelte` — identical but `{$_('screen.notfound')}`.

- [ ] **Step 4: Create `src/lib/routes.js`**

```js
import Dashboard from '../routes/Dashboard.svelte'
import Schedule from '../routes/Schedule.svelte'
import Monitoring from '../routes/Monitoring.svelte'
import History from '../routes/History.svelte'
import NotFound from '../routes/NotFound.svelte'

export const routes = {
  '/': Dashboard,
  '/schedule': Schedule,
  '/monitoring': Monitoring,
  '/history': History,
}

export { NotFound }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- __tests__/routes`
Expected: PASS — 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add route table and placeholder screens"
```

---

## Phase 8 — App Shell

### Task 20: `Header`

**Files:**
- Create: `src/lib/components/shell/Header.svelte`
- Test: `src/lib/components/shell/__tests__/Header.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/shell/__tests__/Header.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import Header from '../Header.svelte'

describe('Header', () => {
  it('shows the device name', () => {
    const { getByText } = render(Header, { props: { deviceName: 'Garage EVSE', connected: true } })
    expect(getByText('Garage EVSE')).toBeInTheDocument()
  })

  it('marks the status dot disconnected when not connected', () => {
    const { getByLabelText } = render(Header, { props: { deviceName: 'X', connected: false } })
    expect(getByLabelText('disconnected')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- shell/__tests__/Header`
Expected: FAIL — cannot resolve `../Header.svelte`.

- [ ] **Step 3: Create `src/lib/components/shell/Header.svelte`**

```svelte
<script>
  import GearMark from '../../assets/GearMark.svelte'
  let { deviceName = 'OpenEVSE', connected = true } = $props()
</script>

<header class="flex items-center justify-between px-4 py-3">
  <div class="flex items-center gap-2">
    <GearMark size={26} class="text-accent" />
    <span class="text-sm font-semibold text-text">{deviceName}</span>
  </div>
  <span
    aria-label={connected ? 'connected' : 'disconnected'}
    class="h-2.5 w-2.5 rounded-full {connected ? 'bg-accent' : 'bg-error'}"
  ></span>
</header>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- shell/__tests__/Header`
Expected: PASS — 2 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add shell Header"
```

### Task 21: `BottomNav`

**Files:**
- Create: `src/lib/components/shell/BottomNav.svelte`
- Test: `src/lib/components/shell/__tests__/BottomNav.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/shell/__tests__/BottomNav.test.js`

```js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'

import BottomNav from '../BottomNav.svelte'

describe('BottomNav', () => {
  it('renders a link for each of the four primary routes', () => {
    const { getAllByRole } = render(BottomNav, { props: { path: '/' } })
    expect(getAllByRole('link')).toHaveLength(4)
  })

  it('marks the active route with aria-current', () => {
    const { getByLabelText } = render(BottomNav, { props: { path: '/schedule' } })
    expect(getByLabelText('Schedule')).toHaveAttribute('aria-current', 'page')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BottomNav`
Expected: FAIL — cannot resolve `../BottomNav.svelte`.

- [ ] **Step 3: Create `src/lib/components/shell/BottomNav.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'

  let { path = '/' } = $props()

  const items = [
    { href: '/', key: 'nav.home', icon: 'mdi:home-outline' },
    { href: '/schedule', key: 'nav.schedule', icon: 'mdi:calendar-clock-outline' },
    { href: '/monitoring', key: 'nav.monitoring', icon: 'mdi:chart-line' },
    { href: '/history', key: 'nav.history', icon: 'mdi:history' },
  ]
</script>

<nav
  class="flex h-14 items-stretch border-t border-border bg-surface-2
         sm:h-full sm:w-20 sm:flex-col sm:border-r sm:border-t-0"
>
  {#each items as item}
    <a
      href="#{item.href}"
      aria-label={$_(item.key.replace('nav.', 'screen.') ) || item.key}
      aria-current={path === item.href ? 'page' : undefined}
      class="flex flex-1 flex-col items-center justify-center gap-1 text-[10px]
             {path === item.href ? 'text-accent' : 'text-text-dim'}"
    >
      <Icon icon={item.icon} size={22} />
      <span>{$_(item.key)}</span>
    </a>
  {/each}
</nav>
```

> The `aria-label` must be the screen name so the test's `getByLabelText('Schedule')` resolves. With the real i18n catalog `$_('nav.schedule')` is `"Schedule"`; in the test, `svelte-i18n` is not mocked here, so import the real catalog. To keep the test deterministic, the test file above relies on `svelte-i18n` returning the key — adjust: set `aria-label={$_(item.key)}` and have the test query `getByLabelText('nav.schedule')`. Use this final form:
>
> `aria-label={$_(item.key)}` and in the test: `getByLabelText('nav.schedule')`.

Apply that correction: in `BottomNav.svelte` use `aria-label={$_(item.key)}`, and in the test Step 1 change the query to `getByLabelText('nav.schedule')` and add the `svelte-i18n` mock used in `Header.test.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- BottomNav`
Expected: PASS — 2 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add shell BottomNav"
```

### Task 22: `ConnectionBanners` and `AppShell`

**Files:**
- Create: `src/lib/components/shell/ConnectionBanners.svelte`, `src/lib/components/shell/AppShell.svelte`
- Test: `src/lib/components/shell/__tests__/ConnectionBanners.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/shell/__tests__/ConnectionBanners.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ConnectionBanners from '../ConnectionBanners.svelte'

describe('ConnectionBanners', () => {
  it('shows nothing when connected and healthy', () => {
    const { container } = render(ConnectionBanners, {
      props: { wsConnected: true, evseConnected: true, error: false },
    })
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })

  it('shows the connection-lost banner when the websocket is down', () => {
    const { getAllByRole } = render(ConnectionBanners, {
      props: { wsConnected: false, evseConnected: true, error: false },
    })
    expect(getAllByRole('alert').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ConnectionBanners`
Expected: FAIL — cannot resolve `../ConnectionBanners.svelte`.

- [ ] **Step 3: Create `src/lib/components/shell/ConnectionBanners.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  let { wsConnected = true, evseConnected = true, error = false } = $props()
</script>

{#if !wsConnected}
  <div role="alert" class="bg-error/15 px-4 py-2 text-sm text-error">
    {$_('connection.lost')} — {$_('connection.lost_body')}
  </div>
{/if}
{#if !evseConnected}
  <div role="alert" class="bg-warning/15 px-4 py-2 text-sm text-warning">
    {$_('connection.evse_missing')} — {$_('connection.evse_missing_body')}
  </div>
{/if}
{#if error}
  <div role="alert" class="bg-error/15 px-4 py-2 text-sm text-error">
    {$_('connection.error')}
  </div>
{/if}
```

- [ ] **Step 4: Create `src/lib/components/shell/AppShell.svelte`** — composes header, banners, routed content, and nav

```svelte
<script>
  import { currentPath } from '../../router.js'
  import { routes, NotFound } from '../../routes.js'
  import { status_store } from '../../stores/status.js'
  import { uistates_store } from '../../stores/uistates.js'
  import Router from '../Router.svelte'
  import Header from './Header.svelte'
  import BottomNav from './BottomNav.svelte'
  import ConnectionBanners from './ConnectionBanners.svelte'

  let deviceName = $derived($status_store?.name || 'OpenEVSE')
  let evseConnected = $derived($status_store?.evse_connected ?? true)
  let wsConnected = $derived($uistates_store?.ws_connected ?? true)
  let error = $derived($uistates_store?.error ?? false)
</script>

<div class="flex h-full flex-col sm:flex-row-reverse">
  <div class="flex min-h-0 flex-1 flex-col">
    <Header {deviceName} connected={wsConnected && evseConnected} />
    <ConnectionBanners {wsConnected} {evseConnected} {error} />
    <main class="min-h-0 flex-1 overflow-y-auto">
      <Router {routes} fallback={NotFound} />
    </main>
  </div>
  <BottomNav path={$currentPath} />
</div>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- ConnectionBanners`
Expected: PASS — 2 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add ConnectionBanners and AppShell"
```

---

## Phase 9 — Integration

### Task 23: Wire `App.svelte` — loader ↔ shell, theme, i18n, data components

**Files:**
- Replace: `src/App.svelte`
- Test: `src/__tests__/App.test.js`

- [ ] **Step 1: Write the failing test** — `src/__tests__/App.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t, register: vi.fn(), init: vi.fn(), getLocaleFromNavigator: () => 'en' }
})
vi.mock('../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import App from '../App.svelte'

describe('App', () => {
  it('renders the loader before data has loaded', () => {
    const { container } = render(App)
    // Loader covers the screen; the BottomNav is not present yet.
    expect(container.querySelector('nav')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/App`
Expected: FAIL — the current `App.svelte` placeholder has no loader logic; `container.querySelector('nav')` assertion or import wiring fails.

- [ ] **Step 3: Replace `src/App.svelte`**

```svelte
<script>
  import { onMount } from 'svelte'
  import { setupI18n } from './lib/i18n/index.js'
  import { theme } from './lib/stores/theme.js'
  import Loader from './lib/components/ui/Loader.svelte'
  import AppShell from './lib/components/shell/AppShell.svelte'
  import AlertBox from './lib/components/ui/AlertBox.svelte'
  import FetchData from './lib/data/FetchData.svelte'
  import WebSocket from './lib/data/WebSocket.svelte'
  import DataManager from './lib/data/DataManager.svelte'
  import { uistates_store } from './lib/stores/uistates.js'
  import { _ } from 'svelte-i18n'

  setupI18n()

  let loaded = $state(false)
  let progress = $state(0)
  let failed = $state(false)

  onMount(() => theme.init())
</script>

{#if !loaded}
  <Loader {progress} />
  <FetchData
    onProgress={(p) => (progress = p)}
    onLoaded={() => (loaded = true)}
    onError={() => (failed = true)}
  />
  <AlertBox
    visible={failed}
    title={$_('connection.error')}
    body={$_('connection.lost_body')}
    button={true}
    label={$_('connection.reconnect')}
    closable={false}
    action={() => location.reload()}
  />
{:else}
  <AppShell />
  <WebSocket />
  <DataManager />
  <AlertBox
    visible={$uistates_store.alertbox.visible}
    title={$uistates_store.alertbox.title}
    body={$uistates_store.alertbox.body}
    button={$uistates_store.alertbox.button}
    closable={$uistates_store.alertbox.closable}
    action={$uistates_store.alertbox.action}
    onclose={() => ($uistates_store.alertbox.visible = false)}
  />
{/if}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/App`
Expected: PASS — 1 passed.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — every test in the suite passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Wire App.svelte: loader, shell, theme, i18n, data components"
```

### Task 24: Build verification and README

**Files:**
- Create: `README.md`
- Modify: `package.json` (scripts already present — verify)

- [ ] **Step 1: Verify the production build**

Run: `npm run build`
Expected: build succeeds; `dist/` contains gzipped JS/CSS, `index.html`, the PWA service worker, and the PWA icons.

- [ ] **Step 2: Verify coverage runs**

Run: `npm run test:coverage`
Expected: coverage report prints; `src/lib` files are covered.

- [ ] **Step 3: Create `README.md`**

```markdown
# OpenEVSE GUI v3

Replacement web UI for the OpenEVSE WiFi module. Svelte 5 + Vite + Tailwind.

## Develop

Set `VITE_OPENEVSEHOST` in `.env` (copy from `.env.example`; default `openevse.local`).

    npm install
    npm run dev

## Build

    npm run build      # static, gzipped output in dist/ for the device

## Test

    npm test           # run once
    npm run test:watch
    npm run test:coverage

## Status

Foundation + app shell complete. Primary screens (Dashboard, Schedule,
Monitoring, History) and Configuration are tracked in
`docs/superpowers/`.
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add README and verify production build"
```

---

## Self-Review

**Spec coverage:**
- Stack (Svelte 5 + Vite + Tailwind + svelte-i18n) — Tasks 1, 2, 14. ✓
- Build constraints (`base: './'`, PWA self-destroying, gzip `deleteOriginFile`, manualChunks, dev proxy, system font) — Tasks 2, 3. ✓
- Bundled icons (no CDN) — `iconify-icon` is bundled via npm, Task 15. ✓ (A trimmed offline icon set is a refinement for the screen plans, noted as such.)
- Hash routing — Task 18. ✓
- Data layer port (httpAPI, queue, vars, utils, all listed stores, WebSocket/FetchData/DataManager) — Tasks 6-12. ✓
- Theme tokens + OS-aware theme store with override + persistence — Tasks 2, 13. ✓
- Brand asset (softened keyhole gear, currentColor SVG, PWA icons) — Task 5. ✓
- UI primitives — shell-needed ones (Button, IconButton, Loader, ProgressBar, Modal, AlertBox) in Tasks 15-17; the rest explicitly deferred to screen plans (stated in plan-level decisions). ✓
- App shell (Header, BottomNav, banners, startup loader) — Tasks 16, 20-23. ✓
- i18n from day one with English catalog — Task 14. ✓
- Error handling (FetchData failure dialog, WS reconnect, banners) — Tasks 12, 22, 23. ✓
- Placeholder primary screens — Task 19. ✓
- Testing (Vitest + jsdom + testing-library, coverage on `src/lib`, ported v2 tests) — Tasks 4, 6-23. ✓

**Type/name consistency:** store export names (`status_store`, `config_store`, `schedule_store`, `plan_store`, `override_store`, `claims_target_store`, `certificate_store`, `uistates_store`, `uisettings_store`) are used consistently; Task 11 Step 4 flags verifying the exact `certificate_store` export name against the ported file. `theme` store API (`setTheme`, `init`, `{override, resolved}`) is consistent across Task 13 and Task 23. Router API (`currentPath`, `navigate`) consistent across Tasks 18-19, 22.

**Placeholder scan:** no TBD/TODO. Each code step contains complete code or a precise, bounded port instruction against the named `$V2` reference.

**Known follow-ups (correctly deferred, not gaps):** offline icon-set trimming, the v2-era Bulma class names inside `state2icon`/`displayIcon`, and the non-shell UI primitives — all belong to the screen plans that consume them.
