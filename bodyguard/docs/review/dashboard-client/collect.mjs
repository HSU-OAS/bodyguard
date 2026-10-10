// FR-R-03/06, FR-U-04: executed reader evidence; not a release certificate.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const proof = dirname(fileURLToPath(import.meta.url)), root = resolve(proof, '../../..')
const [mode, scratch] = process.argv.slice(2)
const baseline = '517cc970c1c01f99cd3b91a5111d2c732dab28f5'
const ported = 'bc7b29a793079cfb7feb5ca1998fc484876859e3'
const manifestFile = resolve(proof, 'manifest.json')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const inputs = {
  'dashboard.ts': 'frontend/src/api/dashboard.ts',
  'dashboard.test.ts': 'frontend/src/api/dashboard.test.ts',
  'dashboardclient.spec.ts': 'frontend/e2e/dashboardclient.spec.ts',
  'dashboardClient.vite.ts': 'frontend/e2e/fixtures/dashboardClient.vite.ts',
  'dashboardClientProbe.ts': 'frontend/e2e/fixtures/dashboardClientProbe.ts',
  'playwright.account.config.ts': 'frontend/playwright.account.config.ts',
  'run_browser.py': 'backend/tests/run_browser.py',
  'package.json': 'frontend/package.json',
  'pnpm-lock.yaml': 'frontend/pnpm-lock.yaml',
  'vite.config.ts': 'frontend/vite.config.ts',
  'uv.lock': 'backend/uv.lock',
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    assert(!item.isSymbolicLink())
    const path = resolve(directory, item.name)
    return item.isDirectory() ? files(path) : [path]
  })
}
const json = (name) => JSON.parse(readFileSync(resolve(scratch, name)))
function nativeResult(name, passed, failed) {
  const report = json(name)
  assert.equal(report.stats.expected, passed)
  assert.equal(report.stats.unexpected, failed)
  assert.equal(report.stats.skipped + report.stats.flaky, 0)
  for (const spec of report.suites.flatMap((suite) => suite.specs)) {
    assert.equal(spec.tests.length, 1)
    assert.equal(spec.tests[0].results.length, 1)
    const attachment = spec.tests[0].results[0].attachments.find(
      (value) => value.name === 'dashboard-client-boundaries.json',
    )
    assert(attachment?.body)
    const receipt = JSON.parse(Buffer.from(attachment.body, 'base64'))
    assert.equal(receipt.actualChromeHttpSql, true)
    assert.equal(receipt.syntheticAccountsMailSummary, true)
    assert.equal(receipt.actualBodyOrAvatar, false)
    assert.equal(receipt.external + receipt.cameras + receipt.pageErrors, 0)
    assert.deepEqual(receipt.storage, [0, 0])
  }
  return { passed, failed, skipped: 0, retries: 0 }
}
if (mode === '--record') {
  assert(/^\/private\/tmp\/bodyguard-dashboard-client\.[A-Za-z0-9]+$/.test(scratch ?? ''))
  assert.equal(realpathSync(scratch), scratch)
  assert.equal(git('rev-parse', 'HEAD'), baseline)
  assert(!existsSync(manifestFile) && !existsSync(resolve(proof, 'evidence')))
  const absence = json('unit-absence.json'), red = json('unit-ported-red.json')
  const green = json('unit-green.json'), full = json('frontend-final-full.json')
  assert.equal(absence.numTotalTests, 0)
  assert.equal(absence.numFailedTestSuites, 1)
  assert.equal(red.numPassedTests, 44)
  assert.equal(red.numFailedTests, 6)
  assert.equal(green.numPassedTests, 50)
  assert.equal(green.numFailedTests + green.numPendingTests, 0)
  assert.equal(full.numPassedTests, 1555)
  assert.equal(full.numFailedTests + full.numPendingTests, 0)
  const sql = readFileSync(resolve(scratch, 'sql-http-green.xml'), 'utf8')
  const suite = sql.match(/<testsuite\s([^>]+)>/)
  assert(suite)
  for (const [key, value] of Object.entries({ tests: 27, failures: 0, errors: 0, skipped: 0 }))
    assert.equal(Number(suite[1].match(new RegExp(`${key}="([0-9]+)"`))?.[1]), value)
  const manifest = {
    baseline, ported, source: {}, unchanged: {}, artifacts: {},
    unitAbsence: { collectionFailures: 1, executed: 0 },
    unitPorted: { passed: 44, failed: 6 }, unitGreen: { passed: 50, failed: 0 },
    frontendFinal: { passed: 1555, failed: 0, pending: 0 }, sqlHttp: { passed: 27, failed: 0 },
    nativeInitialOldCookie: nativeResult('native-initial-report.json', 1, 0),
    nativeOldCookiePathConfirmed: nativeResult('native-path-report.json', 2, 0),
    nativeControlledCurrentCsrfRed: nativeResult('native-handoff-red-report.json', 0, 1),
    nativeGreen: nativeResult('native-green-report.json', 5, 0),
    nativeReviewedGreen: nativeResult('native-reviewed-green-report.json', 5, 0),
    actualChromeHttpSql: true, syntheticUsersMailSummary: true, controlledCsrfAndDtoInjection: true,
    cameraOrAvatarVerified: false, publicDashboardUiConnected: false,
    policyOrSchemaChanged: false, releaseStagesCompleted: false,
    collectorAuthoredAfterInitialTests: true,
  }
  for (const [flat, path] of Object.entries(inputs)) {
    const bytes = readFileSync(resolve(scratch, 'final-reviewed-source', flat))
    assert.equal(sha(bytes), sha(readFileSync(resolve(root, path))), path)
    manifest.source[path] = sha(bytes)
  }
  assert.equal(sha(readFileSync(resolve(scratch, 'ported-source/dashboard.ts'))),
    sha(execFileSync('git', ['show', `${ported}:bodyguard/frontend/src/api/dashboard.ts`], { cwd: root })))
  const changed = new Set(['backend/tests/run_browser.py', 'frontend/src/api/dashboard.ts',
    'frontend/src/api/dashboard.test.ts', 'frontend/playwright.account.config.ts'])
  for (const path of git('ls-files', 'frontend/src', 'backend/app', 'backend/tests', 'backend/migrations',
    'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/vite.config.ts',
    'frontend/playwright.account.config.ts', 'backend/uv.lock', 'backend/pyproject.toml').split('\n').filter(Boolean)) {
    if (changed.has(path)) continue
    const bytes = readFileSync(resolve(root, path))
    assert.equal(sha(bytes), sha(execFileSync('git', ['show', `${baseline}:bodyguard/${path}`], { cwd: root })), path)
    manifest.unchanged[path] = sha(bytes)
  }
  function archive(name, bytes) {
    assert(!name.includes('..') && !name.startsWith('/'))
    const path = `evidence/${name}.gz`, compressed = gzipSync(bytes)
    mkdirSync(dirname(resolve(proof, path)), { recursive: true })
    writeFileSync(resolve(proof, path), compressed, { flag: 'wx' })
    manifest.artifacts[path] = { rawSha256: sha(bytes), gzipSha256: sha(compressed), rawBytes: bytes.length }
  }
  for (const folder of ['absence-source', 'ported-source', 'native-red-source',
    'final-source', 'final-reviewed-source', 'public-before', 'public-after'])
    for (const path of files(resolve(scratch, folder)))
      archive(`${folder}/${relative(resolve(scratch, folder), path)}`, readFileSync(path))
  // Private Vite copies static assets too; archive only the actually executed reader JS,
  // never imply that copied model/WASM bytes are a new avatar or SDK verification.
  for (const folder of ['native-initial-bundle', 'native-path-bundle', 'native-handoff-red-bundle',
    'native-green-bundle', 'native-reviewed-green-bundle'])
    archive(`${folder}/probe.js`, readFileSync(resolve(scratch, folder, 'probe.js')))
  for (const name of ['unit-absence.json', 'unit-absence.log', 'unit-ported-red.json',
    'unit-ported-red.log', 'unit-green.json', 'unit-green.log', 'native-red.log',
    'native-initial-report.json', 'native-path-source.ts', 'native-path.log', 'native-path-report.json',
    'native-handoff-source.ts', 'native-handoff-red.log', 'native-handoff-correct-cwd-red.log',
    'native-handoff-red-report.json', 'native-handoff-error-context.md', 'native-green.log',
    'native-green-report.json', 'native-reviewed-green.log', 'native-reviewed-green-report.json',
    'frontend-full.log', 'frontend-full.json', 'frontend-typecheck.log', 'frontend-biome.log',
    'frontend-import-fix.log', 'frontend-build.log', 'frontend-guard.log',
    'frontend-final-full.log', 'frontend-final-full.json', 'frontend-final-typecheck.log',
    'frontend-final-biome.log', 'frontend-final-build.log', 'frontend-final-guard.log',
    'backend-ruff.log', 'backend-format.log', 'backend-mypy.log', 'sql-http-green.log',
    'sql-http-green.xml', 'owned-db-check.log', 'owned-stop.log', 'owned-status.log', 'ownership-note.md'])
    archive(`results/${name}`, readFileSync(resolve(scratch, name)))
  const before = files(resolve(scratch, 'public-before')), after = files(resolve(scratch, 'public-after'))
  assert.equal(before.length, 2)
  assert.equal(after.length, 2)
  for (const path of before)
    assert.equal(sha(readFileSync(path)),
      sha(readFileSync(resolve(scratch, 'public-after', relative(resolve(scratch, 'public-before'), path)))))
  manifest.publicJsCssByteUnchanged = true
  manifest.source['docs/review/dashboard-client/collect.mjs'] = sha(readFileSync(fileURLToPath(import.meta.url)))
  archive('collector.mjs', readFileSync(fileURLToPath(import.meta.url)))
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
}
assert(['--record', '--check'].includes(mode))
const manifest = JSON.parse(readFileSync(manifestFile))
for (const [path, expected] of Object.entries(manifest.artifacts)) {
  const compressed = readFileSync(resolve(proof, path)), bytes = gunzipSync(compressed)
  assert.equal(sha(compressed), expected.gzipSha256)
  assert.equal(sha(bytes), expected.rawSha256)
  assert.equal(bytes.length, expected.rawBytes)
}
for (const [path, expected] of Object.entries({ ...manifest.source, ...manifest.unchanged }))
  assert.equal(sha(readFileSync(resolve(root, path))), expected, path)
console.log(JSON.stringify({ checked: true, artifacts: Object.keys(manifest.artifacts).length,
  sourceFiles: Object.keys(manifest.source).length, unchangedFiles: Object.keys(manifest.unchanged).length,
  publicJsCssByteUnchanged: true, publicDashboardUiConnected: false, releaseStagesCompleted: false }))
