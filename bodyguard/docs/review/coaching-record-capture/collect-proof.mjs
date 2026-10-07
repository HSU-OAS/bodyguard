// FR-U-04/NFR-08: bounded owned reports only, originals never overwritten.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = fileURLToPath(new URL('.', import.meta.url))
assert(root.endsWith('/BODYGUARD-coaching-record-capture'))
assert.equal(realpathSync(destination), join(root, 'bodyguard/docs/review/coaching-record-capture'))
const scratch = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-record-capture-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = (value) => createHash('sha256').update(value).digest('hex')
const artifacts = []
function collect(name, source) {
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size < 2 * 1024 * 1024)
  assert.equal(realpathSync(source), source)
  const raw = readFileSync(source)
  const bytes = name.endsWith('.png')
    ? raw
    : Buffer.from(
        raw
          .toString('utf8')
          .replaceAll(pathToFileURL(root).href, '[workspace]')
          .replaceAll(root, '[workspace]')
          .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"')
          .replaceAll(
            /\/private\/tmp\/bodyguard-record-capture-proof\.[A-Za-z0-9]+/g,
            '[owned-capture-scratch]',
          )
          .split('\n')
          .map((line) => line.trimEnd())
          .join('\n')
          .replace(/\n+$/, '\n'),
      )
  save(name, bytes)
  artifacts.push({
    name,
    raw_sha256: digest(raw),
    public_sha256: digest(bytes),
    bytes: bytes.length,
  })
}
function save(name, bytes) {
  const path = join(destination, name)
  let old
  try {
    old = lstatSync(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (old) {
    assert(old.isFile() && !old.isSymbolicLink() && old.nlink === 1)
    assert(readFileSync(path).equals(bytes), 'Preserve original proof')
  } else writeFileSync(path, bytes, { flag: 'wx' })
}
for (const name of [
  'first-red.xml',
  'contract-red.xml',
  'initial-unit.xml',
  'initial-types.stdout',
  'review-types.stdout',
  'accepted-frontend.xml',
  'final-types.stdout',
  'final-check.stdout',
  'accepted-check.stdout',
  'accepted-types.stdout',
  'initial-browser.stdout',
  'final-browser.stdout',
  'final-public-browser.stdout',
  'accepted-public-browser.stdout',
  'final-backend.xml',
  'final-ruff.stdout',
  'final-backend-format.stdout',
  'final-mypy-accepted.stdout',
  'production-negative.stdout',
  'production-positive.stdout',
])
  collect(name, join(scratch, name))
const browser = join(root, 'bodyguard/frontend/test-results')
collect(
  'failed-raf-context.md',
  join(
    scratch,
    'selection-failed/selection-L08-actual-RAF-l-ad204-nthetic-resources-no-camera/error-context.md',
  ),
)
collect(
  'initial-browser-report.json',
  join(browser, 'ownercapture-20261005T153449747008Z/report.json'),
)
collect(
  'final-browser-report.json',
  join(browser, 'ownercapture-20261005T153638292553Z/report.json'),
)
collect(
  'owner-record-list.png',
  join(
    browser,
    'ownercapture-20261005T153638292553Z/ownercapture-O05-real-me-c-253a3-ord-without-exporting-proof/owner-record-list.png',
  ),
)
collect(
  'production-start.png',
  join(
    browser,
    'selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png',
  ),
)
const final = JSON.parse(readFileSync(join(destination, 'final-browser-report.json'), 'utf8'))
assert.equal(final.stats.expected, 4)
assert.equal(final.stats.unexpected, 0)
assert.equal(final.stats.skipped, 0)
const sources = [
  'bodyguard/frontend/src/coaching/recordOwner.ts',
  'bodyguard/frontend/src/coaching/recordOwner.test.ts',
  'bodyguard/frontend/src/auth.tsx',
  'bodyguard/frontend/e2e/ownercapture.spec.ts',
  'bodyguard/frontend/e2e/selection.spec.ts',
  'bodyguard/frontend/e2e/fixtures/recordOwnerProbe.ts',
  'bodyguard/frontend/e2e/fixtures/recordOwner.vite.ts',
  'bodyguard/frontend/playwright.account.config.ts',
  'bodyguard/frontend/scripts/check-selection-production.mjs',
  'bodyguard/backend/tests/run_browser.py',
].map((name) => ({ name, sha256: digest(readFileSync(join(root, name))) }))
assert.match(
  readFileSync(join(destination, 'accepted-frontend.xml'), 'utf8'),
  /tests="475" failures="0" errors="0"/,
)
const backend = readFileSync(join(destination, 'final-backend.xml'), 'utf8').match(
  /<testsuite\b([^>]*)>/,
)?.[1]
assert(backend)
for (const field of ['errors="0"', 'failures="0"', 'skipped="0"', 'tests="291"'])
  assert(backend.includes(field))
assert.match(readFileSync(join(destination, 'accepted-public-browser.stdout'), 'utf8'), /8 passed/)
save(
  'artifacts.json',
  Buffer.from(
    `${JSON.stringify({ version: 1, synthetic_authority_summary_mail: true, actual_chrome_api_sql: true, public_coaching_connected: false, human_accuracy_verified: false, artifacts, sources }, null, 2)}\n`,
  ),
)
collect('boundary-runtime.json', join(scratch, 'boundary-runtime.json'))
save(
  'artifacts-extra.json',
  Buffer.from(
    `${JSON.stringify(
      {
        version: 1,
        parent_manifest_sha256: digest(readFileSync(join(destination, 'artifacts.json'))),
        artifacts: artifacts.slice(-1),
        source_capture_sha256: sources[0].sha256,
      },
      null,
      2,
    )}\n`,
  ),
)
console.log(
  JSON.stringify({
    preserved_artifacts: artifacts.length,
    sources: sources.length,
    actual_chrome_cases: 4,
  }),
)
