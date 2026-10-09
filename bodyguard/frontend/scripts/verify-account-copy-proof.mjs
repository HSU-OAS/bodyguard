// S4.D4 / NFR-08: verify stored originals, screenshots and exact current UI/test source.
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))
const proof = resolve(root, '../docs/review/account-minimal-copy/evidence')
const manifest = JSON.parse(readFileSync(resolve(proof, 'manifest.json'), 'utf8'))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
for (const [name, expected] of Object.entries(manifest.artifacts)) {
  assert(!name.includes('/') && !name.includes('..'))
  assert(sha(readFileSync(resolve(proof, name))) === expected, `Artifact changed: ${name}`)
}
for (const [name, expected] of Object.entries(manifest.original)) {
  assert(/^[a-zA-Z0-9._/-]+$/.test(name) && !name.split('/').includes('..'))
  const original = execFileSync('tar', [
    '-xOf',
    resolve(proof, 'original-proof.tar.gz'),
    `./${name}`,
  ])
  assert(sha(original) === expected, `Original changed: ${name}`)
}
for (const [file, expected] of Object.entries(manifest.current)) {
  const archived = gunzipSync(
    readFileSync(resolve(proof, `current-${file.replaceAll('/', '--')}.gz`)),
  )
  assert(sha(archived) === expected)
  if (process.argv.includes('--current'))
    assert(sha(readFileSync(resolve(root, file))) === expected, `Source changed: ${file}`)
}
process.stdout.write(
  `${JSON.stringify({ original: Object.keys(manifest.original).length, artifacts: Object.keys(manifest.artifacts).length, current: process.argv.includes('--current'), passed: true })}\n`,
)
