// S4.D6 / NFR-08: actual UI evidence, failed attempts and exact source preservation.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))
const proof = resolve(root, '../docs/review/records-minimal-copy')
const [mode] = process.argv.slice(2)
assert(['--record', '--check'].includes(mode))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (name) => JSON.parse(readFileSync(resolve(proof, name), 'utf8'))
const baseline = read('baseline-3/report.json'),
  final = read('final-2/report.json')
for (const report of [baseline, final]) {
  assert(report.passed && report.screens.length === 18 && report.flows.length === 7)
  assert.equal(report.cameraCalls, 0)
  assert.deepEqual(report.pageErrors, [])
  assert.deepEqual(report.externalOrigins, [])
  for (const [index, [file, expected]] of Object.entries(report.source).entries()) {
    assert.equal(
      sha(gunzipSync(readFileSync(resolve(proof, report.phase, `source-${index}.gz`)))),
      expected,
    )
    if (report === final) assert.equal(sha(readFileSync(resolve(root, file))), expected)
  }
  for (const entry of report.screens)
    assert(readFileSync(resolve(proof, report.phase, entry.filename)).length > 0)
}
for (const [index, after] of final.screens.entries()) {
  const before = baseline.screens[index]
  assert.equal(before.name, after.name)
  assert.equal(before.width, after.width)
  for (const field of ['labels', 'buttons', 'links']) assert.deepEqual(before[field], after[field])
}
for (const [file, expected] of Object.entries(baseline.source)) {
  if (file !== 'src/pages/RecordsPage.tsx') assert.equal(final.source[file], expected)
}
for (const phase of ['baseline', 'baseline-2']) {
  const report = read(`${phase}/report.json`)
  assert.equal(report.passed, false)
  assert.equal(report.failures.length, 1)
}
const red = read('red-tests.json'),
  green = read('green-tests-2.json')
assert.equal(red.numTotalTests, 14)
assert.equal(red.numFailedTests, 2)
assert.equal(green.numFailedTests, 0)
assert.equal(green.numPendingTests, 0)
assert.equal(green.numPassedTests, green.numTotalTests)
const reductions = final.screens.slice(0, 2).map((after, index) => ({
  screen: after.name,
  before: baseline.screens[index].charsWithoutSpace,
  after: after.charsWithoutSpace,
  percent: Number(
    (100 * (1 - after.charsWithoutSpace / baseline.screens[index].charsWithoutSpace)).toFixed(1),
  ),
}))
let manifest
if (mode === '--record') {
  const current = {}
  for (const file of [
    'src/pages/RecordsPage.tsx',
    'src/pages/RecordsPage.test.tsx',
    'scripts/test-records-copy-ui-browser.mjs',
    'scripts/verify-records-copy-proof.mjs',
  ]) {
    const bytes = readFileSync(resolve(root, file))
    const artifact = `current-${file.replaceAll('/', '--')}.gz`
    writeFileSync(resolve(proof, artifact), gzipSync(bytes), { flag: 'wx' })
    current[file] = { artifact, sha256: sha(bytes) }
  }
  const entries = []
  function inventory(relative = '') {
    for (const entry of readdirSync(resolve(proof, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) inventory(name)
      else if (entry.name !== 'README.md') {
        assert(entry.isFile() && !entry.isSymbolicLink())
        const bytes = readFileSync(resolve(proof, name))
        entries.push({ file: name, bytes: bytes.length, sha256: sha(bytes) })
      }
    }
  }
  inventory()
  manifest = {
    provenance: final.provenance,
    current,
    entries,
    reductions,
    frontendTests: green.numPassedTests,
    avatarAuthoring: false,
    stages1To6Complete: false,
  }
  writeFileSync(resolve(proof, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' })
} else manifest = read('manifest.json')
for (const entry of manifest.entries) {
  assert(!entry.file.split('/').includes('..') && !entry.file.startsWith('/'))
  const bytes = readFileSync(resolve(proof, entry.file))
  assert.equal(bytes.length, entry.bytes)
  assert.equal(sha(bytes), entry.sha256)
}
for (const [file, entry] of Object.entries(manifest.current)) {
  assert.equal(sha(gunzipSync(readFileSync(resolve(proof, entry.artifact)))), entry.sha256)
  assert.equal(sha(readFileSync(resolve(root, file))), entry.sha256)
}
assert.deepEqual(manifest.reductions, reductions)
process.stdout.write(
  `${JSON.stringify({ passed: true, evidence: manifest.entries.length, frontendTests: green.numPassedTests, reductions, browser: final.chrome, screensEach: 18, flowsEach: 7, syntheticHTTP: true, avatarAuthoring: false })}\n`,
)
