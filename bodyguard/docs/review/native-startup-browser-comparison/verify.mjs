// NFR-08/FR-M-07: evidence consistency is not a startup/clinical/release pass.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
const out = dirname(fileURLToPath(import.meta.url)),
  root = resolve(out, '../../../..')
const m = JSON.parse(readFileSync(resolve(out, 'manifest.json'))),
  sha = (b) => createHash('sha256').update(b).digest('hex')
const evidenceNames = new Set(m.files.map((file) => file.file))
assert.equal(evidenceNames.size, m.files.length, 'No duplicate evidence entries')
for (const file of m.files) {
  assert(/^evidence\/[a-zA-Z0-9_.-]+\.gz$/.test(file.file))
  const compressed = readFileSync(resolve(out, file.file))
  const bytes = gunzipSync(compressed)
  assert.equal(compressed.length, file.compressedBytes)
  assert.equal(sha(compressed), file.compressedSha256)
  assert.equal(bytes.length, file.bytes)
  assert.equal(sha(bytes), file.sha256)
}
const json = (p) => {
  assert(evidenceNames.has(p), 'Read only hashed, allow-listed evidence')
  return JSON.parse(gunzipSync(readFileSync(resolve(out, p))))
}
function reportCases(value) {
  return [
    ...(value.specs ?? []).flatMap((spec) =>
      (spec.tests ?? []).map((test) => ({
        title: spec.title,
        status: test.status,
        results: test.results,
      })),
    ),
    ...(value.suites ?? []).flatMap(reportCases),
  ]
}
assert.equal(m.base, '85885c4d1ed3bc019dea3112fe8beaa62d4fd88b')
assert.equal(m.testedHead, m.base)
assert.equal(m.originalContractBodiesGuardsBindingsUnchanged, true)
assert.deepEqual(
  m.sources.map((source) => source.path),
  ['bodyguard/frontend/e2e/nativehead.spec.ts'],
)
assert.deepEqual(
  m.runs.map((run) => run.label),
  [
    'chrome154-male',
    'chrome154-male-corrected',
    'chrome154-female',
    'chrome155-male',
    'chrome155-female',
    'chrome154-timed-male',
    'chrome154-timed-female',
    'chrome154-timed-male-fixed',
    'chrome154-timed-female-fixed',
  ],
)
for (const [index, run] of m.runs.entries()) {
  const report = json(run.report)
  const rows = report.suites.flatMap(reportCases)
  assert.deepEqual(report.stats, run.stats)
  assert.deepEqual(rows.map((row) => row.title).sort(), run.titles)
  assert.equal(run.environmentFailure, index === 0)
  assert.equal(run.timed, index >= 5)
  assert.equal(run.fullTiming, index >= 7)
  assert.equal(run.receiptStatus, index <= 1 ? 1 : 0)
  assert.equal(json('evidence/run-' + index + '-browser.receipt.json.gz').status, run.receiptStatus)
  assert.deepEqual(
    json('evidence/run-' + index + '-source-before.json.gz').sources,
    json('evidence/run-' + index + '-source-after.json.gz').sources,
  )
  if (index > 0) {
    assert(rows.every((row) => row.results.length === 1))
    assert.deepEqual(report.errors, [])
    assert.equal(run.stats.expected, index === 1 ? 12 : 13)
    assert.equal(run.stats.unexpected, index === 1 ? 1 : 0)
    const failed = rows.filter((row) => row.status !== 'expected')
    assert.equal(failed.length, index === 1 ? 1 : 0)
    if (index === 1) {
      assert.equal(
        failed[0].title,
        'male native neck captured aspect→presence→retirement→new generation',
      )
      assert(failed[0].results[0].errors[0].message.includes('Timeout 5000ms'))
    }
    const summaries = run.snapshots.filter((file) => file.kind === 'native-hands-summary.json')
    assert.equal(summaries.length, 13)
    assert.deepEqual(summaries.map((file) => file.title).sort(), run.titles)
  }
}
assert.equal(m.allStagesComplete, false)
assert.equal(m.startupRootCauseProven, false)
assert.equal(m.startupP2Resolved, false)
assert.equal(m.mergeEligible, false)
assert.equal(m.startupFailureReproduced, true)
assert.equal(m.actualHuman, false)
assert.equal(m.actualCamera, false)
assert.equal(m.productPolicyApproved, false)
assert.equal(m.dbStopped, true)
assert.deepEqual(m.untimed154, { passed: 25, failed: 1 })
assert.deepEqual(m.untimed155, { passed: 26, failed: 0 })
assert.deepEqual(m.timed154, { passed: 26, failed: 0 })
assert.equal(m.runs.length, 9)
assert.equal(m.runs[0].environmentFailure, true)
assert.equal(m.runs[0].stats.expected, 0)
assert.equal(m.runs[1].stats.unexpected, 1)
assert(m.runs[1].failures[0].errors[0].message.includes('Timeout 5000ms'))
for (const r of m.runs.slice(1)) {
  const report = json(r.report)
  assert.deepEqual(report.stats, r.stats)
  assert.equal(r.titles.length, 13)
  assert.equal(r.stats.skipped, 0)
  assert.equal(r.stats.flaky, 0)
  for (const f of r.snapshots.filter((f) => f.kind === 'native-hands-summary.json')) {
    const d = json(f.file)
    assert.equal(d.external, 0)
    assert.deepEqual(d.errors, [])
    const final =
      d.final ?? d.stages.find((s) => s.name === 'native-closed-before-public-record')?.snapshot
    if (d.final === null) {
      assert(/^(male|female) native start→stop→own interrupted record$/.test(f.title))
      assert(final?.closed && final.resources?.closed)
      assert.equal(final.session, 'ended')
    }
    assert(final.tracksEnded && final.detached && final.allFramesClosed)
    assert.equal(final.models, 0)
    assert.equal(final.nativeCalls, final.nativeCloses)
    assert.deepEqual(final.failures, [])
    assert.deepEqual(final.memory, final.baseline)
    if (r.timed && final.startupTiming === null) {
      assert(!r.fullTiming)
      assert(
        /^(male|female) native aggregate trunk→(required endpoints→fresh generation→own record|held result→logout cannot revive colour\/save)$/.test(
          f.title,
        ),
      )
    } else if (r.timed) {
      const t = final.startupTiming
      assert(t.closed && !t.invalid)
      assert(t.events.length > 0 && t.events.length <= 30)
      const counts = new Map()
      for (const e of t.events) {
        assert.deepEqual(Object.keys(e).sort(), ['endMs', 'stage', 'startMs'])
        assert(
          [
            'camera',
            'body-sdk',
            'face-sdk',
            'hands-sdk',
            'avatar',
            'render',
            'body',
            'face',
            'hands',
            'result',
          ].includes(e.stage),
        )
        assert(Number.isFinite(e.startMs) && e.startMs >= 0)
        assert(e.endMs === null || (Number.isFinite(e.endMs) && e.endMs >= e.startMs))
        counts.set(e.stage, (counts.get(e.stage) ?? 0) + 1)
      }
      assert([...counts.values()].every((n) => n <= 3))
    }
  }
}
for (const indices of [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
])
  assert.deepEqual(indices.flatMap((i) => m.runs[i].titles).sort(), m.originalCases)
