import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { compression } from 'vite-plugin-compression2'
import { mockPlugin } from './dev/mock-plugin.js'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const host = env.VITE_OPENEVSEHOST || 'openevse.local'
  const isMock = mode === 'mock'
  return {
    base: './',
    // Expose the package.json version as __APP_VERSION__ at build time —
    // the Firmware settings page reads this to show the GUI version
    // alongside the EVSE / WiFi gateway firmware numbers.
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      svelte(),
      tailwindcss(),
      ...(isMock ? [mockPlugin()] : []),
      // Injects the built CSS into the JS bundle at runtime instead of
      // emitting a separate .css file — one less file the browser needs a
      // fresh TLS handshake for on page load (see the build.rollupOptions
      // comment below for why that matters on this device).
      cssInjectedByJsPlugin(),
      VitePWA({
        // Graceful PWA sunset: new users never get a SW registered
        // (`injectRegister: null`), and any user who installed an older
        // SW-enabled build gets a self-destroying SW that unregisters
        // itself + clears caches on next visit (see dist/sw.js).
        // The manifest stays so "Add to Home Screen" still works.
        registerType: 'autoUpdate',
        injectRegister: null,
        selfDestroying: true,
        workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,gz}'] },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
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
      compression({
        algorithms: ['gzip'],
        deleteOriginalAssets: true,
        include: /\.(js|mjs|json|css|html|svg)$/i,
        exclude: /sw\.js$/i,
      }),
    ],
    build: {
      sourcemap: false,
      // Single JS/CSS bundle rather than splitting into vendor/charts/app
      // chunks — the device's HTTPS listener closes every connection after
      // one response (no keep-alive in the vendored Mongoose), so each
      // extra file the browser fetches in parallel on page load is another
      // full TLS handshake. The ESP32 can only sustain about one of those
      // at a time; more than that and most get reset, leaving the page
      // blank. Fewer files served narrows that window. See git log for the
      // device-side investigation.
      rollupOptions: {
        output: {
          manualChunks: undefined,
          // codeSplitting: false (the non-deprecated replacement) still
          // splits off dynamic import() boundaries (the per-locale i18n
          // chunks), recreating the multi-file problem this is solving.
          // inlineDynamicImports actually merges those too, at the cost of
          // a build-time deprecation warning only.
          inlineDynamicImports: true,
        },
      },
    },
    server: {
      host: '0.0.0.0',
      ...(isMock
        ? {} // In mock mode the plugin handles /api and /ws — no proxy needed
        : {
            proxy: {
              '/api': { target: `http://${host}`, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
              '/ws': { target: `ws://${host}`, ws: true },
              '/debug/console': { target: `ws://${host}`, ws: true },
              '/evse/console': { target: `ws://${host}`, ws: true },
              '/debug': { target: `http://${host}`, changeOrigin: true },
              '/evse': { target: `http://${host}`, changeOrigin: true },
            },
          }),
    },
  }
})
