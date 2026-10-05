// FR-N-03/NFR-08: owned bounded proof; originals retained, replacement rejected.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const target = realpathSync(fileURLToPath(new URL('.', import.meta.url)))
assert.equal(target, join(root, 'bodyguard/docs/review/notification-preferences-web'))
const scratch = process.argv[2]
const browser = process.argv[3]
assert(root.endsWith('/BODYGUARD-notification-preferences-web'))
assert(/^\/private\/tmp\/bodyguard-notification-web-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(browser?.startsWith(join(root, 'bodyguard/frontend/test-results/notifications-')) && /notifications-\d{8}T\d{12}Z$/.test(browser))
assert.equal(realpathSync(browser), browser)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const artifacts = []
function read(path) {
  const stat = lstatSync(path)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size < 2 * 1024 * 1024)
  assert.equal(realpathSync(path), path)
  return readFileSync(path)
}
function save(name, bytes) {
  const path = join(target, name)
  try {
    const stat = lstatSync(path)
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1)
    assert(readFileSync(path).equals(bytes), 'Preserve previous proof')
  } catch (error) { if (error.code !== 'ENOENT') throw error; writeFileSync(path, bytes, { flag: 'wx' }) }
}
function copy(path, name, binary = false) {
  const raw = read(path)
  const bytes = binary ? raw : Buffer.from(raw.toString('utf8').replaceAll(root, '[workspace]').replaceAll('MacBook-Air.local', 'local-test-host').replaceAll(/\/private\/tmp\/bodyguard-[A-Za-z-]+[./][A-Za-z0-9.-]+/g, '[owned-test-scratch]').split('\n').map((line) => line.trimEnd()).join('\n'))
  save(name, bytes); artifacts.push({ name, raw_sha256: hash(raw), public_sha256: hash(bytes) })
}
for (const name of ['dom-red.xml', 'initial-green.xml', 'review-green.xml', 'full-frontend.xml', 'integrated-frontend.xml', 'focus-guard-unit.xml', 'full-backend.xml', 'full-backend.stdout', 'install.stdout', 'browser-first.stdout', 'browser-review.stdout', 'browser-frame.stdout', 'browser-timing.stdout', 'browser-focus-guard.stdout', 'browser-phase-probe.stdout', 'browser-unmarked.stdout', 'browser-final.stdout', 'backend-ruff.stdout', 'backend-format.stdout', 'backend-mypy.stdout', 'final-frontend.xml', 'final-types.stdout', 'final-check.stdout', 'final-build.stdout', 'production-guard.stdout']) copy(join(scratch, name), name)
copy(join(browser, 'report.json'), 'browser-final-report.json')
const expected = ['notifications-desktop.png', 'notifications-saved.png', 'notifications-920.png', 'notifications-css-zoom-200.png', 'notifications-uncertain.png', 'notifications-account-rebound.png', 'notifications-loading.png', 'notifications-read-error.png', 'notifications-validation.png']
for (const name of expected) {
  const candidates = readdirSync(browser).filter((dir) => dir !== 'report.json' && lstatSync(join(browser, dir)).isDirectory()).map((dir) => join(browser, dir, name)).filter((path) => { try { return lstatSync(path).isFile() } catch { return false } })
  assert.equal(candidates.length, 1, name); copy(candidates[0], name, true)
}
assert.match(readFileSync(join(target, 'final-frontend.xml'), 'utf8'), /failures="0" errors="0"/)
assert.match(readFileSync(join(target, 'full-backend.xml'), 'utf8'), /errors="0" failures="0" skipped="0" tests="321"/)
const report = JSON.parse(readFileSync(join(target, 'browser-final-report.json'), 'utf8'))
assert.equal(report.stats.expected, 4); assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0)
const sources = ['bodyguard/frontend/src/App.tsx', 'bodyguard/frontend/src/auth.tsx', 'bodyguard/frontend/src/index.css', 'bodyguard/frontend/src/pages/MemberPage.tsx', 'bodyguard/frontend/src/pages/NotificationPreferencesPage.tsx', 'bodyguard/frontend/src/pages/NotificationPreferencesPage.css', 'bodyguard/frontend/src/pages/NotificationPreferencesPage.test.tsx', 'bodyguard/frontend/src/api/notificationPreferences.ts', 'bodyguard/frontend/src/api/notificationPreferences.test.ts', 'bodyguard/frontend/src/api/generated/types.gen.ts', 'bodyguard/frontend/e2e/notifications.spec.ts', 'bodyguard/frontend/playwright.account.config.ts', 'bodyguard/backend/tests/run_browser.py', 'bodyguard/backend/app/notification_preferences.py', 'bodyguard/backend/app/db.py', 'bodyguard/backend/app/main.py', 'bodyguard/backend/app/readiness.py'].map((name) => ({ name, sha256: hash(read(join(root, name))) }))
save('artifacts.json', Buffer.from(`${JSON.stringify({ actual_production_chrome_http_postgresql: true, synthetic_mail_and_faults: true, actual_alert_or_exercise: false, operational_migration_deployment_approved: false, artifacts, sources }, null, 2)}\n`))
console.log(JSON.stringify({ artifacts: artifacts.length, sources: sources.length }))
