// Mechanical integrity only; NOT a replacement for actual runtime tests.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
const root = fileURLToPath(new URL('./', import.meta.url))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(readFileSync(`${root}manifest.json`))
for (const item of manifest.files) {
  assert(!item.file.includes('/') && !item.file.includes('..'))
  const compressed = readFileSync(root + item.file), raw = gunzipSync(compressed)
  assert.equal(sha(compressed), item.compressedSha256)
  assert.equal(sha(raw), item.sha256)
  assert.equal(raw.length, item.bytes)
}
for (const [name, expected] of Object.entries(manifest.sources)) {
  assert(!name.includes('..'))
  assert.equal(sha(readFileSync(new URL(`../../../frontend/${name}`, import.meta.url))), expected)
}
const report = name => JSON.parse(gunzipSync(readFileSync(root + name + '.gz')))
const units = report('full-accepted-units.json')
assert.equal(units.numFailedTests, 0)
assert.equal(units.numPassedTests, manifest.results.unit)
assert.equal(manifest.results.owner.expected, 6)
assert.equal(manifest.results.owner.unexpected, 0)
for (const label of ['accepted-units', 'accepted-build', 'accepted-lint', 'accepted-types', 'accepted-guard', 'final-python', 'owner-fourth', 'db-stop-final']) assert.equal(report(label+'.receipt.json').exit, 0)
const browser = report('browser-accepted.json')
assert.deepEqual(browser.sourcesBefore, browser.sourcesAfter)
assert.equal(browser.errors.length, 0)
assert.equal(browser.externalRequests, 0)
assert.equal(browser.results.length, 3)
assert(browser.results.every(item => item.passed))
assert.equal(manifest.actualPeople, 0)
assert.equal(manifest.physicalCameras, 0)
assert.equal(manifest.allStagesComplete, false)
console.log(JSON.stringify({ files: manifest.files.length, sources: Object.keys(manifest.sources).length, units: manifest.results.unit, owner: 6, worker: 3, allStagesComplete: false }))
