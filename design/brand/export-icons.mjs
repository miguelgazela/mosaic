// Exports the Mosaic app icon from the 2048 px source into web/public/.
// Source is RGB with black corners, so corners (dark pixels reachable from the 4 corners) become transparent.
// Run from web/:  npm i --no-save sharp && node ../design/brand/export-icons.mjs
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const sharp = createRequire(join(process.cwd(), 'x.js'))('sharp') // resolved from web/node_modules
const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, 'mosaic-icon-source-2048.png')
const out = join(here, '..', '..', 'web', 'public')

const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: w, height: h } = info
const dark = (i) => data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2] < 150
const outside = new Uint8Array(w * h)
const stack = [0, w - 1, (h - 1) * w, h * w - 1]
while (stack.length) {
  const i = stack.pop()
  if (outside[i] || !dark(i)) continue
  outside[i] = 1
  const x = i % w
  if (x > 0) stack.push(i - 1)
  if (x < w - 1) stack.push(i + 1)
  if (i >= w) stack.push(i - w)
  if (i < w * (h - 1)) stack.push(i + w)
}
// Grow the cut 2 px and soften it so no black fringe survives downscaling.
const mask = Buffer.alloc(w * h, 255)
for (let i = 0; i < w * h; i++) if (outside[i]) mask[i] = 0
const blurred = await sharp(mask, { raw: { width: w, height: h, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer()
const soft = Buffer.from(blurred.map((v) => Math.max(0, Math.min(255, v * 1.6 - 80))))
const rgba = Buffer.alloc(w * h * 4)
for (let i = 0; i < w * h; i++) {
  rgba[i * 4] = data[i * 3]
  rgba[i * 4 + 1] = data[i * 3 + 1]
  rgba[i * 4 + 2] = data[i * 3 + 2]
  rgba[i * 4 + 3] = soft[i]
}
const base = sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
const png = (size, name) => base.clone().resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(join(out, name))
await png(512, 'mosaic-icon-512.png')
// iOS rounds the corners itself and paints transparency black: ship a full-bleed square.
const bg = [...data.subarray((1024 * w + 60) * 3, (1024 * w + 60) * 3 + 3)] // cream background sampled from the icon
await base.clone().flatten({ background: { r: bg[0], g: bg[1], b: bg[2] } }).resize(180, 180, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(join(out, 'apple-touch-icon.png'))
await png(32, 'favicon-32.png')
await png(16, 'favicon-16.png')
console.log('done')
