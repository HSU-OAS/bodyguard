// S6.19: preserved identity and actual run receipts, not a browser rerun.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const here = fileURLToPath(new URL('.', import.meta.url)),
  repo = resolve(here, '../../../..')
const manifest = JSON.parse(readFileSync(resolve(here, 'manifest.json')))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
function read(name) {
  const item = manifest.artifacts[name],
    compressed = readFileSync(resolve(here, item.file))
  assert.equal(sha(compressed), item.compressedSha256)
  const bytes = gunzipSync(compressed)
  assert.equal(bytes.length, item.bytes)
  assert.equal(sha(bytes), item.sha256)
  return bytes
}
for (const name of Object.keys(manifest.artifacts)) read(name)
for (const [file, item] of Object.entries(manifest.source)) {
  assert.equal(sha(read(item.artifact)), item.sha256)
  if (process.argv.includes('--current'))
    assert.equal(sha(readFileSync(resolve(repo, file))), item.sha256)
}
const checks = JSON.parse(read('run/accepted-checks/report.json'))
assert(checks.pass && checks.commands.every((row) => row.status === 0))
const batch = JSON.parse(read('run/strict-batch.json'))
assert.equal(batch.runs.length, 6)
assert(batch.runs.every((row) => row.status === 0))
for (const row of batch.source) assert.equal(checks.source[row.path], row.sha256)
const browser = JSON.parse(read('run/browser-summary.json'))
assert.equal(browser.actualHuman, false)
assert.equal(browser.actualCamera, false)
assert.equal(browser.productPolicyApproved, false)
assert.equal(browser.runs.length, 14)
const final = browser.runs.filter((row) => row.label.endsWith('-strict-accepted'))
assert.equal(final.length, 6)
assert.equal(
  final.reduce((n, row) => n + row.stats.expected, 0),
  68,
)
for (const row of browser.runs) {
  const report = JSON.parse(read(`results/${row.label}/report.json`))
  assert.deepEqual(report.stats, row.stats)
  assert.equal(row.stats.skipped, 0)
  assert.equal(row.stats.flaky, 0)
  assert.equal(row.retry, 0)
  assert.equal(row.stats.unexpected, row.label === 'warm-male' ? 1 : 0)
  assert.equal(JSON.parse(read(`run/${row.label}.receipt.json`)).status, row.passed ? 0 : 1)
  assert.equal(sha(read(`browser/probe-${row.label}/probe.js`)), browser.bundle)
}
console.log(
  JSON.stringify({
    pass: true,
    current: process.argv.includes('--current'),
    artifacts: Object.keys(manifest.artifacts).length,
    source: Object.keys(manifest.source).length,
    finalPassed: 68,
    preservedFailure: 1,
  }),
)
