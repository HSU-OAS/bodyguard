// FR-R-03/NFR-07/08: selected failures and real functional evidence, never trace cookies.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fstatSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { passingBrowser, passingJUnit } from '../owned-minute-upload/verify-results.mjs'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const reviewRoot = realpathSync(fileURLToPath(new URL('.', import.meta.url)))
assert(root.endsWith('/BODYGUARD-record-dashboard'))
const args = process.argv.slice(2)
const incomplete = args[0] === '--incomplete'
if (incomplete) args.shift()
assert.equal(args.length, 4, 'scratch, dashboard report, records report, public report required')
const [scratch, final, records, publicReport] = args
assert(/^test-results\/dashboard-[0-9TZ]+\/report\.json$/.test(final))
assert(/^\/private\/tmp\/bodyguard-record-dashboard-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = value => createHash('sha256').update(value).digest('hex')
const activeOutputs = [fstatSync(1), fstatSync(2)].filter(stat => stat.isFile())
const pending = new Map(), artifacts = [], checks = []
function check(name, verify) {
  try { verify(); checks.push({ name, passed: true }) }
  catch (error) {
    if (!incomplete) throw error
    assert(error instanceof assert.AssertionError, 'Unexpected evidence error')
    checks.push({ name, passed: false, reason: error.message.slice(0, 400) })
  }
}
function collect(name, source) {
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size < 16 * 1024 * 1024)
  assert.equal(realpathSync(source), source)
  assert(!activeOutputs.some(output => output.dev === stat.dev && output.ino === stat.ino),
    'Refuse a still-open publication output as evidence')
  const raw = readFileSync(source)
  const value = name.endsWith('.png') ? raw : Buffer.from(raw.toString('utf8')
    .replaceAll(root, '[workspace]')
    .replaceAll(/\/Applications\/[^\n"<>]*\/BODYGUARD-account-web\/bodyguard\/backend\/\.venv/g, '[pinned-backend-venv]')
    .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"')
    .replaceAll(/\/private\/tmp\/bodyguard-[A-Za-z0-9-]+\.[A-Za-z0-9_-]+/g, '[owned-private-scratch]')
    .replaceAll(/\u001b\[[0-9;]*m/g, '')
    .split('\n').map(line => line.trimEnd()).join('\n').replace(/\n+$/, '\n'))
  assert(!pending.has(name))
  pending.set(name, value)
  artifacts.push({ name, raw_source: source.startsWith(scratch + '/')
    ? '[scratch]/' + source.slice(scratch.length + 1) : source.slice(root.length + 1),
    raw_sha256: digest(raw), public_sha256: digest(value), bytes: value.length })
}
// Preserve old failures and later reruns alike. Diff/trace/session files are excluded.
for (const name of readdirSync(scratch).filter(name => /^[a-z0-9-]+\.(log|xml)$/.test(name)).sort()) {
  const stat = lstatSync(join(scratch, name))
  if (!activeOutputs.some(output => output.dev === stat.dev && output.ino === stat.ino))
    collect(name, join(scratch, name))
}
const previous = [
  ['chrome-first-report.json', 'dashboard-20261006T072042434871Z'],
  ['chrome-diagnostic-report.json', 'dashboard-20261006T072445417236Z'],
  ['chrome-foreground-report.json', 'dashboard-20261006T072853752079Z'],
  ['chrome-baseline-diagnostic-report.json', 'summaries-20261006T073137935170Z'],
  ['chrome-body-diagnostic-report.json', 'dashboard-20261006T073444670984Z'],
  ['chrome-format-reuse-report.json', 'dashboard-20261006T073855299366Z'],
  ['chrome-no-trace-report.json', 'dashboard-20261006T074614865688Z'],
  ['chrome-first-passing-report.json', 'dashboard-20261006T074814536969Z'],
  ['record-headless-failed-report.json', 'summaries-20261006T122446818710Z'],
  ['record-headed-failed-report.json', 'summaries-20261006T123930868983Z'],
]
for (const [name, folder] of previous)
  collect(name, join(root, 'bodyguard/frontend/test-results', folder, 'report.json'))
collect('main-baseline-public-report.json', join(scratch, 'main-baseline-public-report.json'))
for (const [name, report, suite, count] of [
  ['chrome-final-report.json', final, 'dashboard', 2],
  ['record-browser-report.json', records, 'summaries', 4],
]) {
  assert(new RegExp('^test-results/' + suite + '-[0-9TZ]+/report\\.json$').test(report ?? ''))
  collect(name, join(root, 'bodyguard/frontend', report))
  check(name, () => passingBrowser(JSON.parse(pending.get(name).toString('utf8')), count))
}
assert(/^test-results\/(?:selection-[0-9TZ]+\/report|selection-report)\.json$/.test(publicReport))
collect('public-browser-report.json', join(root, 'bodyguard/frontend', publicReport))
check('public-browser-report.json', () => passingBrowser(JSON.parse(pending.get('public-browser-report.json').toString('utf8')), 8))
const flow = 'dashboard-DW01-실제-저장→전체-하루-한-주-집계→기록-관리-복귀와-의료-화이트블루-웹'
const faults = 'dashboard-DW02-실제-빈-기간-잘못된-URL-503-복구-요청-시-계정-권위-경계'
for (const [name, folder] of [
  ['desktop', flow], ['week', flow], ['notebook', flow], ['narrow-web', flow], ['zoom', flow],
  ['empty', faults], ['error', faults],
]) collect('dashboard-' + name + '.png', join(root, 'bodyguard/frontend', final.slice(0, -11),
  folder, 'dashboard-' + name + '.png'))
check('frontend-ratio-final.xml', () => passingJUnit(pending.get('frontend-ratio-final.xml').toString('utf8'), 738))
check('api-ratio-final.xml', () => passingJUnit(pending.get('api-ratio-final.xml').toString('utf8'), 492))
const allRequiredTestsPassed = checks.every(item => item.passed)
if (incomplete) assert(!allRequiredTestsPassed, 'Do not label a fully passing test bundle incomplete')
const sourceNames = [
  'backend/app/dashboard.py', 'backend/app/summaries.py', 'backend/app/db.py',
  'backend/app/main.py', 'backend/tests/test_dashboard.py', 'backend/tests/run_browser.py',
  'frontend/src/api/dashboard.ts', 'frontend/src/api/dashboard.test.ts',
  'frontend/src/api/auth.ts', 'frontend/src/auth.tsx', 'frontend/src/api/generated/types.gen.ts',
  'frontend/src/api/generated/index.ts', 'frontend/src/pages/RecordDashboardPage.tsx',
  'frontend/src/pages/RecordDashboardPage.test.tsx', 'frontend/src/pages/RecordDashboardPage.css',
  'frontend/src/App.tsx', 'frontend/src/pages/MemberPage.tsx', 'frontend/src/index.css',
  'frontend/e2e/dashboard.spec.ts', 'frontend/e2e/summaries.spec.ts',
  'frontend/playwright.account.config.ts', 'frontend/scripts/check-selection-production.mjs',
  'frontend/playwright.selection.config.ts', 'frontend/scripts/test-selection-browser.mjs',
  'docs/review/record-dashboard/collect-proof.mjs',
  'docs/review/owned-minute-upload/verify-results.mjs',
  'docs/review/owned-minute-upload/verify-results.test.mjs',
  'docs/review/minute-summary-web/verify-results.mjs',
  'docs/review/minute-summary-web/verify-results.test.mjs',
]
const sources = sourceNames.map(name => ({ name: 'bodyguard/' + name,
  sha256: digest(readFileSync(join(root, 'bodyguard', name))) }))
const manifest = Buffer.from(JSON.stringify({
  baseline_commit: '991ed2b33a1abc6158b3a177f8431a104c476ba0',
  status: incomplete ? 'incomplete-evidence' : 'passing-test-evidence',
  allRequiredTestsPassed, storyComplete: false, mergeAuthorizedByThisBundle: false,
  checks, actualBodyCameraClinical: false, operationalChanges: false, sources, artifacts,
}, null, 2) + '\n')
// Content-addressed revisions preserve even failed publication audits. A new
// evidence snapshot never overwrites one from the same Chrome execution.
const snapshot = final.split('/')[1] + '-' + digest(manifest).slice(0, 12)
const destination = join(reviewRoot, 'runs', snapshot)
pending.set('artifacts.json', manifest)
// Validate all inputs and destinations first, then publish without replacing prior evidence.
mkdirSync(join(reviewRoot, 'runs'), { recursive: true })
assert.equal(realpathSync(join(reviewRoot, 'runs')), join(reviewRoot, 'runs'))
mkdirSync(destination, { recursive: true })
assert.equal(realpathSync(destination), destination)
for (const [name, value] of pending) {
  try {
    const stat = lstatSync(join(destination, name))
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1)
    assert(readFileSync(join(destination, name)).equals(value), 'Never overwrite prior evidence')
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}
for (const [name, value] of pending) {
  try { lstatSync(join(destination, name)) }
  catch (error) { if (error.code === 'ENOENT') writeFileSync(join(destination, name), value, { flag: 'wx' }); else throw error }
}
console.log(JSON.stringify({ snapshot, sources: sources.length, artifacts: artifacts.length,
  allRequiredTestsPassed, storyComplete: false, checks,
  actualBodyCameraClinical: false, operationalChanges: false }))
// Publishing failures is useful evidence, never a successful quality gate.
if (incomplete) process.exitCode = 2
