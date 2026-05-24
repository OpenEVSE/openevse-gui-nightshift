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

// iOS "Add to Home Screen": uses apple-touch-icon at 180×180 with no
// transparency (iOS adds its own rounded mask).
await icon(180, 0.16, 'apple-touch-icon.png')

// (No apple-touch-startup-image splash. A single device-specific PNG was
// ~78 kB on flash for ~500 ms of visible value before the JS app paints —
// bad tradeoff for an embedded device. iOS uses its default splash.)

// favicon: a 48px PNG written as favicon.ico (browsers accept PNG data here)
const fav = await sharp(colored, { density: 384 }).resize(40, 40).extend({
  top: 4, bottom: 4, left: 4, right: 4, background: bg,
}).png().toBuffer()
writeFileSync(new URL('../public/favicon.ico', import.meta.url).pathname, fav)

console.log('icons generated')
