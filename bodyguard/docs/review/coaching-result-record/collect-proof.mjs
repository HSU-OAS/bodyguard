// FR-R-03/NFR-08: owned first red only; future green must have separate proof.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = fileURLToPath(new URL('.', import.meta.url))
assert(root.endsWith('/BODYGUARD-coaching-result-record'))
assert.equal(realpathSync(destination), join(root, 'bodyguard/docs/review/coaching-result-record'))
const scratch = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-result-record-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const source = join(scratch, 'first-red.xml')
const stat = lstatSync(source)
assert(stat.isFile() && !stat.isSymbolicLink() && stat.size < 2 * 1024 * 1024)
const raw = readFileSync(source)
const bytes = Buffer.from(
  raw
    .toString('utf8')
    .replaceAll(pathToFileURL(root).href, '[workspace]')
    .replaceAll(root, '[workspace]')
    .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"'),
)
const digest = (value) => createHash('sha256').update(value).digest('hex')
function save(name, value) {
  const target = join(destination, name)
  let old
  try {
    old = lstatSync(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (old) {
    assert(old.isFile() && !old.isSymbolicLink() && old.nlink === 1)
    assert(readFileSync(target).equals(value), 'Preserve original proof')
  } else writeFileSync(target, value, { flag: 'wx' })
}
save('first-red.xml', bytes)
save(
  'artifacts-first.json',
  Buffer.from(
    `${JSON.stringify({ version: 1, artifacts: [{ name: 'first-red.xml', raw_sha256: digest(raw), public_sha256: digest(bytes), bytes: bytes.length }] }, null, 2)}\n`,
  ),
)
// New evidence never replaces artifacts-first.json or any earlier byte sequence.
const rows = [
  {
    name: 'first-red.xml',
    raw_sha256: digest(raw),
    public_sha256: digest(bytes),
    bytes: bytes.length,
  },
]
function collect(name, sourcePath) {
  const sourceStat = lstatSync(sourcePath)
  assert(
    sourceStat.isFile() &&
      !sourceStat.isSymbolicLink() &&
      sourceStat.nlink === 1 &&
      sourceStat.size < 2 * 1024 * 1024,
  )
  assert.equal(realpathSync(sourcePath), sourcePath)
  const original = readFileSync(sourcePath)
  const publicBytes = name.endsWith('.png')
    ? original
    : Buffer.from(
        original
          .toString('utf8')
          .replaceAll(pathToFileURL(root).href, '[workspace]')
          .replaceAll(root, '[workspace]')
          .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"')
          .replaceAll(
            /\/private\/tmp\/bodyguard-browser-[A-Za-z0-9_-]+/g,
            '[owned-browser-scratch]',
          )
          .replaceAll(
            /\/private\/tmp\/bodyguard-result-record-proof\.[A-Za-z0-9]+/g,
            '[owned-result-scratch]',
          )
          .split('\n')
          .map((line) => line.trimEnd())
          .join('\n')
          .replace(/\n+$/, '\n'),
      )
  save(name, publicBytes)
  rows.push({
    name,
    raw_sha256: digest(original),
    public_sha256: digest(publicBytes),
    bytes: publicBytes.length,
  })
}
for (const name of [
  'contract-red.xml',
  'initial-unit.xml',
  'initial-types.stdout',
  'review-red.xml',
  'review-unit.xml',
  'final-frontend.xml',
  'final-backend.xml',
  'final-check.stdout',
  'final-types.stdout',
  'final-ruff.stdout',
  'final-backend-format.stdout',
  'final-mypy.stdout',
  'initial-browser.stdout',
  'final-browser.stdout',
  'final-public-browser.stdout',
  'production-negative.stdout',
  'production-positive.stdout',
])
  collect(name, join(scratch, name))
const browserRoot = join(root, 'bodyguard/frontend/test-results')
for (const [prefix, directory] of [
  ['initial', 'resultrecord-20261005T150713162329Z'],
  ['final', 'resultrecord-20261005T150945601996Z'],
]) {
  const base = join(browserRoot, directory)
  collect(`${prefix}-browser-report.json`, join(base, 'report.json'))
  collect(
    `${prefix}-result-record-detail.png`,
    join(
      base,
      'resultrecord-R06-real-comp-41e02--public-record-detail-works/result-record-detail.png',
    ),
  )
}
collect(
  'production-start.png',
  join(
    browserRoot,
    'selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png',
  ),
)
const sourceNames = [
  'bodyguard/frontend/src/coaching/resultRecord.ts',
  'bodyguard/frontend/src/coaching/resultRecord.test.ts',
  'bodyguard/frontend/src/api/records.ts',
  'bodyguard/frontend/e2e/resultrecord.spec.ts',
  'bodyguard/frontend/e2e/fixtures/resultRecordProbe.ts',
  'bodyguard/frontend/e2e/fixtures/resultRecord.vite.ts',
  'bodyguard/frontend/playwright.account.config.ts',
  'bodyguard/frontend/scripts/check-selection-production.mjs',
  'bodyguard/backend/tests/run_browser.py',
]
const sources = sourceNames.map((name) => ({
  name,
  sha256: digest(readFileSync(join(root, name))),
}))
const xml = (name) => {
  const value = readFileSync(join(destination, name), 'utf8')
  return Object.fromEntries(
    [...value.matchAll(/(?:tests|failures|errors|time)="([^"]+)"/g)]
      .slice(0, 4)
      .map((match) => [match[0].split('=')[0], Number(match[1])]),
  )
}
const frontend = xml('final-frontend.xml')
assert.equal(frontend.tests, 459)
assert.equal(frontend.failures, 0)
assert.equal(frontend.errors, 0)
const backend = xml('final-backend.xml')
assert.equal(backend.tests, 291)
assert.equal(backend.failures, 0)
assert.equal(backend.errors, 0)
const browser = JSON.parse(readFileSync(join(destination, 'final-browser-report.json'), 'utf8'))
assert.equal(browser.stats.expected, 5)
assert.equal(browser.stats.unexpected, 0)
assert.equal(browser.stats.skipped, 0)
save(
  'artifacts.json',
  Buffer.from(
    `${JSON.stringify(
      {
        version: 1,
        synthetic_observations_mail: true,
        actual_chrome_http_sql: true,
        human_accuracy_verified: false,
        product_coaching_connected: false,
        frontend,
        backend,
        browser: browser.stats,
        artifacts: rows,
        sources,
      },
      null,
      2,
    )}\n`,
  ),
)
console.log(
  JSON.stringify({
    preserved_artifacts: rows.length,
    frontend,
    backend,
    actual_browser_cases: 5,
    no_user_data: true,
  }),
)
