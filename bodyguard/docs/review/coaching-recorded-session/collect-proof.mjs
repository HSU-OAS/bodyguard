// FR-R-03/NFR-08: bounded actual owned artifacts, original failures never overwritten.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = fileURLToPath(new URL('.', import.meta.url))
assert(root.endsWith('/BODYGUARD-coaching-recorded-session'))
assert.equal(
  realpathSync(destination),
  join(root, 'bodyguard/docs/review/coaching-recorded-session'),
)
const scratch = process.argv[2]
const finalBrowser = process.argv[3]
assert(/^\/private\/tmp\/bodyguard-recorded-session-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^recordedsession-[0-9]{8}T[0-9]{12}Z$/.test(finalBrowser ?? ''))
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
function save(name, bytes) {
  const target = join(destination, name)
  let stat
  try {
    stat = lstatSync(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
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
  const bytes = name.endsWith('.png')
    ? raw
    : Buffer.from(
        raw
          .toString('utf8')
          .replaceAll(pathToFileURL(root).href, '[workspace]')
          .replaceAll(root, '[workspace]')
          .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"')
          .replaceAll(
            /\/private\/tmp\/bodyguard-recorded-session-proof\.[A-Za-z0-9]+/g,
            '[owned-recorded-scratch]',
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
for (const name of [
  'offline-install.stdout',
  'contract-red.xml',
  'initial-unit.xml',
  'initial-types.stdout',
  'review-red.xml',
  'review-green.xml',
  'bound-review-red.xml',
  'clock-id-review-red.xml',
  'final-frontend.xml',
  'accepted-frontend.xml',
  'final-accepted-frontend.xml',
  'browser-types.stdout',
  'accepted-types.stdout',
  'final-check.stdout',
  'accepted-check.stdout',
  'final-accepted-check.stdout',
  'initial-browser.stdout',
  'accepted-browser.stdout',
  'final-browser.stdout',
  'final-backend.xml',
  'final-backend.stdout',
  'final-ruff.stdout',
  'final-backend-format.stdout',
  'final-mypy.stdout',
  'final-public-browser.stdout',
  'production-negative.stdout',
  'production-positive.stdout',
])
  collect(name, join(scratch, name))
const browser = join(root, 'bodyguard/frontend/test-results')
collect(
  'initial-browser-report.json',
  join(browser, 'recordedsession-20261005T161657542474Z/report.json'),
)
collect(
  'initial-error-context.md',
  join(
    browser,
    'recordedsession-20261005T161657542474Z/recordedsession-A04-delaye-a6771-ummary-to-own-record-detail/error-context.md',
  ),
)
collect(
  'accepted-browser-report.json',
  join(browser, 'recordedsession-20261005T161924148420Z/report.json'),
)
collect('final-browser-report.json', join(browser, finalBrowser, 'report.json'))
collect(
  'recorded-session-detail.png',
  join(
    browser,
    finalBrowser,
    'recordedsession-A04-delaye-a6771-ummary-to-own-record-detail/recorded-session-detail.png',
  ),
)
collect(
  'production-start.png',
  join(
    browser,
    'selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png',
  ),
)
const report = JSON.parse(readFileSync(join(destination, 'final-browser-report.json'), 'utf8'))
for (const [field, value] of [
  ['expected', 4],
  ['unexpected', 0],
  ['skipped', 0],
])
  assert.equal(report.stats[field], value)
assert.match(
  readFileSync(join(destination, 'final-accepted-frontend.xml'), 'utf8'),
  /tests="503" failures="0" errors="0"/,
)
const backend = readFileSync(join(destination, 'final-backend.xml'), 'utf8').match(
  /<testsuite\b([^>]*)>/,
)?.[1]
assert(backend)
for (const value of ['tests="291"', 'failures="0"', 'errors="0"', 'skipped="0"'])
  assert(backend.includes(value))
assert.match(readFileSync(join(destination, 'final-public-browser.stdout'), 'utf8'), /8 passed/)
const sources = [
  'bodyguard/frontend/src/coaching/recordedSession.ts',
  'bodyguard/frontend/src/coaching/recordedSession.test.ts',
  'bodyguard/frontend/e2e/recordedsession.spec.ts',
  'bodyguard/frontend/e2e/fixtures/recordedSessionProbe.ts',
  'bodyguard/frontend/e2e/fixtures/recordedSession.vite.ts',
  'bodyguard/frontend/playwright.account.config.ts',
  'bodyguard/frontend/scripts/check-selection-production.mjs',
  'bodyguard/backend/tests/run_browser.py',
].map((name) => ({ name, sha256: digest(readFileSync(join(root, name))) }))
const outputNames = readdirSync(join(root, 'bodyguard/frontend/dist/assets'))
  .filter((name) => /^index-.*\.(js|css)$/.test(name))
  .sort()
assert.equal(outputNames.length, 2)
const output = outputNames.map((name) => ({
  name,
  sha256: digest(readFileSync(join(root, 'bodyguard/frontend/dist/assets', name))),
}))
assert.equal(
  output.find((value) => value.name.endsWith('.js')).sha256,
  'deae9447e06341db59a98b407bb60f6a39eac0e4585b114ecfcafbc3f4aee061',
)
const cssName = output.find((value) => value.name.endsWith('.css')).name
const css = readFileSync(join(root, 'bodyguard/frontend/dist/assets', cssName), 'utf8')
assert.equal(
  digest(css.replace('.block{display:block}', '')),
  'c0123052b60a122ff54814fc1d4715fa439f58355f761ddc67260a54035b0f15',
)
save(
  'artifacts.json',
  Buffer.from(
    `${JSON.stringify(
      {
        version: 1,
        synthetic_clock_authority_ports_observations_mail: true,
        actual_chrome_api_sql: true,
        public_coaching_connected: false,
        human_accuracy_verified: false,
        artifacts,
        sources,
        output,
      },
      null,
      2,
    )}\n`,
  ),
)
console.log(
  JSON.stringify({ artifacts: artifacts.length, sources: sources.length, actual_chrome_cases: 4 }),
)
