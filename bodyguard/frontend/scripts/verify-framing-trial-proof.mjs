// S2.M4: byte integrity and current-source correspondence, never a fresh browser/clinical test.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))
const proof = resolve(root, '../docs/review/observer-framing')
const manifest = JSON.parse(readFileSync(resolve(proof, 'manifest.json'), 'utf8'))
const sha = (data) => createHash('sha256').update(data).digest('hex')
for (const [file, expected] of Object.entries(manifest.artifacts)) {
  const raw = readFileSync(resolve(proof, file))
  const data = expected.compressed ? gunzipSync(raw) : raw
  assert.equal(data.length, expected.bytes, file)
  assert.equal(sha(data), expected.sha256, file)
}
if (process.argv.includes('--current')) {
  for (const [file, expected] of Object.entries(manifest.source))
    assert.equal(sha(readFileSync(resolve(root, file))), expected.sha256, file)
}
const checks = JSON.parse(gunzipSync(readFileSync(resolve(proof, 'raw/checks/report.json.gz'))))
const browser = JSON.parse(gunzipSync(readFileSync(resolve(proof, 'raw/browser/report.json.gz'))))
assert(checks.pass && browser.pass)
assert.equal(browser.controlledCameraCalls, 0)
assert.equal(browser.controlledExternalRequests, 0)
assert.equal(browser.storageWrites, 0)
assert.equal(browser.sdkCamera.endedTracks, 2)
assert.equal(browser.errors.length, 0)
for (const [file, expected] of Object.entries(checks.source))
  assert.equal(expected, manifest.source[file]?.sha256)
for (const [file, expected] of Object.entries(browser.source))
  assert.equal(expected, manifest.source[file]?.sha256)
console.log(
  JSON.stringify({
    artifacts: Object.keys(manifest.artifacts).length,
    sources: Object.keys(manifest.source).length,
    current: process.argv.includes('--current'),
    pass: true,
  }),
)
