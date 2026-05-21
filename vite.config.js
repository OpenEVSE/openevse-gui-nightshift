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
