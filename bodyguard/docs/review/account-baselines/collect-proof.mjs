// B08: adapted from minute-aggregation collector; preserve failures, never copy DB archives.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = realpathSync(fileURLToPath(new URL('.', import.meta.url)))
assert(root.endsWith('/BODYGUARD-account-baselines'))
assert.equal(destination, join(root, 'bodyguard/docs/review/account-baselines'))
const scratch = process.argv[2]
const phase = process.argv[3] ?? 'initial'
assert(['initial', 'integrated'].includes(phase))
assert(/^\/private\/tmp\/bodyguard-baselines-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = (value) => createHash('sha256').update(value).digest('hex')
function save(name, value) {
  const target = join(destination, name)
  let stat
  try { stat = lstatSync(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (stat) {
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1)
    assert(readFileSync(target).equals(value), 'Preserve original evidence')
  } else writeFileSync(target, value, { flag: 'wx' })
}
const artifacts = []
function collect(name, source) {
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size < 2 * 1024 * 1024)
  assert.equal(realpathSync(source), source)
  const raw = readFileSync(source)
  const value = name.endsWith('.png') ? raw : Buffer.from(raw.toString('utf8')
    .replaceAll(root, '[workspace]')
    .replaceAll(/\/Applications\/[^\n"<>]*\/BODYGUARD-account-web\/bodyguard\/backend\/\.venv/g, '[pinned-backend-venv]')
    .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"')
    .replaceAll(/\/private\/tmp\/bodyguard-baselines-proof\.[A-Za-z0-9]+/g, '[owned-baseline-scratch]')
    .replaceAll(/\/private\/tmp\/bodyguard-backup-proof\.[A-Za-z0-9]+/g, '[owned-backup-scratch]')
    .split('\n').map((line) => line.trimEnd()).join('\n').replace(/\n+$/, '\n'))
  save(name, value)
  artifacts.push({ name, raw_sha256: digest(raw), public_sha256: digest(value), bytes: value.length })
}
const filenames = phase === 'initial' ? [
  'baseline-red.xml', 'baseline-red.log', 'baseline-green1.xml', 'baseline-green1.log',
  'races-backup1.xml', 'races-backup1.log', 'openapi-review-red.xml', 'openapi-review-red.log',
  'api-full1.xml', 'api-full1.log', 'api-full2.xml', 'api-full2.log',
  'baseline-final.xml', 'baseline-final.log', 'api-final.xml', 'api-final.log',
  'ruff.log', 'format.log', 'static-initial.log', 'ruff-v2.log', 'ruff-v3.log',
  'ruff-final-v4.log', 'format-final-v4.log', 'mypy-final-v4.log',
  'pnpm-install.log', 'gen-api.log', 'gen-api-v2.log', 'frontend.log',
  'typecheck-v2.log', 'biome-v2.log', 'build-v2.log', 'guard.log', 'public-browser.log',
  'native-baselines.json', 'diff-check.log',
] : [
  'integrated-api.xml', 'integrated-api.log', 'integrated-frontend.log',
  'integrated-typecheck.log', 'integrated-biome.log', 'integrated-build.log',
  'integrated-guard.log', 'integrated-browser.log', 'integrated-ruff.log',
  'integrated-format.log', 'integrated-mypy.log', 'integrated-notifications-browser.log',
]
for (const name of filenames) collect(name, join(scratch, name))
collect(phase === 'initial' ? 'production-start.png' : 'integrated-production-start.png', join(root, 'bodyguard/frontend/test-results/selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png'))
if (phase === 'integrated') {
  const report = process.argv[4]
  assert(/^test-results\/notifications-[0-9TZ]+\/report\.json$/.test(report ?? ''))
  collect('integrated-notifications-report.json', join(root, 'bodyguard/frontend', report))
  const data = JSON.parse(readFileSync(join(destination, 'integrated-notifications-report.json'), 'utf8'))
  assert.equal(data.stats.unexpected, 0)
  assert.equal(data.stats.expected, 4)
  assert.equal(data.stats.skipped, 0)
  const screenshot = process.argv[5]
  assert(screenshot?.startsWith(report.slice(0, -'report.json'.length)))
  assert(!screenshot.includes('..') && screenshot.endsWith('/notifications-saved.png'))
  collect('integrated-notifications-saved.png', join(root, 'bodyguard/frontend', screenshot))
}
for (const [name, count] of phase === 'initial' ? [['api-final.xml', 369], ['baseline-final.xml', 48]] : [['integrated-api.xml', 369]]) {
  const xml = readFileSync(join(destination, name), 'utf8')
  assert.match(xml, new RegExp(`tests="${count}"`))
  assert.match(xml, /failures="0"/)
  assert.match(xml, /errors="0"/)
  assert.match(xml, /skipped="0"/)
}
assert.match(readFileSync(join(destination, phase === 'initial' ? 'frontend.log' : 'integrated-frontend.log'), 'utf8'), phase === 'initial' ? /558 passed/ : /590 passed/)
assert.match(readFileSync(join(destination, phase === 'initial' ? 'public-browser.log' : 'integrated-browser.log'), 'utf8'), /8 passed/)
const native = JSON.parse(readFileSync(join(destination, 'native-baselines.json'), 'utf8'))
assert.equal(native.proof_completed, true)
assert.equal(native.baseline_history_and_owner_restored, true)
assert.equal(native.owned_servers_stopped, true)
assert.equal(native.operational_restore_approved, false)
for (const name of ['deletion', 'revocation', 'credentials']) {
  assert.equal(native[`post_snapshot_${name}_replay_observed`], true)
}
const sources = [
  'backend/app/baselines.py', 'backend/app/db.py', 'backend/app/main.py', 'backend/app/readiness.py',
  'backend/migrations/versions/0007_account_baselines.py',
  'backend/tests/test_baselines.py', 'backend/tests/test_baseline_races.py',
  'backend/tests/backup_restore_proof.py', 'backend/tests/test_backup_restore_proof.py',
  'backend/tests/test_readiness.py', 'backend/tests/test_auth.py', 'backend/tests/test_google_auth.py',
  'backend/tests/test_password_reset.py', 'backend/tests/test_records_integrity.py',
  'backend/tests/test_account_withdrawal.py', 'backend/tests/test_notification_preferences.py',
  'frontend/src/api/generated/index.ts', 'frontend/src/api/generated/types.gen.ts',
].map((name) => ({ name: `bodyguard/${name}`, sha256: digest(readFileSync(join(root, 'bodyguard', name))) }))
const assetNames = readdirSync(join(root, 'bodyguard/frontend/dist/assets')).filter((name) => /^index-.*\.(js|css)$/.test(name))
assert.equal(assetNames.length, 2)
const output = ['.js', '.css'].map((extension) => assetNames.find((name) => name.endsWith(extension))).map((name) => ({
  name, sha256: digest(readFileSync(join(root, 'bodyguard/frontend/dist/assets', name))),
}))
if (phase === 'initial') {
  assert.equal(output[0].sha256, 'deae9447e06341db59a98b407bb60f6a39eac0e4585b114ecfcafbc3f4aee061')
  assert.equal(output[1].sha256, '675af16091090e9ef85a99fcdd2acb179cd18d24c435ec78291caaf3cba86dfb')
} else {
  const previous = JSON.parse(readFileSync(join(destination, 'artifacts.json'), 'utf8'))
  assert.deepEqual(sources, previous.sources, 'Incoming web work must not change tested API/type sources')
}
save(phase === 'initial' ? 'artifacts.json' : 'artifacts-v2.json', Buffer.from(`${JSON.stringify({
  version: phase === 'initial' ? 1 : 2, final_source_only: true, earlier_failure_sources_not_falsely_attributed_to_final: true,
  actual_owned_api_sql: true, synthetic_account_baseline_clock_mail: true,
  actual_public_web_regression: true, calibration_human_accuracy_verified: false,
  public_measurement_producer: false, operational_migration_or_restore: false,
  artifacts, sources, output,
}, null, 2)}\n`))
console.log(JSON.stringify({ artifacts: artifacts.length, sources: sources.length }))
