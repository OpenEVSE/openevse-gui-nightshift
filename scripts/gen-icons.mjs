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

// iOS splash image for iPhone 14 / 15 portrait (1170×2532, 3× DPR). Other
// iPhones get the default white/black splash — adding the rest is mostly
// busywork; this covers the user's primary device.
async function splash(w, h, file) {
  const gearSize = Math.round(Math.min(w, h) * 0.4)
  const gear = await sharp(colored, { density: 384 }).resize(gearSize, gearSize).png().toBuffer()
  const left = Math.round((w - gearSize) / 2)
  const top = Math.round((h - gearSize) / 2)
  await sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite([{ input: gear, top, left }])
    .png()
    .toFile(new URL(`../public/${file}`, import.meta.url).pathname)
}
await splash(1170, 2532, 'apple-splash-1170x2532.png')

// favicon: a 48px PNG written as favicon.ico (browsers accept PNG data here)
const fav = await sharp(colored, { density: 384 }).resize(40, 40).extend({
  top: 4, bottom: 4, left: 4, right: 4, background: bg,
}).png().toBuffer()
writeFileSync(new URL('../public/favicon.ico', import.meta.url).pathname, fav)

console.log('icons generated')
