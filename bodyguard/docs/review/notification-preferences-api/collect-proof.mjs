// FR-N-03/NFR-08: bounded owned evidence, retain originals and reject proof replacement.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = realpathSync(fileURLToPath(new URL('.', import.meta.url)))
const scratch = process.argv[2]
const integrated = process.argv[3] === 'integrated'
assert(process.argv[3] === undefined || integrated)
assert(root.endsWith('/BODYGUARD-notification-preferences-api'))
assert.equal(destination, join(root, 'bodyguard/docs/review/notification-preferences-api'))
assert(/^\/private\/tmp\/bodyguard-notification-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
function save(name, bytes) {
  const target = join(destination, name)
  let existing
  try {
    existing = lstatSync(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (existing) {
    assert(existing.isFile() && !existing.isSymbolicLink() && existing.nlink === 1)
    assert(readFileSync(target).equals(bytes), 'Preserve previous proof')
  } else writeFileSync(target, bytes, { flag: 'wx' })
}
const artifacts = []
const names = [
  'contract-red.xml',
  'initial-green.xml',
  'review-green.xml',
  'full-backend.xml',
  'full-backend.stdout',
  'full-frontend.xml',
  'accepted-ruff.stdout',
  'accepted-mypy.stdout',
  'frontend-types.stdout',
  'frontend-check.stdout',
  'frontend-build.stdout',
  'production-guard.stdout',
  'offline-install.stdout',
  'generated-repeat-check.stdout',
]
if (integrated)
  names.push(
    'integrated-frontend.xml',
    'integrated-types.stdout',
    'integrated-check.stdout',
    'integrated-build.stdout',
    'integrated-production-guard.stdout',
  )
for (const name of names) {
  const source = join(scratch, name)
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size < 2 * 1024 * 1024)
  assert.equal(realpathSync(source), source)
  const raw = readFileSync(source)
  const sanitized = Buffer.from(
    raw
      .toString('utf8')
      .replaceAll(root, '[workspace]')
      .replaceAll('MacBook-Air.local', 'local-test-host')
      .replaceAll(/\/private\/tmp\/bodyguard-[A-Za-z-]+\.[A-Za-z0-9]+/g, '[owned-test-scratch]')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n+$/, '\n'),
  )
  save(name, sanitized)
  artifacts.push({ name, raw_sha256: digest(raw), public_sha256: digest(sanitized) })
}
const backend = readFileSync(join(destination, 'full-backend.xml'), 'utf8').match(
  /<testsuite\b([^>]*)>/,
)?.[1]
assert(backend)
for (const field of ['tests="321"', 'failures="0"', 'errors="0"', 'skipped="0"'])
  assert(backend.includes(field))
assert.match(
  readFileSync(join(destination, 'full-frontend.xml'), 'utf8'),
  /tests="503" failures="0" errors="0"/,
)
if (integrated)
  assert.match(
    readFileSync(join(destination, 'integrated-frontend.xml'), 'utf8'),
    /tests="523" failures="0" errors="0"/,
  )
const sources = [
  'bodyguard/backend/app/notification_preferences.py',
  'bodyguard/backend/app/db.py',
  'bodyguard/backend/app/main.py',
  'bodyguard/backend/app/readiness.py',
  'bodyguard/backend/migrations/versions/0006_notification_preferences.py',
  'bodyguard/backend/tests/test_notification_preferences.py',
  'bodyguard/backend/tests/backup_restore_proof.py',
  'bodyguard/backend/tests/test_backup_restore_proof.py',
  'bodyguard/backend/tests/test_account_withdrawal.py',
  'bodyguard/backend/tests/test_auth.py',
  'bodyguard/backend/tests/test_google_auth.py',
  'bodyguard/backend/tests/test_password_reset.py',
  'bodyguard/backend/tests/test_readiness.py',
  'bodyguard/backend/tests/test_records_integrity.py',
  'bodyguard/frontend/src/api/generated/index.ts',
  'bodyguard/frontend/src/api/generated/types.gen.ts',
].map((name) => ({ name, sha256: digest(readFileSync(join(root, name))) }))
save(
  integrated ? 'artifacts-v2.json' : 'artifacts.json',
  Buffer.from(
    `${JSON.stringify(
      {
        actual_postgresql_http_migration_restore: true,
        synthetic_mail_clock: true,
        notification_ui_connected: false,
        notification_firing_verified: false,
        operational_migration_deployment_approved: false,
        artifacts,
        sources,
      },
      null,
      2,
    )}\n`,
  ),
)
console.log(JSON.stringify({ artifacts: artifacts.length, sources: sources.length }))
