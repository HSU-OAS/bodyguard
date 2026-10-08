// NFR-08: replay the preserved OFFLINE receipts; does not rerun native/human tests or close gates.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { analyzeNativeStartupRuns } from '../e2e/fixtures/nativeStartupAnalysis.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const folder = join(root, 'bodyguard/docs/review/native-startup-isolation/controlled-comparison')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
try {
  const manifestPath = join(folder, 'manifest.json')
  assert(statSync(manifestPath).size <= 128 * 1024)
  const manifest = JSON.parse(readFileSync(manifestPath))
  assert(Array.isArray(manifest) && manifest.length > 0 && manifest.length <= 128)
  const artifacts = new Map()
  let expanded = 0
  for (const entry of manifest) {
    assert(/^[a-z0-9][a-z0-9.-]{0,119}\.gz$/.test(entry.name) && !entry.name.includes('..'))
    assert(!artifacts.has(entry.name))
    assert(
      Number.isSafeInteger(entry.originalBytes) &&
        entry.originalBytes >= 0 &&
        entry.originalBytes <= 32 * 1024 * 1024,
    )
    expanded += entry.originalBytes
    assert(expanded <= 64 * 1024 * 1024)
    const path = join(folder, entry.name)
    assert(statSync(path).size === entry.bytes && entry.bytes <= 32 * 1024 * 1024)
    const compressed = readFileSync(path)
    assert.equal(sha(compressed), entry.sha256)
    const bytes = gunzipSync(compressed, { maxOutputLength: 32 * 1024 * 1024 })
    assert.equal(bytes.length, entry.originalBytes)
    assert.equal(sha(bytes), entry.originalSha256)
    artifacts.set(entry.name, bytes)
  }
  const bytes = (name) => {
    const value = artifacts.get(name)
    assert(value)
    return value
  }
  const json = (name) => JSON.parse(bytes(name))
  const input = json('analysis-input.json.gz')
  const saved = json('analysis-result.json.gz')
  const analysis = analyzeNativeStartupRuns(input)
  assert(analysis.valid)
  assert.deepEqual(analysis, saved.analysis)
  for (const row of input) {
    const receipt = json(`receipt-${row.id}.json.gz`)
    const beforeBytes = bytes(`source-before-${row.id}.json.gz`)
    const afterBytes = bytes(`source-after-${row.id}.json.gz`)
    const before = JSON.parse(beforeBytes)
    const report = json(`report-${row.id}.json.gz`)
    const summary = json(`summary-${row.id}.json.gz`)
    assert.equal(sha(beforeBytes), row.beforeSha)
    assert.equal(sha(afterBytes), row.afterSha)
    assert.equal(receipt.head, row.head)
    assert.equal(before.head, row.head)
    assert.equal(receipt.start, row.receiptStart)
    assert.equal(receipt.end, row.receiptEnd)
    assert.equal(receipt.status, row.exitCode)
    assert.equal(receipt.gender, row.gender)
    assert.equal(receipt.fakeCamera, row.fakeCamera)
    assert.equal(receipt.actualPeople, row.actualPeople)
    assert.equal(receipt.physicalCamera, row.physicalCamera)
    assert.equal(report.stats.startTime, row.reportStart)
    const specs = []
    const visit = (suite) => {
      specs.push(...(suite.specs ?? []))
      for (const child of suite.suites ?? []) visit(child)
    }
    for (const suite of report.suites) visit(suite)
    assert.equal(specs.length, 1)
    assert.equal(specs[0].title, `${row.gender} native first-start stage timing without raw input`)
    assert.equal(specs[0].tests.length, 1)
    assert.equal(specs[0].tests[0].timeout, row.caseTimeoutMs)
    assert.equal(specs[0].tests[0].results.length, 1)
    assert.equal(specs[0].tests[0].results[0].retry, row.retries)
    assert.deepEqual(
      Object.fromEntries(
        ['expected', 'unexpected', 'skipped', 'flaky'].map((key) => [key, report.stats[key]]),
      ),
      row.stats,
    )
    assert.equal(summary.browser, row.browser)
    assert.deepEqual(summary.final.startupTiming, row.timing)
    assert.equal(sha(bytes('assets.json.gz')), row.assetsSha)
    const sources = Object.entries(before.sources)
    assert(sources.length > 0 && sources.length <= 500)
    const tracked = execFileSync(
      'git',
      [
        'ls-tree',
        '-r',
        '--name-only',
        row.head,
        '--',
        'bodyguard/frontend/src',
        'bodyguard/frontend/e2e',
        'bodyguard/backend/tests/run_browser.py',
      ],
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
    assert.deepEqual(Object.keys(before.sources).sort(), tracked.sort())
    for (const [path, digest] of sources) {
      assert(
        /^bodyguard\/(?:frontend\/(?:src|e2e)\/[a-zA-Z0-9_./-]+|backend\/tests\/run_browser\.py)$/.test(
          path,
        ),
      )
      assert(!path.split('/').includes('..'))
      assert.equal(sha(execFileSync('git', ['show', `${row.head}:${path}`], { cwd: root })), digest)
    }
  }
  const totals = { passed: 0, failed: 0, skipped: 0 }
  assert.deepEqual(saved.mandatory.reports.map((item) => item.label).sort(), [
    'final-neck-female',
    'final-neck-male',
    'regression-female',
    'regression-male',
  ])
  assert.equal(saved.mandatory.head, input.find((row) => row.variant === 'candidate').head)
  for (const item of saved.mandatory.reports) {
    const report = json(`mandatory-${item.label}.json.gz`)
    assert.deepEqual(report.stats, item.stats)
    totals.passed += report.stats.expected
    totals.failed += report.stats.unexpected
    totals.skipped += report.stats.skipped
  }
  assert.deepEqual(totals, saved.mandatory.totals)
  assert.deepEqual(totals, { passed: 13, failed: 13, skipped: 0 })
  assert.equal(saved.mandatory.retestsReplaceMandatory, false)
  assert.equal(saved.pr90RemainsDraft, true)
  assert.equal(saved.globalStartupP2StillOpen, true)
  assert.equal(saved.rootCauseEstablished, false)
  assert.equal(saved.allStagesComplete, false)
  console.log(
    JSON.stringify({
      analysis,
      mandatory: totals,
      originalHashesVerified: true,
      offlineReplayOnly: true,
    }),
  )
} catch {
  console.error('Native startup evidence verification failed')
  process.exitCode = 1
}
