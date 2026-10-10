// FR-R-01/03/06, FR-U-04/05: mechanical evidence archive; authored after actual executions.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const destination = dirname(fileURLToPath(import.meta.url))
const root = resolve(destination, '../../../..')
const baseline = '665c914e2befc3fcfca04366c0eaf6ee225eef3c'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root })
const decode = artifact => gunzipSync(readFileSync(resolve(destination, artifact.file)))
const inputs = [
  'bodyguard/frontend/e2e/recordjourney.spec.ts',
  'bodyguard/frontend/e2e/fixtures/recordJourneyProbe.ts',
  'bodyguard/frontend/e2e/fixtures/recordJourney.vite.ts',
  'bodyguard/frontend/playwright.account.config.ts',
  'bodyguard/backend/tests/run_browser.py',
]
function validate(manifest) {
  for (const [name, entry] of Object.entries(manifest.artifacts)) {
    const bytes = decode(entry)
    assert.equal(sha(bytes), entry.sha256, name)
    assert.equal(bytes.length, entry.bytes, name)
    assert.equal(sha(readFileSync(resolve(destination, entry.file))), entry.gzipSha256, name)
  }
  for (const [file, digest] of Object.entries(manifest.source))
    assert.equal(sha(readFileSync(resolve(root, file))), digest, file)
  for (const [file, digest] of Object.entries(manifest.unchanged)) {
    assert.equal(sha(git('show', `${baseline}:${file}`)), digest, file)
    assert.equal(sha(readFileSync(resolve(root, file))), digest, file)
  }
  const json = name => JSON.parse(decode(manifest.artifacts[name]))
  const unit = json('unit.json')
  assert.equal(unit.success, true)
  assert.deepEqual([unit.numTotalTests, unit.numPassedTests, unit.numFailedTests, unit.numPendingTests], [1568, 1568, 0, 0])
  const report = json('native-report.json')
  assert.deepEqual([report.stats.expected, report.stats.unexpected, report.stats.flaky, report.stats.skipped], [5, 0, 0, 0])
  assert.equal(report.errors.length, 0)
  const specs = report.suites.flatMap(suite => suite.specs)
  assert.equal(specs.length, 5)
  for (const [index, spec] of specs.entries()) {
    assert(spec.title.startsWith(`RJ-W0${index + 1} `))
    assert.equal(spec.ok, true)
    assert.equal(spec.tests.length, 1)
    const test = spec.tests[0]
    assert.equal(test.expectedStatus, 'passed')
    assert.equal(test.results.length, 1)
    const result = test.results[0]
    assert.equal(result.status, 'passed')
    assert.equal(result.retry, 0)
    const receipt = result.attachments.find(item => item.name === 'record-journey-boundaries.json')
    assert(receipt?.body)
    const boundary = JSON.parse(Buffer.from(receipt.body, 'base64'))
    assert.equal(boundary.actualChromeProviderAggregationHttpSqlAndExistingRecordUi, true)
    assert.equal(boundary.syntheticAccountsMailIntervals, true)
    assert.equal(boundary.actualBodyAvatarClinical, false)
    assert.equal(boundary.cameras + boundary.external + boundary.errors, 0)
    assert.deepEqual(boundary.storage, [0, 0])
    assert(boundary.browser)
  }
  const publicFiles = Object.keys(manifest.public)
  assert.equal(publicFiles.length, 2)
  for (const file of publicFiles) {
    const before = decode(manifest.artifacts[`public-before/${file}`])
    const after = decode(manifest.artifacts[`public-after/${file}`])
    assert.equal(sha(before), sha(after), file)
    assert.equal(sha(after), manifest.public[file])
    if (file.endsWith('.js')) for (const privateText of ['mountRecordJourneyProbe', 'recordJourneyProbe', '__private-record-journey-probe', 'useOwnedDashboard'])
      assert(!after.toString().includes(privateText), privateText)
  }
  assert(decode(manifest.artifacts['db-stop.log']).toString().includes('server stopped'))
  assert(decode(manifest.artifacts['db-status.log']).toString().includes('no server running'))
  return { artifacts: Object.keys(manifest.artifacts).length, source: Object.keys(manifest.source).length,
    unchanged: Object.keys(manifest.unchanged).length, unit: 1568, native: 5, publicFiles: 2 }
}
if (process.argv[2] === '--check') {
  console.log(JSON.stringify(validate(JSON.parse(readFileSync(resolve(destination, 'manifest.json'))))))
} else {
  const scratch = process.argv[2], native = process.argv[3]
  assert(scratch && /^\/private\/tmp\/bodyguard-record-journey\.[A-Za-z0-9]+$/.test(scratch))
  assert(native && /^bodyguard\/frontend\/test-results\/recordjourney-\d{8}T\d{12}Z$/.test(native))
  assert.equal(git('rev-parse', 'HEAD').toString().trim(), baseline)
  const manifest = { baseline, collectedAt: new Date().toISOString(), artifacts: {}, source: {}, unchanged: {}, public: {} }
  function archive(name, bytes) {
    const file = `evidence/${name}.gz`, compressed = gzipSync(bytes)
    mkdirSync(dirname(resolve(destination, file)), { recursive: true })
    writeFileSync(resolve(destination, file), compressed)
    manifest.artifacts[name] = { file, bytes: bytes.length, sha256: sha(bytes), gzipSha256: sha(compressed) }
  }
  for (const file of inputs) {
    const bytes = readFileSync(resolve(root, file))
    assert.equal(sha(bytes), sha(readFileSync(resolve(scratch, 'source', basename(file)))), file)
    manifest.source[file] = sha(bytes)
    archive(`source/${file}`, bytes)
  }
  const self = 'bodyguard/docs/review/record-data-journey/verify.mjs'
  manifest.source[self] = sha(readFileSync(resolve(root, self)))
  archive(`source/${self}`, readFileSync(resolve(root, self)))
  const unchanged = git('ls-tree', '-r', '--name-only', baseline, 'bodyguard/frontend/src', 'bodyguard/backend/app',
    'bodyguard/backend/migrations', 'bodyguard/frontend/pnpm-lock.yaml', 'bodyguard/backend/uv.lock',
    'bodyguard/frontend/vite.config.ts', 'bodyguard/compose.yaml').toString().trim().split('\n')
  for (const file of unchanged) manifest.unchanged[file] = sha(git('show', `${baseline}:${file}`))
  for (const file of ['unit.json', 'unit.log', 'typecheck-first.log', 'biome.log', 'ruff.log', 'native-first.log',
    'private-guard.log', 'db-init.log', 'db-ownership.log', 'db-pid.log', 'db-paths.log', 'db-stop.log', 'db-status.log'])
    archive(file, readFileSync(resolve(scratch, file)))
  archive('native-report.json', readFileSync(resolve(root, native, 'report.json')))
  archive('private-probe.js', readFileSync(resolve(scratch, 'browser-probe/probe.js')))
  const beforeRoot = '/private/tmp/bodyguard-auth-dashboard.hdyusDC5/public-after'
  for (const file of readdirSync(beforeRoot)) if (/\.(js|css)$/.test(file)) {
    archive(`public-before/${file}`, readFileSync(resolve(beforeRoot, file)))
    const after = readFileSync(resolve(root, 'bodyguard/frontend/dist/assets', file))
    archive(`public-after/${file}`, after)
    manifest.public[file] = sha(after)
  }
  const images = readdirSync(resolve(root, native), { recursive: true }).filter(file => String(file).endsWith('.png'))
  assert.equal(images.length, 2)
  for (const file of images) {
    const bytes = readFileSync(resolve(root, native, String(file)))
    archive(`screens/${basename(String(file))}`, bytes)
    writeFileSync(resolve(destination, basename(String(file))), bytes)
  }
  console.log(JSON.stringify(validate(manifest)))
  writeFileSync(resolve(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}
