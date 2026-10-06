// FR-R-01/NFR-08: preserve actual red/green evidence; never copy DB archives or real body data.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = realpathSync(fileURLToPath(new URL('.', import.meta.url)))
assert(root.endsWith('/BODYGUARD-minute-summaries-api'))
const scratch = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-summary-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = (value) => createHash('sha256').update(value).digest('hex')
function save(name, value) {
  const target = join(destination, name)
  let stat
  try { stat = lstatSync(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (stat) {
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1)
    assert(readFileSync(target).equals(value), 'Preserve prior evidence; never overwrite')
  } else writeFileSync(target, value, { flag: 'wx' })
}
const artifacts = []
function collect(name, source) {
  const stat = lstatSync(source)
  const maximum = name.endsWith('.gz') ? 16 * 1024 * 1024 : 2 * 1024 * 1024
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size < maximum)
  assert.equal(realpathSync(source), source)
  const raw = readFileSync(source)
  const normalized = name.endsWith('.png') ? raw : Buffer.from(raw.toString('utf8')
    .replaceAll(root, '[workspace]')
    .replaceAll(/\/Applications\/[^\n"<>]*\/BODYGUARD-account-web\/bodyguard\/backend\/\.venv/g, '[pinned-backend-venv]')
    .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"')
    .replaceAll(/\/private\/tmp\/bodyguard-[A-Za-z0-9-]+\.[A-Za-z0-9_-]+/g, '[owned-private-scratch]')
    .replaceAll(/\u001b\[[0-9;]*m/g, '')
    .split('\n').map((line) => line.trimEnd()).join('\n').replace(/\n+$/, '\n'))
  const value = name.endsWith('.gz') ? gzipSync(normalized) : normalized
  save(name, value)
  artifacts.push({ name, raw_sha256: digest(raw), public_sha256: digest(value), bytes: value.length })
}
for (const name of [
  'red.xml', 'red.log', 'green-initial.xml', 'green-initial.log',
  'summary1.xml', 'summary1.log', 'summary-backup2.xml', 'summary-backup2.log',
  'api-full1.xml', 'api-full1.log', 'focused-final.xml', 'focused-final.log',
  'api-final.xml', 'api-final.log', 'union-red.xml', 'union-red.log',
  'api-final2.xml', 'api-final2.log', 'native-summary.json', 'native-summary-final.json',
  'openapi-errors-red.xml', 'openapi-errors-red.log', 'api-final4.xml', 'api-final4.log',
  'ruff1.log', 'ruff2.log', 'ruff-final3.log', 'format-final3.log', 'mypy-final3.log',
  'ruff-final4.log', 'format-final4.log', 'mypy-final4.log',
  'pnpm-install.log', 'pnpm-install-online.log', 'gen-api.log', 'gen-api-final.log',
  'frontend.log', 'typecheck.log', 'biome.log', 'build.log', 'build2.log',
  'guard.log', 'public-browser.log', 'notifications-browser.log',
  'frontend-final.log', 'typecheck-final.log', 'biome-final.log', 'build-final.log', 'guard-final.log',
]) collect(name, join(scratch, name))
for (const name of ['api-final3.xml', 'api-final3.log']) collect(name + '.gz', join(scratch, name))
collect('production-start.png', join(root, 'bodyguard/frontend/test-results/selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png'))
const report = process.argv[3]
assert(/^test-results\/notifications-[0-9TZ]+\/report\.json$/.test(report ?? ''))
collect('notifications-report.json', join(root, 'bodyguard/frontend', report))
const notifications = JSON.parse(readFileSync(join(destination, 'notifications-report.json'), 'utf8'))
assert.equal(notifications.stats.expected, 4)
assert.equal(notifications.stats.unexpected, 0)
assert.equal(notifications.stats.skipped, 0)
const screenshot = process.argv[4]
assert(screenshot?.startsWith(report.slice(0, -'report.json'.length)))
assert(!screenshot.includes('..') && screenshot.endsWith('/notifications-saved.png'))
collect('notifications-saved.png', join(root, 'bodyguard/frontend', screenshot))
const final = readFileSync(join(destination, 'api-final4.xml'), 'utf8')
assert.match(final, /tests="458"/)
for (const name of ['failures', 'errors', 'skipped']) assert.match(final, new RegExp(`${name}="0"`))
assert.match(readFileSync(join(destination, 'red.xml'), 'utf8'), /failures="1"/)
assert.match(readFileSync(join(destination, 'union-red.xml'), 'utf8'), /failures="2"/)
assert.match(readFileSync(join(destination, 'frontend-final.log'), 'utf8'), /590 passed/)
// The name records the attempted red check. Existing global ErrorOut responses already pass.
assert.match(readFileSync(join(destination, 'openapi-errors-red.xml'), 'utf8'), /failures="0"/)
assert.match(readFileSync(join(destination, 'public-browser.log'), 'utf8'), /8 passed/)
const native = JSON.parse(readFileSync(join(destination, 'native-summary-final.json'), 'utf8'))
for (const name of ['proof_completed', 'owned_servers_stopped', 'minute_summaries_restored', 'minute_summary_owner_isolation_restored', 'minute_summary_constraints_restored', 'baseline_history_and_owner_restored', 'database_constraints_preserved', 'corrupt_archive_rejected', 'restore_did_not_mutate_source']) assert.equal(native[name], true)
assert.equal(native.operational_restore_approved, false)
for (const kind of ['deletion', 'revocation', 'credentials']) assert.equal(native[`post_snapshot_${kind}_replay_observed`], true)
const sources = [
  'backend/app/summaries.py', 'backend/app/db.py', 'backend/app/main.py', 'backend/app/readiness.py',
  'backend/migrations/versions/0008_minute_summaries.py',
  'backend/tests/test_summaries.py', 'backend/tests/test_summary_races.py', 'backend/tests/minute_fixture.mjs',
  'backend/tests/backup_restore_proof.py', 'backend/tests/test_backup_restore_proof.py',
  'backend/tests/test_auth.py', 'backend/tests/test_google_auth.py', 'backend/tests/test_password_reset.py',
  'backend/tests/test_account_withdrawal.py', 'backend/tests/test_records_integrity.py',
  'backend/tests/test_notification_preferences.py', 'backend/tests/test_baselines.py', 'backend/tests/test_baseline_races.py',
  'frontend/src/api/generated/index.ts', 'frontend/src/api/generated/types.gen.ts',
].map((name) => ({ name: `bodyguard/${name}`, sha256: digest(readFileSync(join(root, 'bodyguard', name))) }))
save('artifacts.json', Buffer.from(JSON.stringify({ baseline_commit: 'fccd5c4a46ee2f7695b502fb987fed091124e95e', sources, artifacts }, null, 2) + '\n'))
console.log(JSON.stringify({ sources: sources.length, artifacts: artifacts.length, api: 458, frontend: 590, public_browser: 8, notifications_browser: 4, operational_restore_approved: false }))
