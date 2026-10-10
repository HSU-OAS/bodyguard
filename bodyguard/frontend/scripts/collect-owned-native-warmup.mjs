// S6.19: immutable technical artifacts, synthetic camera/mail/decisions explicitly separated.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const [proof, browserProof] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-owned-warmup-proof\.[A-Za-z0-9]+$/.test(proof))
assert(/^\/private\/tmp\/bodyguard-native-feedback-proof\.[A-Za-z0-9]+$/.test(browserProof))
const root = fileURLToPath(new URL('..', import.meta.url)),
  repo = resolve(root, '../..')
const destination = resolve(repo, 'bodyguard/docs/review/owned-native-warmup')
assert(!existsSync(resolve(destination, 'manifest.json')))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const checks = JSON.parse(readFileSync(resolve(proof, 'accepted-checks/report.json')))
assert(checks.pass && checks.commands.every((item) => item.status === 0))
const batch = JSON.parse(readFileSync(resolve(proof, 'strict-batch.json')))
assert.equal(batch.runs.length, 6)
assert(batch.runs.every((item) => item.status === 0))
for (const item of batch.source) assert.equal(checks.source[item.path], item.sha256)
for (const [file, hash] of Object.entries(checks.source))
  assert.equal(sha(readFileSync(resolve(root, file))), hash)
for (const [extension, bytes, hash] of [
  ['js', 354600, '434efb6661a704895d6746ff6a40779c11806d53af276e9244fb4e2ade6e6945'],
  ['css', 31199, '043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e'],
]) {
  const item = checks.production.find((row) => row.file.endsWith(`.${extension}`))
  assert.equal(item.bytes, bytes)
  assert.equal(item.sha256, hash)
}
const testRoot = resolve(root, 'test-results')
const reportPaths = readdirSync(testRoot)
  .filter((name) => name.startsWith('nativefeedback-'))
  .map((name) => ({
    name,
    report: JSON.parse(readFileSync(resolve(testRoot, name, 'report.json'))),
  }))
