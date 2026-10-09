// Hash/contract verification is not a browser rerun or actual participant validation.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const out = dirname(fileURLToPath(import.meta.url)), root = resolve(out, '../../../..')
const sha = b => createHash('sha256').update(b).digest('hex')
const m = JSON.parse(readFileSync(resolve(out, 'manifest.json')))
const get = file => gunzipSync(readFileSync(resolve(out, file)))
for (const item of [...m.files, ...m.sources]) {
  assert(!item.file.includes('/') && !item.file.includes('..'))
  assert.equal(sha(readFileSync(resolve(out, item.file))), item.compressedSha256)
  const bytes = get(item.file)
  assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256)
  if (process.argv.includes('--current') && item.path)
    assert.equal(sha(readFileSync(resolve(root, item.path))), item.sha256)
}
assert.equal(m.base, 'e2360f6989c4454f0b320c70eb0578217dfacb77')
assert.equal(m.historical, '884700e3cebfce2b1c0c51fdca2cce4788e6dc4b')
assert.equal(m.actualHuman || m.actualCamera || m.productPolicyApproved || m.historicalFailureResolved || m.sameHistoricalEnvironment || m.rendererPreparationTested, false)
const old = JSON.parse(get('original-failed-summary.json.gz'))
assert.deepEqual([old.browser.finalTests, old.browser.passed, old.browser.failed], [26, 13, 13])
assert.equal(old.globalStartupP2StillOpen, true)
const audit = JSON.parse(get('local-original-contract.stdout.txt.gz'))
assert.equal(audit.unchangedBodiesGuardsBindings, true)
assert.equal(audit.historicalFailureResolved, false)
assert.equal(audit.expandedCases.length, 26)
if (process.argv.includes('--current')) {
  const currentAudit = JSON.parse(execFileSync(process.execPath, [resolve(out, 'compare-original.mjs')], { cwd: root }))
  assert.deepEqual(currentAudit, audit)
}
assert.equal(m.browser.length, 4)
const browsers = new Set(), covered = []
function specs(suites) {
  return suites.flatMap(suite => [...(suite.specs ?? []), ...specs(suite.suites ?? [])])
}
for (const [index, count] of [[0, 13], [1, 13], [2, 12], [3, 12]]) {
  const run = m.browser[index], report = JSON.parse(get(run.report)), neck = index < 2
  assert.equal(run.mode, neck ? 'neck' : 'default')
  assert.equal(report.stats.expected, count)
  assert.equal(report.stats.unexpected + report.stats.skipped + report.stats.flaky, 0)
  assert.deepEqual(report.errors, [])
  assert(report.config.projects.every(project => project.retries === 0))
  const actual = specs(report.suites).map(spec => {
    assert(spec.ok); assert.equal(spec.tests.length, 1)
    assert.equal(spec.tests[0].status, 'expected')
    assert(spec.tests[0].results.every(result => result.status === 'passed' && result.retry === 0))
    return spec.title
  }).sort()
  const expected = audit.expandedCases.filter(title => title.startsWith(run.gender + ' ') && (neck || !title.includes(' native neck ')))
  assert.deepEqual(actual, expected)
  if (neck) covered.push(...actual)
  const rows = run.rows.filter(row => row.kind === 'native-hands-summary.json')
  assert.equal(rows.length, count)
  for (const row of rows) {
    const value = JSON.parse(get(row.file))
    browsers.add(value.browser)
    assert.equal(value.external, 0); assert.deepEqual(value.errors, [])
    assert.equal(value.actualHuman || value.actualCamera || value.productPolicyApproved, false)
    const final = value.final ?? value.stages.find(stage => stage.name === 'native-closed-before-public-record')?.snapshot
    assert(final, 'No explicit cleanup before public record navigation')
    if (value.final === null) assert.equal(final.closed, true)
    assert.equal(final.neckConfigured, neck)
    assert.equal(final.neckObserverEmpty, true)
    assert.equal(final.renderPreparationConfigured, false)
    assert.equal(final.capturedImageFailures, 0)
    assert.equal(final.models, 0)
    assert.equal(final.tracksEnded && final.allFramesClosed, true)
    assert.equal(final.nativeCalls, final.nativeCloses)
    assert.deepEqual(final.memory, final.baseline)
    if (neck) {
      assert.equal(final.neckStatus, 'unavailable')
      assert.equal(final.neckCurrentGeneration, true)
      const running = value.stages.find(stage => stage.name === 'native-running')?.snapshot
      assert(running); assert(running.nativeCloses >= 3)
      assert.equal(running.neckConfigured, true); assert.equal(running.neckStatus, 'unavailable')
      if (actual.some(title => title.includes(' native neck ')) && value.stages.some(stage => stage.name === 'native-blank-no-observation')) {
        const stages = new Map(value.stages.map(stage => [stage.name, stage.snapshot]))
        for (const name of ['authored-positive-same-captured-aspect-not-clinical', 'fresh-generation-new-input-only']) {
          const state = stages.get(name); assert(state)
          assert.equal(state.neckStatus, 'available')
          assert.equal(state.neckMatchesAuthoredAspect && state.neckCurrentGeneration, true)
          assert.equal(state.verifiedMs, 0)
        }
        for (const name of ['low-presence-not-removed-in-native-handoff', 'generated-crop-no-old-observation', 'generated-multiple-no-old-observation', 'generated-none-no-old-observation', 'pause-removes-current-observation'])
          assert.equal(stages.get(name)?.neckStatus, 'unavailable')
        assert.equal(stages.get('fresh-generation-new-input-only').sessionGeneration, 2)
        assert.equal(value.posts, 0)
      }
    }
  }
}
assert.deepEqual(covered.sort(), audit.expandedCases)
assert.equal(browsers.size, 1)
assert(m.bundles.every(bundle => bundle.origins.length === 4))
const before = JSON.parse(readFileSync(resolve(root, 'bodyguard/docs/review/owned-render-preparation/manifest.json')))
for (const key of ['assets', 'publicAssets', 'sdkAssets', 'versions']) {
  const normalize = values => Array.isArray(values) ? [...values].sort((a, b) => a.file.localeCompare(b.file)) : values
  assert.deepEqual(normalize(m[key]), normalize(before[key]))
}
console.log(JSON.stringify({ files: m.files.length, sources: m.sources.length, neckCases: 26, defaultCases: 24, browser: [...browsers][0], current: process.argv.includes('--current'), historicalFailureResolved: false, verified: true }))
