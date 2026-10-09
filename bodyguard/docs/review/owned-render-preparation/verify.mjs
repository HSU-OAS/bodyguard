// Hash verification is not browser execution or human validation.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
const out = dirname(fileURLToPath(import.meta.url)), root = resolve(out, '../../../..')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const m = JSON.parse(readFileSync(resolve(out, 'manifest.json')))
const get = (file) => gunzipSync(readFileSync(resolve(out, file)))
for (const item of [...m.files, ...m.sources]) {
  assert(!item.file.includes('/') && !item.file.includes('..'))
  assert.equal(sha(readFileSync(resolve(out, item.file))), item.compressedSha256)
  const b = get(item.file); assert.equal(b.length, item.bytes); assert.equal(sha(b), item.sha256)
  if (process.argv.includes('--current') && item.path) assert.equal(sha(readFileSync(resolve(root, item.path))), item.sha256)
}
assert.equal(m.base, 'c15608a5696349fe6b47e156382f9efd7e44fa0c')
assert.equal(m.actualHuman || m.actualCamera || m.productPolicyApproved || m.original26Passed, false)
const stats = m.browser.map(b => JSON.parse(get(b.report)).stats)
let preparedCancellations = 0
assert.equal(stats.length, 6)
assert.equal(stats[0].expected + stats[0].unexpected, 0) // Selector failed before execution.
assert.equal(stats[1].expected, 12); assert.equal(stats[1].unexpected, 2)
for (const [index, count] of [[2, 14], [3, 14], [4, 12], [5, 12]]) {
  assert.equal(stats[index].expected, count); assert.equal(stats[index].unexpected + stats[index].skipped + stats[index].flaky, 0)
  const report = JSON.parse(get(m.browser[index].report))
  assert.deepEqual(report.errors, []); assert(report.config.projects.every(p => p.retries === 0))
  for (const row of m.browser[index].rows.filter(r => r.kind === 'native-hands-summary.json')) {
    const v = JSON.parse(get(row.file)); assert.equal(v.external, 0); assert.deepEqual(v.errors, [])
    assert.equal(v.actualHuman || v.actualCamera || v.productPolicyApproved, false)
    const final = v.final ?? v.stages.find(s => s.name === 'native-closed-before-public-record')?.snapshot
    assert(final, 'Missing explicit cleanup evidence before record-page navigation')
    if (v.final === null) assert.equal(final.closed, true)
    assert.equal(final.models, 0); assert.equal(final.tracksEnded && final.allFramesClosed, true)
    assert.deepEqual(final.memory, final.baseline)
    assert.equal(final.renderPreparationConfigured, index <= 3)
    if (v.stages.some(s => s.name === 'actual-compile-started-test-barrier-not-gpu-hang')) {
      preparedCancellations++
      const last = v.stages.at(-1).snapshot
      assert.equal(last.owned, false); assert.equal(v.posts, 0)
      for (const key of ['rendererReady', 'gpuPreparationDraws', 'renderFrames', 'nativeCalls', 'verifiedMs']) assert.equal(last[key], 0)
    }
  }
}
assert.equal(preparedCancellations, 4)
assert(m.publicAssets.some(a => a.bytes === 355151 && a.sha256 === 'b5d4f81164c8d3c196e853b3404382bc15077986aa626cd0c3c72571b6325ac0'))
assert(m.publicAssets.some(a => a.bytes === 31199 && a.sha256 === '043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e'))
assert.equal(m.sdkAssets.length, 11)
assert.equal(m.versions['@mediapipe/tasks-vision'], '1.0.1'); assert.equal(m.versions.three, '0.186.1')
assert.equal(m.assets.find(a => a.file === 'male.glb').sha256, 'cc85bcd449f3f31347e4f7174986d41e4aca3067990f5d8a2e6ba3a099171927')
assert.equal(m.assets.find(a => a.file === 'female.glb').sha256, '27c10902aa377e995bdbc115ab773cf22f8ea38582c49820304a33ad7685f25a')
assert.equal(m.assets.find(a => a.file === 'authored-fixture.json').sha256, 'd91a93e39f09005097db58a50d27dd2db0e35382a19d755bd56515f9d4e2ddf6')
console.log(JSON.stringify({ files: m.files.length, sources: m.sources.length, prepared: 28, default: 24, preservedFailures: 2, current: process.argv.includes('--current'), verified: true }))
