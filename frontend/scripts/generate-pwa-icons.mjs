import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = path.join(ROOT, 'public')
const LOGO_SVG = path.join(ROOT, 'src', 'assets', 'logo.svg')

function extractEmbeddedPng(svgText) {
  const match = svgText.match(/data:image\/png;base64,([A-Za-z0-9+/=\s]+)/)
  if (!match) {
    throw new Error(`No embedded PNG found in ${LOGO_SVG}`)
  }
  return Buffer.from(match[1].replace(/\s+/g, ''), 'base64')
}

async function cornerBackground(png) {
  const { data } = await sharp(png)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const [r, g, b, a] = data
  if (a < 16) {
    return { r: 255, g: 255, b: 255, alpha: 1 }
  }
  return { r, g, b, alpha: 1 }
}

async function makeIcon(sourcePng, size, { maskable = false, background }) {
  const padRatio = maskable ? 0.2 : 0.06
  const pad = Math.round(size * padRatio)
  const inner = Math.max(1, size - pad * 2)
  const fitted = await sharp(sourcePng)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: fitted, left: pad, top: pad }])
    .png()
    .toBuffer()
}

const svg = fs.readFileSync(LOGO_SVG, 'utf8')
const sourcePng = extractEmbeddedPng(svg)
const background = await cornerBackground(sourcePng)

fs.mkdirSync(PUBLIC, { recursive: true })

const outputs = [
  ['favicon-32x32.png', await makeIcon(sourcePng, 32, { background })],
  ['apple-touch-icon.png', await makeIcon(sourcePng, 180, { background })],
  ['pwa-192x192.png', await makeIcon(sourcePng, 192, { background })],
  ['pwa-512x512.png', await makeIcon(sourcePng, 512, { background })],
  [
    'pwa-512x512-maskable.png',
    await makeIcon(sourcePng, 512, { maskable: true, background }),
  ],
]

for (const [name, buf] of outputs) {
  fs.writeFileSync(path.join(PUBLIC, name), buf)
}

const favicon32 = outputs[0][1]
fs.writeFileSync(
  path.join(PUBLIC, 'favicon.svg'),
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <image href="data:image/png;base64,${favicon32.toString('base64')}" x="0" y="0" width="32" height="32"/>
</svg>
`,
)

console.log('Wrote clinic logo PWA icons to public/')
