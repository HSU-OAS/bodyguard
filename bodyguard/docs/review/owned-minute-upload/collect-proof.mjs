// FR-R-01/NFR-08: preserve every selected failure/run; no DB dumps, raw samples or secrets.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { passingBrowser, passingJUnit, passingPublicBrowser } from './verify-results.mjs'
const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = realpathSync(fileURLToPath(new URL('.', import.meta.url)))
assert(root.endsWith('/BODYGUARD-minute-upload'))
const [scratch, first, final, records] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-minute-upload-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = value => createHash('sha256').update(value).digest('hex')
const pending = new Map(), artifacts = []
function collect(name, source) {
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size < 16 * 1024 * 1024)
  assert.equal(realpathSync(source), source)
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
  artifacts.push({ name, raw_sha256: digest(raw), public_sha256: digest(value), bytes: value.length })
}
for (const name of [
  'install.log', 'install-online.log', 'vitest-red.log', 'pg-init.log', 'pg-init-local.log',
  'binding-red.log', 'binding-red-local.log', 'binding-green.log', 'format-first.log',
  'format-second.log', 'gen-api.log', 'gen-api-local.log', 'typecheck-first.log',
  'vitest-first-green.log', 'build-first.log', 'browser-first.log', 'vitest-first-full.log',
  'biome-first-full.log', 'review-activation.log', 'api-first-full.log', 'ruff-first.log',
  'ruff-format-first.log', 'mypy-first.log', 'build-local.log', 'guard-local.log',
  'public-browser-first.log', 'timeout-review-red.log', 'format-review.log', 'review-green.log',
  'typecheck-review.log', 'browser-review.log', 'format-final.log', 'frontend-final.log',
  'frontend-final.xml', 'type-final.log', 'biome-final.log', 'build-final.log', 'guard-final.log',
  'api-final.log', 'api-final.xml', 'record-browser-final.log', 'public-browser-final.log', 'build-public-final.log',
  'collector-tests.log', 'collector-browser-dialect-red.log',
  'collector-tests-final.log', 'collector-browser-dialect-green.log', 'db-final-stop.log',
]) collect(name, join(scratch, name))
for (const [name, report, suite] of [
  ['browser-first-report.json', first, 'minuteupload'],
  ['browser-final-report.json', final, 'minuteupload'],
  ['record-browser-report.json', records, 'summaries'],
]) {
  assert(new RegExp('^test-results/' + suite + '-[0-9TZ]+/report\\.json$').test(report ?? ''))
  collect(name, join(root, 'bodyguard/frontend', report))
  passingBrowser(JSON.parse(pending.get(name).toString('utf8')), 4)
}
const screenshot = 'minuteupload-MU-W01-observ-6f3c4-n-white-blue-posture-record/owned-minute-record-detail.png'
collect('record-detail-first.png', join(root, 'bodyguard/frontend', first.slice(0, -11), screenshot))
collect('record-detail-final.png', join(root, 'bodyguard/frontend', final.slice(0, -11), screenshot))
collect('record-narrow-web.png', join(root, 'bodyguard/frontend', records.slice(0, -11),
  'summaries-SW-W01-실제-계정→자세-기록→상세·페이지·취소·삭제와-화이트-블루-웹/summary-narrow-web.png'))
passingJUnit(pending.get('frontend-final.xml').toString('utf8'), 682)
passingJUnit(pending.get('api-final.xml').toString('utf8'), 466)
passingPublicBrowser(pending.get('public-browser-final.log').toString('utf8'))
const sourceNames = [
  'backend/app/main.py', 'backend/app/summaries.py', 'backend/app/db.py',
  'backend/tests/test_summary_upload_binding.py', 'backend/tests/run_browser.py',
  'frontend/src/api/auth.ts', 'frontend/src/api/generated/types.gen.ts',
  'frontend/src/api/minuteSummaries.ts', 'frontend/src/api/minuteSummaries.test.ts',
  'frontend/src/auth.tsx', 'frontend/src/summary/minuteAggregation.ts',
  'frontend/src/summary/ownedMinuteUpload.ts', 'frontend/src/summary/ownedMinuteUpload.test.ts',
  'frontend/src/pages/MinuteSummaryPage.tsx', 'frontend/src/pages/MinuteSummaryPage.css',
  'frontend/src/pages/MinuteSummaryDeletion.tsx', 'frontend/src/index.css',
  'frontend/e2e/minuteupload.spec.ts', 'frontend/e2e/fixtures/minuteUploadProbe.ts',
  'frontend/e2e/fixtures/minuteUpload.vite.ts', 'frontend/e2e/summaries.spec.ts',
  'frontend/playwright.account.config.ts', 'frontend/scripts/check-selection-production.mjs',
  'docs/review/owned-minute-upload/verify-results.mjs',
  'docs/review/owned-minute-upload/verify-results.test.mjs',
  'docs/review/owned-minute-upload/collect-proof.mjs',
  'docs/review/minute-summary-web/verify-results.mjs',
  'docs/review/minute-summary-web/verify-results.test.mjs',
]
const sources = sourceNames.map(name => ({
  name: 'bodyguard/' + name, sha256: digest(readFileSync(join(root, 'bodyguard', name))),
}))
pending.set('artifacts.json', Buffer.from(JSON.stringify({
  baseline_commit: '37354aa4e074d86e862e5851352f917cc001b6fb',
  actualBodyCameraClinical: false, operationalChanges: false, sources, artifacts,
}, null, 2) + '\n'))
// All validations and every existing destination must pass before any artifact is published.
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
console.log(JSON.stringify({ sources: sources.length, artifacts: artifacts.length,
  frontend: 682, api: 466, privateBrowser: 4, recordBrowser: 4, publicBrowser: 8,
  actualBodyCameraClinical: false, operationalChanges: false }))
