// FR-R-01/NFR-07/08: actual bounded outputs, preserve original failures.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = fileURLToPath(new URL('.', import.meta.url))
assert(root.endsWith('/BODYGUARD-minute-aggregation'))
assert.equal(realpathSync(destination), join(root, 'bodyguard/docs/review/minute-aggregation'))
const scratch = process.argv[2]
const phase = process.argv[3] ?? 'initial'
assert(['initial', 'integrated'].includes(phase))
assert(/^\/private\/tmp\/bodyguard-minute-aggregation-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
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
  const value = name.endsWith('.png') ? raw : Buffer.from(
    raw.toString('utf8').replaceAll(pathToFileURL(root).href, '[workspace]').replaceAll(root, '[workspace]')
      .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"')
      .replaceAll(/\/private\/tmp\/bodyguard-minute-aggregation-proof\.[A-Za-z0-9]+/g, '[owned-minute-scratch]')
      .split('\n').map((line) => line.trimEnd()).join('\n').replace(/\n+$/, '\n'),
  )
  save(name, value)
  artifacts.push({ name, raw_sha256: digest(raw), public_sha256: digest(value), bytes: value.length })
}
const filenames = phase === 'initial' ? [
  'offline-install.stdout', 'contract-red.xml', 'initial-unit.xml',
  'initial-types.stdout', 'detailed-unit.xml', 'detailed-types.stdout',
  'review-red.xml', 'precision-review-red.xml', 'review-green.xml', 'review-types.stdout',
  'final-frontend.xml', 'final-types.stdout', 'final-check.stdout', 'final-build.stdout',
  'production-negative.stdout', 'production-positive.stdout', 'final-public-browser.stdout',
] : [
  'integrated-frontend.xml', 'integrated-types.stdout', 'integrated-check.stdout',
  'integrated-build.stdout', 'integrated-production.stdout', 'integrated-public-browser.stdout',
]
for (const name of filenames) collect(name, join(scratch, name))
collect(phase === 'initial' ? 'production-start.png' : 'integrated-production-start.png', join(root, 'bodyguard/frontend/test-results/selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png'))
assert.match(readFileSync(join(destination, phase === 'initial' ? 'final-frontend.xml' : 'integrated-frontend.xml'), 'utf8'), /tests="558" failures="0" errors="0"/)
assert.match(readFileSync(join(destination, phase === 'initial' ? 'final-public-browser.stdout' : 'integrated-public-browser.stdout'), 'utf8'), /8 passed/)
const sources = [
  'bodyguard/frontend/src/summary/minuteAggregation.ts',
  'bodyguard/frontend/src/summary/minuteAggregation.test.ts',
  'bodyguard/frontend/scripts/check-selection-production.mjs',
].map((name) => ({ name, sha256: digest(readFileSync(join(root, name))) }))
const names = readdirSync(join(root, 'bodyguard/frontend/dist/assets')).filter((name) => /^index-.*\.(js|css)$/.test(name)).sort()
assert.equal(names.length, 2)
const output = names.map((name) => ({ name, sha256: digest(readFileSync(join(root, 'bodyguard/frontend/dist/assets', name))) }))
assert.equal(output.find((v) => v.name.endsWith('.js')).sha256, 'deae9447e06341db59a98b407bb60f6a39eac0e4585b114ecfcafbc3f4aee061')
assert.equal(output.find((v) => v.name.endsWith('.css')).sha256, '675af16091090e9ef85a99fcdd2acb179cd18d24c435ec78291caaf3cba86dfb')
save(phase === 'initial' ? 'artifacts.json' : 'artifacts-v2.json', Buffer.from(`${JSON.stringify({
  version: phase === 'initial' ? 1 : 2, synthetic_intervals_only: true, actual_public_web_regression: true,
  classifier_human_accuracy_verified: false, public_summary_producer: false,
  artifacts, sources, output,
}, null, 2)}\n`))
console.log(JSON.stringify({ artifacts: artifacts.length, sources: sources.length }))
