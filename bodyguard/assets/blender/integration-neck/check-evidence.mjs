// FR-A-02/03/08: byte/report audit only, not a Blender/browser rerun.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const proof = join(root, 'docs/review/avatar-neck-integration')
const read = (file) => JSON.parse(gunzipSync(readFileSync(join(proof, file))))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(readFileSync(join(proof, 'manifest.json')))
assert.equal(manifest.entries.length, 137)
for (const entry of manifest.entries) {
  assert(!entry.file.includes('..') && !entry.file.startsWith('/'))
  const bytes = readFileSync(join(proof, entry.file))
  assert.equal(bytes.length, entry.bytes)
  assert.equal(sha(bytes), entry.sha256)
  assert.equal(sha(entry.compressed ? gunzipSync(bytes) : bytes), entry.raw_sha256)
}
for (const key of [
  'appearance_approved',
  'final_avatar_adopted',
  'stages_1_to_6_complete',
  'actual_camera',
])
  assert.equal(manifest[key], false)
assert(read('logs/author.json.gz').passed && read('logs/reopen.json.gz').independent_reopen)
for (const name of ['unchanged-negative', 'overwrite-negative'])
  assert.equal(read(`logs/${name}.json.gz`).passed, false)
for (const name of ['source-qa', 'roundtrip-qa', 'source-render-qa', 'roundtrip-render-qa']) {
  const report = read(`${name}/deformation-report.json.gz`)
  assert(report.passed && report.failures.length === 0)
  assert.equal(report.checks.length, 121)
}
const browser = read('browser/browser-reviewed.json.gz')
assert.equal(browser.samples.length, 2)
assert(browser.samples.every((sample) => sample.passed && sample.closed))
assert.deepEqual(browser.sourceBefore, browser.sourceAfter)
for (const [file, expected] of Object.entries(browser.sourceBefore))
  assert.equal(sha(readFileSync(join(root, 'frontend', file))), expected)
for (const [gender, expected] of Object.entries(browser.assetHashes))
  assert.equal(sha(readFileSync(join(proof, 'glb', `bodyguard-${gender}-candidate.glb`))), expected)
assert.deepEqual(browser.boundary, { external: 0, camera: 0, errors: [] })
console.log(
  JSON.stringify({
    artifacts: 137,
    recorded_technical_checks: '121 x 4',
    recorded_browser_samples: 2,
    appearance_approved: false,
    actual_camera: false,
    verification_rerun: false,
  }),
)
