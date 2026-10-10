// FR-M-07: preserve exact evidence bytes; never a clinical/participant verdict.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = dirname(fileURLToPath(import.meta.url)),
  manifest = JSON.parse(readFileSync(join(root, 'manifest.json'))),
  sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
for (const entry of manifest.entries) {
  const path = resolve(root, entry.path)
  assert(path.startsWith(`${root}/`))
  const bytes = readFileSync(path)
  assert.equal(sha(bytes), entry.sha)
  const original = entry.gzip ? gunzipSync(bytes) : bytes
  assert.equal(original.length, entry.originalBytes)
  assert.equal(sha(original), entry.originalSha)
  if (process.argv.includes('--current') && entry.path.startsWith('source/final/')) {
    const relative = entry.path.slice('source/final/'.length).replace(/\.gz$/, '')
    const source = resolve(root, '../../../../', relative)
    assert(source.startsWith(`${resolve(root, '../../../../')}/bodyguard/frontend/`))
    assert.equal(sha(readFileSync(source)), entry.originalSha)
  }
}
const read = (path) => JSON.parse(gunzipSync(readFileSync(join(root, path))))
const red = read('evidence/unit/red.json.gz'),
  final = read('evidence/unit/full-reviewed.json.gz'),
  browserRed = read('evidence/browser/browser-red.json.gz'),
  browserFinal = read('evidence/browser/browser-green.json.gz')
assert.equal(red.numFailedTests, 19)
assert.equal(final.numPassedTests, 1397)
assert.equal(final.numFailedTests, 0)
assert.equal(browserRed.failure.name, 'AssertionError')
assert.equal(browserFinal.failure, undefined)
assert.equal(browserFinal.samples.length, 2)
for (const sample of browserFinal.samples) {
  assert(sample.passed)
  for (const name of ['arm-low-presence', 'arm-invalid-presence', 'leg-low-presence']) {
    const state = sample.stages.find((stage) => stage.name === name)
    assert(state && !state.lastAccepted)
    assert.deepEqual(state.state.feedback.activeRegionIds, [])
    assert.equal(state.redPixels.left, 0)
  }
}
for (const key of ['camera', 'storage', 'external']) assert.equal(browserFinal[key], 0)
assert.equal(browserFinal.actualSDK, false)
assert.equal(browserFinal.actualParticipant, false)
console.log(JSON.stringify({ evidenceFiles: manifest.entries.length, byteVerified: true }))
