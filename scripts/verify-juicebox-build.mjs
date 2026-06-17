// scripts/verify-juicebox-build.mjs
// Fails the build if the JuiceBox profile shipped the uplot chart chunk.
import { readdirSync } from 'node:fs'

const dir = 'dist-juicebox/assets'
let files = []
try { files = readdirSync(dir) } catch { /* no assets dir */ }
const leaked = files.filter((f) => /^charts-.*\.(js|css)(\.gz)?$/.test(f))
if (leaked.length) {
  console.error(`JuiceBox build leaked chart chunk(s): ${leaked.join(', ')}`)
  process.exit(1)
}
console.log('OK: JuiceBox build contains no uplot/chart chunk.')
