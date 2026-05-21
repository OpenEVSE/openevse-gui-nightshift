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
          manualChunks: (id) => {
            if (['luxon', 'svelte-i18n', 'iconify-icon'].some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
              return 'vendor'
            }
          },
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
