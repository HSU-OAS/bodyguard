// Verify preserved execution bytes and the exact source tested; never runs SDK/database work.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const root = new URL('./', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
for (const item of manifest.files) {
  assert(!item.file.includes('/') && !item.file.includes('\\') && item.file.endsWith('.gz'))
  const packed = readFileSync(new URL(item.file, root))
  const original = gunzipSync(packed)
  assert.equal(sha(packed), item.gzipSha256)
  assert.equal(sha(original), item.sha256)
  assert.equal(original.length, item.bytes)
}
const sources = [
  'src/pose/workerInference.ts', 'src/pose/workerInference.test.ts', 'e2e/nativeworker.spec.ts',
  'e2e/fixtures/nativeHeadAuthProbe.ts', 'src/coaching/nativePlaybackResources.ts',
]
assert.deepEqual(Object.keys(manifest.sources).sort(), sources.sort())
for (const source of sources)
  assert.equal(sha(readFileSync(new URL('../../../frontend/' + source, root))), manifest.sources[source])
console.log(JSON.stringify({ files: manifest.files.length, sources: sources.length, verified: true }))
