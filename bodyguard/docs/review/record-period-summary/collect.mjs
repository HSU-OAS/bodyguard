// S4.R10: archive existing executions, never run or manufacture a test result.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const proof = resolve(process.argv[2] ?? '')
assert.equal(proof, '/private/tmp/bodyguard-record-period.Z6gWvG')
const sha = (data) => createHash('sha256').update(data).digest('hex')
const rows = []
function save(name, data) {
  const path = join(here, name)
  mkdirSync(dirname(path), { recursive: true })
  if (existsSync(path)) assert.equal(sha(readFileSync(path)), sha(data), `Preserve ${name}`)
  else writeFileSync(path, data, { flag: 'wx' })
}
function archive(path, name, compressed = true) {
  const original = readFileSync(path)
  const stored = compressed ? gzipSync(original, { level: 9 }) : original
  save(name, stored)
  rows.push({ file: name, source: path, rawBytes: original.length, rawSha256: sha(original), bytes: stored.length, sha256: sha(stored) })
}
const logs = [
  'dom-red', 'dom-first', 'dom-second', 'dom-related', 'dom-full',
  'dom-related-final', 'dom-full-final', 'biome', 'biome-final', 'build', 'build-final',
  'production-guard', 'production-guard-final', 'production-guard-afterbuild',
  'initdb', 'initdb-utf8', 'initdb-utf8-escalated', 'native-first',
  'native-second', 'native-third', 'native-fourth', 'native-regression', 'owned-db-stop',
]
for (const name of logs) archive(join(proof, `${name}.log`), `evidence/${name}.log.gz`)
const sources = [
  'frontend/src/pages/RecordPeriodSummary.tsx', 'frontend/src/pages/RecordPeriodSummary.test.tsx',
  'frontend/src/pages/MinuteSummaryPage.tsx', 'frontend/src/pages/MinuteSummaryPage.css',
  'frontend/src/records/useOwnedDashboard.ts', 'frontend/src/api/dashboard.ts', 'frontend/src/auth.tsx',
  'frontend/e2e/summaries.spec.ts', 'frontend/playwright.account.config.ts',
  'frontend/package.json', 'frontend/pnpm-lock.yaml',
  'backend/tests/run_browser.py', 'backend/tests/conftest.py',
]
for (const source of sources) archive(join(root, source), `evidence/source-${source.replaceAll('/', '--')}.gz`)
const runs = [
  { id: 'summaries-20261011T151428301721Z', result: [2, 1] },
  { id: 'summaries-20261011T151545530438Z', result: [2, 1] },
  { id: 'summaries-20261011T151700030694Z', result: [3, 0] },
  { id: 'summaries-20261011T151734374389Z', result: [4, 0] },
]
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)])
}
function cases(suite) {
  return [...(suite.specs ?? []).flatMap((spec) => spec.tests), ...(suite.suites ?? []).flatMap(cases)]
}
for (const [index, run] of runs.entries()) {
  const directory = join(root, 'frontend/test-results', run.id)
  const path = join(directory, 'report.json')
  const report = JSON.parse(readFileSync(path, 'utf8'))
  assert.deepEqual([report.stats.expected, report.stats.unexpected], run.result)
  assert.equal(report.stats.skipped + report.stats.flaky, 0)
  const boundaries = cases(report).flatMap((test) => test.results.map((result) => {
    assert.equal(result.retry, 0)
    const attachment = result.attachments.find((item) => item.name === 'summary-boundaries.json')
    assert.ok(attachment?.body)
    const b = JSON.parse(Buffer.from(attachment.body, 'base64').toString())
    assert.equal(b.actualProductionChromeHttpSql, true)
    assert.equal(b.syntheticAggregatesMailFaults, true)
    assert.equal(b.actualPersonCameraClinical, false)
    assert.equal(b.camera, 0)
    assert.deepEqual([b.unexpected, b.errors, b.storage], [[], [], [0, 0]])
    return b
  }))
  assert.equal(boundaries.length, run.result[0] + run.result[1])
  run.stats = report.stats
  run.browser = boundaries[0].browser
  archive(path, `evidence/browser-${index + 2}-report.json.gz`)
  for (const asset of walk(directory).filter((p) => p.endsWith('.png') || p.endsWith('error-context.md'))) {
    const name = relative(directory, asset).replaceAll('/', '--')
    archive(asset, `evidence/browser-${index + 2}--${name}${asset.endsWith('.png') ? '' : '.gz'}`, !asset.endsWith('.png'))
    if (index === 2 && asset.endsWith('.png')) archive(asset, name.split('--').at(-1), false)
  }
}
const full = readFileSync(join(proof, 'dom-full-final.log'), 'utf8')
assert.match(full, /105 passed/)
assert.match(full, /1896 passed/)
assert.match(readFileSync(join(proof, 'dom-related-final.log'), 'utf8'), /130 passed/)
assert.match(readFileSync(join(proof, 'build-final.log'), 'utf8'), /built in/)
assert.match(readFileSync(join(proof, 'owned-db-stop.log'), 'utf8'), /server stopped/)
for (const db of ['/private/tmp/bodyguard-auth-test.AP2JKe', '/private/tmp/bodyguard-auth-test.KCGfE7']) {
  assert.ok(existsSync(join(db, 'data/PG_VERSION')))
  assert.equal(existsSync(join(db, 'data/postmaster.pid')), false)
}
const verification = {
  story: 'S4.R10', base: 'e7f513af8fae106cbaa69aab4065b3f311b121a3',
  relatedFrontend: 130, fullFrontend: 1896, files: 105, runs,
  actual: 'production Chrome / loopback FastAPI / PostgreSQL18.6 UTF8, synthetic accounts and records',
  notTested: ['people or camera/SDK judgment', 'final avatar', 'mail/OAuth providers', 'Docker/HTTPS/operations', 'global startup P2 cause', 'whole stages1–6 completion'],
  ownedDbStoppedDataPreserved: ['/private/tmp/bodyguard-auth-test.AP2JKe', '/private/tmp/bodyguard-auth-test.KCGfE7'],
}
save('verification.json', Buffer.from(`${JSON.stringify(verification, null, 2)}\n`))
rows.sort((a, b) => a.file.localeCompare(b.file))
save('manifest.json', Buffer.from(`${JSON.stringify(rows, null, 2)}\n`))
console.log(`Archived ${rows.length} original logs/sources/browser assets. Failure runs remain failures.`)
