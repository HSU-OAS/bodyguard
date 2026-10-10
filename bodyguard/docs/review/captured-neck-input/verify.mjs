// FR-M-02/07·NFR-07: proof/source integrity only; not clinical or release qualification.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')
const manifest = JSON.parse(readFileSync(resolve(here, 'manifest.json'), 'utf8'))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
for (const [file, expected] of Object.entries(manifest.sources))
  assert.equal(sha(readFileSync(resolve(root, file))), expected, file)
for (const entry of manifest.files) {
  const bytes = readFileSync(resolve(here, entry.file))
  assert.equal(sha(bytes), entry.sha256, entry.file)
  const raw = gunzipSync(bytes)
  assert.equal(raw.length, entry.originalBytes, entry.file)
  assert.equal(sha(raw), entry.originalSha256, entry.file)
}
console.log(JSON.stringify({ evidence: manifest.files.length, sources: Object.keys(manifest.sources).length, actualPeople: 0, clinicalValidation: false }))
