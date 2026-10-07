// FR-U-04/FR-R-03/NFR-08: bounded actual artifacts; preserve originals and exact tested source.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = fileURLToPath(new URL('.', import.meta.url))
assert(root.endsWith('/BODYGUARD-coaching-auth-lifecycle'))
assert.equal(realpathSync(destination), join(root, 'bodyguard/docs/review/coaching-auth-lifecycle'))
const scratch = process.argv[2]
const finalBrowser = process.argv[3]
assert(/^\/private\/tmp\/bodyguard-coaching-auth-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^authcoaching-[0-9]{8}T[0-9]{12}Z$/.test(finalBrowser ?? ''))
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
function save(name, bytes) {
  const target = join(destination, name)
  let stat
  try { stat = lstatSync(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (stat) {
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1)
    assert(readFileSync(target).equals(bytes), 'Preserve original proof')
  } else writeFileSync(target, bytes, { flag: 'wx' })
}
const artifacts = []
function collect(name, source) {
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size < 2 * 1024 * 1024)
  assert.equal(realpathSync(source), source)
  const raw = readFileSync(source)
  const bytes = name.endsWith('.png') ? raw : Buffer.from(
    raw.toString('utf8').replaceAll(pathToFileURL(root).href, '[workspace]').replaceAll(root, '[workspace]')
      .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"')
      .replaceAll(/\/private\/tmp\/bodyguard-coaching-auth-proof\.[A-Za-z0-9]+/g, '[owned-auth-scratch]')
      .replaceAll(/\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+/g, '[owned-test-db]')
      .split('\n').map((line) => line.trimEnd()).join('\n').replace(/\n+$/, '\n'),
  )
  save(name, bytes)
  artifacts.push({ name, raw_sha256: digest(raw), public_sha256: digest(bytes), bytes: bytes.length })
}
for (const name of [
  'offline-install.stdout', 'contract-red.xml', 'initial-unit.xml',
  'initial-check.stdout', 'initial-types.stdout', 'review-red.xml', 'review-green.xml',
  'review-types.stdout', 'browser-types.stdout', 'pending-page-red.xml',
  'initial-browser.stdout', 'accepted-browser.stdout', 'final-browser.stdout', 'last-browser.stdout',
  'browser-first.stdout', 'full-unit.xml', 'full-check.stdout', 'postgres-resume.log',
  'final-frontend.xml', 'accepted-frontend.xml', 'final-accepted-frontend.xml', 'last-frontend.xml',
  'final-accepted-types.stdout', 'final-check.stdout',
  'final-backend.xml', 'final-backend.stdout', 'accepted-backend.xml', 'accepted-backend.stdout',
  'final-ruff.stdout', 'final-backend-format.stdout', 'final-mypy.stdout',
  'final-public-browser.stdout', 'production-negative.stdout', 'production-positive-final.stdout',
  'isolated-db-init.stdout', 'isolated-db-start.stdout', 'isolated-db-create.stdout', 'isolated-db-identity.stdout',
]) collect(name, join(scratch, name))
const browser = join(root, 'bodyguard/frontend/test-results')
collect('initial-browser-report.json', join(browser, 'authcoaching-20261005T171223455760Z/report.json'))
collect('accepted-browser-report.json', join(browser, 'authcoaching-20261005T171412236638Z/report.json'))
collect('additional-browser-report.json', join(browser, 'authcoaching-20261005T171501024263Z/report.json'))
for (const [label, folder] of [
  ['initial', 'authcoaching-20261005T171223455760Z'],
  ['additional', 'authcoaching-20261005T171501024263Z'],
]) collect(`${label}-error-context.md`, join(browser, folder, 'authcoaching-H02-actual-pr-46426--saves-to-own-public-record/error-context.md'))
collect('final-browser-report.json', join(browser, finalBrowser, 'report.json'))
collect('auth-coaching-record.png', join(browser, finalBrowser, 'authcoaching-H02-actual-pr-46426--saves-to-own-public-record/auth-coaching-record.png'))
collect('production-start.png', join(browser, 'selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png'))
const report = JSON.parse(readFileSync(join(destination, 'final-browser-report.json'), 'utf8'))
for (const [field, value] of [['expected', 4], ['unexpected', 0], ['skipped', 0]]) assert.equal(report.stats[field], value)
assert.match(readFileSync(join(destination, 'last-frontend.xml'), 'utf8'), /tests="523" failures="0" errors="0"/)
const backend = readFileSync(join(destination, 'accepted-backend.xml'), 'utf8').match(/<testsuite\b([^>]*)>/)?.[1]
assert(backend)
for (const value of ['tests="291"', 'failures="0"', 'errors="0"', 'skipped="0"']) assert(backend.includes(value))
assert.match(readFileSync(join(destination, 'final-public-browser.stdout'), 'utf8'), /8 passed/)
const sources = [
  'bodyguard/frontend/src/coaching/useRecordedCoaching.ts',
  'bodyguard/frontend/src/coaching/useRecordedCoaching.test.tsx',
  'bodyguard/frontend/e2e/authcoaching.spec.ts',
  'bodyguard/frontend/e2e/fixtures/authCoachingProbe.ts',
  'bodyguard/frontend/e2e/fixtures/authCoaching.vite.ts',
  'bodyguard/frontend/playwright.account.config.ts',
  'bodyguard/frontend/scripts/check-selection-production.mjs',
  'bodyguard/backend/tests/run_browser.py',
].map((name) => ({ name, sha256: digest(readFileSync(join(root, name))) }))
const names = readdirSync(join(root, 'bodyguard/frontend/dist/assets')).filter((name) => /^index-.*\.(js|css)$/.test(name)).sort()
assert.equal(names.length, 2)
const output = names.map((name) => ({ name, sha256: digest(readFileSync(join(root, 'bodyguard/frontend/dist/assets', name))) }))
assert.equal(output.find((value) => value.name.endsWith('.js')).sha256, 'deae9447e06341db59a98b407bb60f6a39eac0e4585b114ecfcafbc3f4aee061')
assert.equal(output.find((value) => value.name.endsWith('.css')).sha256, '675af16091090e9ef85a99fcdd2acb179cd18d24c435ec78291caaf3cba86dfb')
save('artifacts.json', Buffer.from(`${JSON.stringify({
  version: 1, actual_auth_provider_chrome_api_sql: true,
  synthetic_clock_ports_frames_mail: true, public_coaching_connected: false,
  human_accuracy_verified: false, artifacts, sources, output,
}, null, 2)}\n`))
console.log(JSON.stringify({ artifacts: artifacts.length, sources: sources.length, actual_chrome_cases: 4 }))