const summary = {
  base: 'ce137244e8a8cd31a074eb1e9c2b517d9a797443',
  actualHuman: false,
  actualCamera: false,
  productPolicyApproved: false,
  runs: [],
  glbs: {},
}
for (const label of [
  'original-male',
  'original-female',
  'warm-male',
  'warm-male-accepted',
  'warm-female-accepted',
  'prepared-male-accepted',
  'prepared-female-accepted',
  'original-male-accepted',
  'warm-male-strict-accepted',
  'warm-female-strict-accepted',
  'prepared-male-strict-accepted',
  'prepared-female-strict-accepted',
  'original-male-strict-accepted',
  'original-female-strict-accepted',
]) {
  const receipt = JSON.parse(readFileSync(resolve(proof, `${label}.receipt.json`)))
  const matches = reportPaths.filter(
    (item) =>
      item.report.stats.startTime >= receipt.start && item.report.stats.startTime <= receipt.end,
  )
  assert.equal(matches.length, 1)
  const { name, report } = matches[0],
    expected = label.startsWith('original') ? 13 : label.startsWith('warm') ? 6 : 15
  assert.equal(report.stats.expected + report.stats.unexpected, expected)
  assert.equal(report.stats.skipped, 0)
  assert.equal(report.stats.flaky, 0)
  assert(report.config.projects.every((project) => project.retries === 0))
  const specs = (suites) =>
    suites.flatMap((suite) => [...(suite.specs ?? []), ...specs(suite.suites ?? [])])
  const cases = specs(report.suites),
    gender = label.includes('-female') ? 'female' : 'male'
  assert.equal(cases.length, expected)
  assert(cases.every((item) => item.title.startsWith(`${gender} `)))
  assert(cases.every((item) => item.title.includes('warmup') === label.startsWith('warm')))
  assert(cases.every((item) => item.tests.every((attempt) => attempt.results.length === 1)))
  const failed = label === 'warm-male'
  assert.equal(receipt.status, failed ? 1 : 0)
  assert.equal(report.stats.unexpected, failed ? 1 : 0)
  const summaries = readdirSync(resolve(testRoot, name), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === 'native-hands-summary.json')
    .map((entry) => JSON.parse(readFileSync(resolve(entry.parentPath, entry.name))))
  assert.equal(summaries.length, expected)
  for (const item of summaries) {
    assert(item.browser.startsWith('155.'))
    assert.equal(item.external, 0)
    assert.deepEqual(item.errors, [])
    // CSP blocks can happen before request observers; counters reset on navigation.
    assert(Number.isSafeInteger(item.counters.cspAttempts) && item.counters.cspAttempts >= 0)
    assert.equal(item.actualHuman, false)
    assert.equal(item.actualCamera, false)
    assert.equal(item.productPolicyApproved, false)
    const final =
      item.final ??
      item.stages.find((stage) => stage.name === 'native-closed-before-public-record')?.snapshot
    assert(final?.closed)
    assert(final.tracksEnded && final.detached && final.allFramesClosed)
    assert.equal(final.models, 0)
    assert.deepEqual(final.memory, final.baseline)
    assert.equal(final.frameCloses, final.frames)
    assert.equal(final.frameErrors, 0)
    assert.equal(final.nativeCloses, final.nativeCalls)
    assert.equal(final.faceCalls, final.nativeCalls)
    assert.equal(final.handCalls, final.nativeCalls)
    for (const key of [
      'cameraCloses',
      'detectorCloses',
      'faceDetectorCloses',
      'handDetectorCloses',
    ])
      assert.equal(final[key], final.cameras)
    assert.equal(final.freshStamps, true)
    assert.equal(final.sameInput, true)
    assert.equal(final.nativePeopleMax, 0)
    assert.equal(final.nativeFacesMax, 0)
    assert.equal(final.nativeHandsMax, 0)
    assert.deepEqual(final.failures, [])
    assert.equal(final.inferenceWarmupConfigured, !label.startsWith('original'))
  }
  summary.runs.push({
    label,
    directory: name,
    stats: report.stats,
    retry: 0,
    browser: summaries[0].browser,
    currentDocumentCspAttempts: summaries.map((item) => item.counters.cspAttempts),
    cspCoverage: 'current document only; record navigation resets counter; not whole-run absence',
    passed: !failed,
  })
}
const bundleHashes = []
for (const item of summary.runs) {
  const bytes = readFileSync(resolve(browserProof, `probe-${item.label}`, 'probe.js'))
  bundleHashes.push(sha(bytes))
}
assert.equal(new Set(bundleHashes).size, 1)
summary.bundle = bundleHashes[0]
for (const gender of ['male', 'female']) {
  const original = execFileSync(
    'git',
    ['show', `25a9bd6:bodyguard/frontend/src/avatar/models/bodyguard-${gender}-candidate-a37.glb`],
    { cwd: repo, maxBuffer: 20 * 1024 * 1024 },
  )
  assert.equal(sha(readFileSync(resolve(browserProof, `${gender}.glb`))), sha(original))
  summary.glbs[gender] = {
    git: `25a9bd6:bodyguard/frontend/src/avatar/models/bodyguard-${gender}-candidate-a37.glb`,
    bytes: original.length,
    sha256: sha(original),
  }
}
writeFileSync(resolve(proof, 'browser-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, {
  flag: 'wx',
})
mkdirSync(resolve(destination, 'evidence'), { recursive: true })
const manifest = {
  base: summary.base,
  created: new Date().toISOString(),
  artifacts: {},
  source: {},
}
function archive(name, bytes) {
  const compressed = gzipSync(bytes),
    file = `evidence/sha256/${sha(compressed)}.gz`
  mkdirSync(resolve(destination, file, '..'), { recursive: true })
  if (existsSync(resolve(destination, file)))
    assert(readFileSync(resolve(destination, file)).equals(compressed))
  else writeFileSync(resolve(destination, file), compressed, { flag: 'wx' })
  manifest.artifacts[name] = {
    file,
    bytes: bytes.length,
    sha256: sha(bytes),
    compressedSha256: sha(compressed),
  }
}
for (const [prefix, directory] of [
  ['run', proof],
  ['browser', browserProof],
]) {
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith('.glb')) continue
    const file = resolve(entry.parentPath, entry.name)
    archive(`${prefix}/${file.slice(directory.length + 1)}`, readFileSync(file))
  }
}
for (const item of summary.runs)
  for (const entry of readdirSync(resolve(testRoot, item.directory), {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue
    const file = resolve(entry.parentPath, entry.name)
    archive(
      `results/${item.label}/${file.slice(resolve(testRoot, item.directory).length + 1)}`,
      readFileSync(file),
    )
  }
for (const file of [
  ...Object.keys(checks.source).map((name) => `bodyguard/frontend/${name}`),
  'bodyguard/backend/tests/run_browser.py',
  'bodyguard/backend/tests/conftest.py',
  'bodyguard/frontend/package.json',
  'bodyguard/frontend/pnpm-lock.yaml',
  'bodyguard/docs/review/owned-native-warmup/verify.mjs',
]) {
  const bytes = readFileSync(resolve(repo, file)),
    name = `source/${file}`
  archive(name, bytes)
  manifest.source[file] = { artifact: name, sha256: sha(bytes) }
}
writeFileSync(resolve(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
  flag: 'wx',
})
console.log(
  JSON.stringify({
    artifacts: Object.keys(manifest.artifacts).length,
    source: Object.keys(manifest.source).length,
    finalPassed: summary.runs
      .filter((row) => row.label.endsWith('-strict-accepted'))
      .reduce((n, row) => n + row.stats.expected, 0),
  }),
)
