// FR-R-03/06, FR-U-04: executed integration evidence, not a release certificate.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
const proof = dirname(fileURLToPath(import.meta.url)), root = resolve(proof, '../../..')
const [mode, scratch] = process.argv.slice(2), baseline = 'd2501686b913fb9fb459be6c85e1b6ba143a39a6'
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const manifestFile = resolve(proof, 'manifest.json')
const inputs = {
  'useOwnedDashboard.ts': 'frontend/src/records/useOwnedDashboard.ts',
  'useOwnedDashboard.test.tsx': 'frontend/src/records/useOwnedDashboard.test.tsx',
  'auth.tsx': 'frontend/src/auth.tsx', 'dashboard.ts': 'frontend/src/api/dashboard.ts',
  'authdashboard.spec.ts': 'frontend/e2e/authdashboard.spec.ts',
  'authDashboardProbe.ts': 'frontend/e2e/fixtures/authDashboardProbe.ts',
  'authDashboard.vite.ts': 'frontend/e2e/fixtures/authDashboard.vite.ts',
  'playwright.account.config.ts': 'frontend/playwright.account.config.ts',
  'run_browser.py': 'backend/tests/run_browser.py',
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    assert(!item.isSymbolicLink())
    const path = resolve(directory, item.name)
    return item.isDirectory() ? files(path) : [path]
  })
}
if (mode === '--record') {
  assert(/^\/private\/tmp\/bodyguard-auth-dashboard\.[A-Za-z0-9]+$/.test(scratch ?? ''))
  assert.equal(realpathSync(scratch), scratch)
  assert.equal(git('rev-parse', 'HEAD'), baseline)
  assert(!existsSync(manifestFile) && !existsSync(resolve(proof, 'evidence')))
  const json = (name) => JSON.parse(readFileSync(resolve(scratch, name)))
  const red = json('unit-red.json'), unit = json('unit-green.json'), full = json('frontend-full.json')
  assert.equal(red.numTotalTests, 0); assert.equal(red.numFailedTestSuites, 1)
  assert.equal(unit.numPassedTests, 13); assert.equal(unit.numFailedTests + unit.numPendingTests, 0)
  assert.equal(full.numPassedTests, 1568); assert.equal(full.numFailedTests + full.numPendingTests, 0)
  const native = json('native-report.json')
  assert.equal(native.stats.expected, 6)
  assert.equal(native.stats.unexpected + native.stats.skipped + native.stats.flaky, 0)
  for (const spec of native.suites.flatMap((suite) => suite.specs)) {
    assert.equal(spec.tests.length, 1); assert.equal(spec.tests[0].results.length, 1)
    assert.equal(spec.tests[0].results[0].status, 'passed')
    const attachment = spec.tests[0].results[0].attachments.find((item) => item.name === 'auth-dashboard-boundaries.json')
    assert(attachment?.body)
    const receipt = JSON.parse(Buffer.from(attachment.body, 'base64'))
    assert.equal(receipt.actualChromeAuthProviderHttpSql, true)
    assert.equal(receipt.syntheticAccountsMailSummary, true)
    assert.equal(receipt.actualBodyOrAvatar, false)
    assert.equal(receipt.external + receipt.camera + receipt.errors, 0)
    assert.deepEqual(receipt.storage, [0, 0])
  }
  const manifest = { baseline, source: {}, unchanged: {}, artifacts: {},
    unitRed: { collectionFailures: 1, executed: 0 }, unit: { passed: 13, failed: 0 },
    frontendFull: { passed: 1568, failed: 0, pending: 0 },
    native: { passed: 6, failed: 0, skipped: 0, retries: 0 },
    actualAuthProviderChromeHttpSql: true, syntheticUsersMailSummary: true,
    controlled503AndResponseHold: true, cameraOrAvatarVerified: false,
    publicDashboardUiConnected: false, policyOrSchemaChanged: false, releaseStagesCompleted: false,
    collectorAuthoredAfterTests: true }
  for (const [flat, path] of Object.entries(inputs)) {
    const bytes = readFileSync(resolve(scratch, 'final-source', flat))
    assert.equal(sha(bytes), sha(readFileSync(resolve(root, path))), path)
    manifest.source[path] = sha(bytes)
  }
  const changed = new Set(['frontend/src/records/useOwnedDashboard.ts',
    'frontend/src/records/useOwnedDashboard.test.tsx', 'backend/tests/run_browser.py',
    'frontend/playwright.account.config.ts'])
  for (const path of git('ls-files', 'frontend/src', 'backend/app', 'backend/tests', 'backend/migrations',
    'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/vite.config.ts',
    'backend/uv.lock', 'backend/pyproject.toml').split('\n').filter(Boolean)) {
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
  for (const folder of ['red-source', 'final-source', 'public-before', 'public-after'])
    for (const path of files(resolve(scratch, folder)))
      archive(`${folder}/${relative(resolve(scratch, folder), path)}`, readFileSync(path))
  for (const name of ['unit-red.json', 'unit-red.log', 'unit-green.json', 'unit-green.log',
    'typecheck-first.log', 'typecheck.log', 'biome.log', 'frontend-full.json', 'frontend-full.log',
    'native-first.log', 'native-report.json', 'native-probe.js', 'production-guard.log',
    'runner-ruff.log', 'runner-format.log', 'owned-db-check.log', 'owned-pid-check.log',
    'owned-path-check.log', 'owned-stop.log', 'owned-status.log'])
    archive(`results/${name}`, readFileSync(resolve(scratch, name)))
  const before = files(resolve(scratch, 'public-before')), after = files(resolve(scratch, 'public-after'))
  assert.equal(before.length, 2); assert.equal(after.length, 2)
  for (const path of before)
    assert.equal(sha(readFileSync(path)),
      sha(readFileSync(resolve(scratch, 'public-after', relative(resolve(scratch, 'public-before'), path)))))
  for (const path of after.filter((path) => path.endsWith('.js')))
    assert(!/mountAuthDashboardProbe|dashboard-status|연결 검증용 화면|useOwnedDashboard/.test(readFileSync(path, 'utf8')))
  manifest.publicJsCssByteUnchanged = true
  archive('collector.mjs', readFileSync(fileURLToPath(import.meta.url)))
  manifest.source['docs/review/auth-dashboard-query/collect.mjs'] = sha(readFileSync(fileURLToPath(import.meta.url)))
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
}
assert(['--record', '--check'].includes(mode))
const manifest = JSON.parse(readFileSync(manifestFile))
for (const [path, expected] of Object.entries(manifest.artifacts)) {
  const compressed = readFileSync(resolve(proof, path)), bytes = gunzipSync(compressed)
  assert.equal(sha(compressed), expected.gzipSha256); assert.equal(sha(bytes), expected.rawSha256)
  assert.equal(bytes.length, expected.rawBytes)
}
for (const [path, expected] of Object.entries({ ...manifest.source, ...manifest.unchanged }))
  assert.equal(sha(readFileSync(resolve(root, path))), expected, path)
console.log(JSON.stringify({ checked: true, artifacts: Object.keys(manifest.artifacts).length,
  sourceFiles: Object.keys(manifest.source).length, unchangedFiles: Object.keys(manifest.unchanged).length,
  publicJsCssByteUnchanged: true, publicDashboardUiConnected: false, releaseStagesCompleted: false }))
