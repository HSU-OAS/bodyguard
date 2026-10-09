// Supplemental original-archive identity check; not a browser/test rerun.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(root + 'manifest.json'))
const item = manifest.artifacts['run/first-manifest.json']
const compressed = readFileSync(root + item.file)
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
assert.equal(sha(compressed), item.compressedSha256)
const bytes = gunzipSync(compressed)
assert.equal(bytes.length, item.bytes)
assert.equal(sha(bytes), item.sha256)
const first = JSON.parse(bytes)
const raw = new Set(Object.values(manifest.artifacts).map((entry) => entry.sha256))
const zipped = new Set(Object.values(manifest.artifacts).map((entry) => entry.compressedSha256))
assert.equal(Object.keys(first.artifacts).length, 954)
for (const entry of Object.values(first.artifacts)) {
  assert(raw.has(entry.sha256))
  assert(zipped.has(entry.compressedSha256))
}
console.log(JSON.stringify({pass: true, retainedOriginalArtifacts: 954, missing: 0}))
