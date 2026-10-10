// S6.18: artifact/source identity only; not a browser rerun or release approval.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const here = fileURLToPath(new URL('.', import.meta.url)), repo = resolve(here, '../../../..')
const manifest = JSON.parse(readFileSync(resolve(here, 'manifest.json')))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (name) => {
  const item = manifest.artifacts[name], compressed = readFileSync(resolve(here, item.file))
  assert.equal(sha(compressed), item.compressedSha256)
  const bytes = gunzipSync(compressed)
  assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256)
  return bytes
}
for (const name of Object.keys(manifest.artifacts)) read(name)
for (const [file, item] of Object.entries(manifest.source)) {
  assert.equal(sha(read(item.artifact)), item.sha256)
  if (process.argv.includes('--current')) assert.equal(sha(readFileSync(resolve(repo, file))), item.sha256)
}
const checks = JSON.parse(read('run/accepted-checks/report.json'))
assert(checks.pass && checks.commands.every((command) => command.status === 0))
const finalProbe = sha(read('run/probe/probe.js'))
assert.equal(sha(read('run/rebuilt-probe/probe.js')), finalProbe)
for (const label of ['chrome-154', 'chrome-155']) for (const mode of ['normal', 'cancel']) {
  const report = JSON.parse(read(`run/${label}-${mode}-accepted.json`))
  assert.equal(report.probe, finalProbe)
  assert.equal(report.results.length, mode === 'normal' ? 8 : 2)
  assert(report.results.every((item) => item.passed))
  assert.equal(report.externalRequests, 0); assert.deepEqual(report.pageErrors, [])
  for (const item of report.results) {
    assert(item.cleanup.tracksEnded && item.final.closed)
    assert.equal(item.cleanup.frames, item.cleanup.closes)
    assert.equal(item.cleanup.storageKeys, 0)
    assert.equal(item.cleanup.terminations, item.cleanup.workers)
    if (mode === 'normal') {
      assert(item.thirdWithinWindow)
      assert.deepEqual(item.ready.atReady, {deliveries: 0, renders: 0})
    } else {
      assert.equal(item.final.failure, 'cancelled')
      assert.equal(item.final.deliveries, 0); assert.equal(item.final.renders, 0)
    }
  }
}
console.log(JSON.stringify({pass: true, current: process.argv.includes('--current'), artifacts: Object.keys(manifest.artifacts).length, source: Object.keys(manifest.source).length}))
