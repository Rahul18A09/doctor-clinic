import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'

const destDir = path.resolve(import.meta.dirname, '../certs')
const dest = path.join(destDir, 'rootCA.pem')

function findCaroot() {
  try {
    const out = execSync('mkcert -CAROOT', { encoding: 'utf8' }).trim()
    if (out && fs.existsSync(path.join(out, 'rootCA.pem'))) {
      return out
    }
  } catch {
    /* mkcert may not be on PATH */
  }

  const fallback = path.join(os.homedir(), 'AppData', 'Local', 'mkcert')
  if (fs.existsSync(path.join(fallback, 'rootCA.pem'))) {
    return fallback
  }

  throw new Error(
    'mkcert CA not found. Install mkcert (winget install FiloSottile.mkcert) and run mkcert -install.',
  )
}

const src = path.join(findCaroot(), 'rootCA.pem')
fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log(`Copied mkcert CA to:\n  ${dest}`)
console.log(
  'Send this file to the phone (USB, Drive, or chat), then install it as a CA certificate. Do not commit it.',
)