for (const step of [
  'original-contract',
  'unit',
  'types',
  'biome',
  'assets',
  'build',
  'public-guard',
  'diff',
])
  assert.equal(json('evidence/check-' + step + '.receipt.json.gz').status, 0)
const unit = json('evidence/unit-results.json.gz')
assert.equal(unit.numFailedTests, 0)
assert.equal(unit.numPassedTests, 1411)
const js = m.publicAssets.find((f) => f.name.endsWith('.js')),
  css = m.publicAssets.find((f) => f.name.endsWith('.css'))
assert.equal(js.sha256, 'b5d4f81164c8d3c196e853b3404382bc15077986aa626cd0c3c72571b6325ac0')
assert.equal(css.sha256, '043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e')
assert.equal(
  m.glb.find((f) => f.name === 'male.glb').sha256,
  'cc85bcd449f3f31347e4f7174986d41e4aca3067990f5d8a2e6ba3a099171927',
)
assert.equal(
  m.glb.find((f) => f.name === 'female.glb').sha256,
  '27c10902aa377e995bdbc115ab773cf22f8ea38582c49820304a33ad7685f25a',
)
assert.equal(
  m.glb.find((f) => f.name === 'authored-fixture.json').sha256,
  'd91a93e39f09005097db58a50d27dd2db0e35382a19d755bd56515f9d4e2ddf6',
)
if (process.argv.includes('--current')) {
  for (const s of m.sources) {
    const b = readFileSync(resolve(root, s.path))
    assert.equal(sha(b), s.sha256)
    assert.equal(b.length, s.bytes)
  }
  const c = JSON.parse(
    execFileSync(
      'node',
      ['bodyguard/docs/review/native-neck-full-regression/compare-original.mjs'],
      { cwd: root, encoding: 'utf8' },
    ),
  )
  assert.deepEqual(c.expandedCases, m.originalCases)
  assert.equal(c.unchangedBodiesGuardsBindings, true)
}
console.log(
  JSON.stringify({
    evidenceFiles: m.files.length,
    sourceContractUnchanged: true,
    startupFailureReproduced: true,
    startupP2Resolved: false,
    mergeEligible: false,
    allStagesComplete: false,
  }),
)
