// FR-M-02/NFR-08: read-only actual local v1 model verification, separate from synthetic units.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MODEL_ASSETS } from '../src/pose/ownedModelAssets.ts'

const root = fileURLToPath(new URL('../public/', import.meta.url))
const results = []
for (const [name, asset] of Object.entries(MODEL_ASSETS)) {
  const bytes = readFileSync(`${root}${asset.path.slice(1)}`)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  assert.equal(bytes.length, asset.bytes)
  assert.equal(sha256, asset.sha256)
  results.push({ name, path: asset.path, bytes: bytes.length, sha256 })
}
console.log(JSON.stringify({ method: 'actual installed public model bytes, read-only', results }))
