// FR-V-03/NFR-08: publish bounded diagnostics; retain originals without exporting DOM.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const phase = process.argv[3] ?? ''
assert(['', 'review', 'review-provenance'].includes(phase))
const evidenceDirectory = phase ? `evidence-${phase}` : 'evidence'
const destination = fileURLToPath(new URL(`./${evidenceDirectory}/`, import.meta.url))
const scratch = process.argv[2]
assert(root.endsWith('/BODYGUARD-web-startup-readiness'))
assert(/^\/private\/tmp\/bodyguard-startup-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
mkdirSync(destination, { recursive: true })
assert.equal(realpathSync(destination), join(root, `bodyguard/docs/review/web-startup-readiness/${evidenceDirectory}`))
const sha = value => createHash('sha256').update(value).digest('hex')
const artifacts = []
const originals = []
function read(path) {
  const stat = lstatSync(path)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size < 4 * 1024 * 1024)
  assert.equal(realpathSync(path), path)
  const bytes = readFileSync(path)
  originals.push({ path: path.replace(root, '[workspace]').replace(scratch, '[scratch]'), bytes: bytes.length, sha256: sha(bytes), originalPublished: false })
  return bytes
}
function save(name, bytes) {
  const path = join(destination, name)
  try { writeFileSync(path, bytes, { flag: 'wx' }) }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    const stat = lstatSync(path)
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1)
    assert(readFileSync(path).equals(bytes), 'Preserve prior evidence')
  }
  artifacts.push({ name, bytes: bytes.length, sha256: sha(bytes) })
}
function json(name, value) { save(name, Buffer.from(`${JSON.stringify(value, null, 2)}\n`)) }
const runs = [
  '20261006T133834600Z', '20261007T000519110Z',
  '20261007T001013110Z', '20261007T001051129Z', '20261007T001409609Z',
]
const finalRun = process.argv[4]
if (finalRun) {
  assert(['review', 'review-provenance'].includes(phase))
  assert(/^20261007T\d{9}Z$/.test(finalRun))
  runs.push(finalRun)
}
for (const run of runs) {
  const path = join(root, `bodyguard/frontend/test-results/startup-${run}/report.json`)
  const report = JSON.parse(read(path))
  const cases = []
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
      const observations = (result.attachments ?? []).filter(item => item.body && ['startup-observations.json', 'boundary-observations.json'].includes(item.name)).map(item => ({ name: item.name, value: JSON.parse(Buffer.from(item.body, 'base64')) }))
      cases.push({ title: spec.title, status: result.status, duration: result.duration, observations })
    }
    for (const child of suite.suites ?? []) walk(child)
  }
  walk(report)
  json(`browser-${run}.json`, { stats: report.stats, cases, selectedReviewRun: run === finalRun, sourceAtRunVerified: false, actualCameraOrHuman: false, actualAuth: false, productGatePassed: false })
}
const units = ['frontend-final.xml', 'frontend-final-v2.xml']
for (const name of units) {
  const content = read(join(scratch, name)).toString()
  const header = content.match(/<testsuites\b[^>]+>/)?.[0]
  assert(header)
  const attrs = Object.fromEntries([...header.matchAll(/(tests|failures|errors|time)="([0-9.]+)"/g)].map(([, key, value]) => [key, Number(value)]))
  assert.equal(attrs.tests, 685)
  json(`${name}.summary.json`, attrs)
}
const logNames = [
  'probe-unit-red.log', 'probe-unit-green-v1.log', 'probe-observer-negative-red.log',
  'probe-unit-green-v2.log', 'browser-comparison-v1.log', 'browser-comparison-v2.log',
  'browser-headed-v1.log', 'boundary-green-v1.log', 'boundary-green-v2.log',
  'browser-final-v1.log', 'frontend-final.log', 'frontend-final-v2.log',
  'cancel-signal-v2.log', 'type-final.log', 'biome-final.log', 'build-final.log',
  'guard-final.log', 'guard-final-v2.log',
]
if (phase) logNames.push('cancel-dev-ready.log', 'browser-final-review.log', 'type-review-final.log')
for (const name of logNames) read(join(scratch, name))
json('cancellation.json', JSON.parse(readFileSync(join(scratch, 'cancel-signal-v2.log'))))
if (phase) json('cancellation-dev-ready.json', JSON.parse(readFileSync(join(scratch, 'cancel-dev-ready.log'))))
const png = read(join(root, 'bodyguard/frontend/test-results/startup-20261007T001409609Z/startup-startup-production-http-first-and-repeat-navigation/production-start.png'))
save('production-start.png', png)
// List code hashes separately from documentation that will describe this run.
const sources = [
  'bodyguard/frontend/e2e/fixtures/startupProbe.ts', 'bodyguard/frontend/src/startup-harness.test.ts',
  'bodyguard/frontend/e2e/startup.spec.ts', 'bodyguard/frontend/playwright.startup.config.ts',
  'bodyguard/frontend/scripts/test-startup-browser.mjs', 'bodyguard/docs/review/web-startup-readiness/collect-proof.mjs',
].map(name => ({ name, sha256: sha(readFileSync(join(root, name))) }))
json('manifest.json', { baseline: '991ed2b33a1abc6158b3a177f8431a104c476ba0', sourceHashTiming: 'collection-time, not browser/test execution', sourceAtRunVerified: false, sources, artifacts, originals, rawDOMPublished: false, classifierValidated: false, allStagesComplete: false, mandatoryBrowserGatePassed: false, mergeAllowed: false })
console.log(JSON.stringify({ artifacts: artifacts.length, sources: sources.length, originalsPreserved: originals.length, mergeAllowed: false }))
