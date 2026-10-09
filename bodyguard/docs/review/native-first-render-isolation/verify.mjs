// Lossless technical evidence verification; no product, camera or inference execution.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
const out = dirname(fileURLToPath(import.meta.url)), root = resolve(out, '../../../..')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(readFileSync(resolve(out, 'manifest.json'), 'utf8'))
for (const item of [...manifest.files, ...manifest.sources]) {
  assert(!item.file.includes('/') && !item.file.includes('..'))
  const compressed = readFileSync(resolve(out, item.file))
  assert.equal(sha(compressed), item.compressedSha256)
  const bytes = gunzipSync(compressed)
  assert.equal(bytes.length, item.bytes)
  assert.equal(sha(bytes), item.sha256)
  if (process.argv.includes('--current') && item.path)
    assert.equal(sha(readFileSync(resolve(root, item.path))), item.sha256)
}
assert.equal(manifest.base, '600f930d0ad5eda5fc975f497e575160f4b86f49')
assert.equal(manifest.productSourceChanged, true)
console.log(JSON.stringify({files:manifest.files.length,sources:manifest.sources.length,current:process.argv.includes('--current'),verified:true}))
