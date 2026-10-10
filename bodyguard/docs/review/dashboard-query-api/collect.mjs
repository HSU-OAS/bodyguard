// FR-R-03/06, FR-U-04: executed API inputs/failures, not a full release certificate.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const proof = dirname(fileURLToPath(import.meta.url)), root = resolve(proof, '../../..')
const [mode, scratch, integratedMain] = process.argv.slice(2)
const baseline = '2f191b87fb54778beddacf2fd17f3c1ae44b15a2', ported = 'bc7b29a793079cfb7feb5ca1998fc484876859e3'
const manifestFile = resolve(proof, 'manifest.json')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const inputs = { 'dashboard.py': 'backend/app/dashboard.py', 'summaries.py': 'backend/app/summaries.py',
  'main.py': 'backend/app/main.py', 'test_dashboard.py': 'backend/tests/test_dashboard.py',
  'test_dashboard_http.py': 'backend/tests/test_dashboard_http.py', 'conftest.py': 'backend/tests/conftest.py',
  'test_summaries.py': 'backend/tests/test_summaries.py', 'test_baselines.py': 'backend/tests/test_baselines.py',
  'uv.lock': 'backend/uv.lock', 'generate-api.mjs': 'frontend/scripts/generate-api.mjs',
  'index.ts': 'frontend/src/api/generated/index.ts', 'types.gen.ts': 'frontend/src/api/generated/types.gen.ts',
  'package.json': 'frontend/package.json', 'pnpm-lock.yaml': 'frontend/pnpm-lock.yaml', 'vite.config.ts': 'frontend/vite.config.ts' }
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    assert(!item.isSymbolicLink())
    const path = resolve(directory, item.name)
    return item.isDirectory() ? files(path) : [path]
  })
}
function sqlResult(name) {
  const xml = readFileSync(resolve(scratch, `${name}.xml`), 'utf8')
  const suite = xml.match(/<testsuite\s([^>]+)>/)
  assert(suite)
  const attr = (key) => Number(suite[1].match(new RegExp(`${key}="([0-9]+)"`))?.[1])
  const result = { tests: attr('tests'), failed: attr('failures'), errors: attr('errors'), skipped: attr('skipped') }
  assert(Object.values(result).every(Number.isInteger))
  return result
}
if (mode === '--record') {
  assert(/^\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+$/.test(scratch ?? ''))
  assert.equal(realpathSync(scratch), scratch)
  assert(/^[a-f0-9]{40}$/.test(integratedMain ?? ''))
  assert.equal(git('rev-parse', 'HEAD'), integratedMain)
  assert(!existsSync(manifestFile) && !existsSync(resolve(proof, 'evidence')))
  execFileSync('git', ['merge-base', '--is-ancestor', baseline, integratedMain], { cwd: root })
  const runs = Object.fromEntries(['sql-red', 'http-red', 'sql-http-green', 'backend-full'].map((name) => [name, sqlResult(name)]))
  assert.deepEqual(runs['sql-red'], { tests: 26, failed: 26, errors: 0, skipped: 0 })
  assert.deepEqual(runs['http-red'], { tests: 1, failed: 1, errors: 0, skipped: 0 })
  assert.deepEqual(runs['sql-http-green'], { tests: 27, failed: 0, errors: 0, skipped: 0 })
  assert.deepEqual(runs['backend-full'], { tests: 536, failed: 0, errors: 0, skipped: 0 })
  const first = JSON.parse(readFileSync(resolve(scratch, 'frontend-full.json')))
  const final = JSON.parse(readFileSync(resolve(scratch, 'frontend-integrated.json')))
  assert.equal(first.numPassedTests, 1503)
  assert.equal(first.numFailedTests, 1)
  assert.equal(final.numPassedTests, 1505)
  assert.equal(final.numFailedTests + final.numPendingTests, 0)
  const manifest = { baseline, integratedMain, ported, source: {}, unchanged: {}, artifacts: {}, runs,
    frontendFirst: { passed: 1503, failed: 1 }, frontendIntegrated: { passed: 1505, failed: 0, pending: 0 },
    frontendFailureResolvedBySeparatePr: 115, actualHttpSql: true, actualBrowser: false,
    cameraOrAvatarVerified: false, policyOrSchemaChanged: false, releaseStagesCompleted: false,
    collectorAuthoredAfterInitialTests: true }
  for (const [flat, path] of Object.entries(inputs)) {
    const bytes = readFileSync(resolve(scratch, 'final-source', flat))
    assert.equal(sha(bytes), sha(readFileSync(resolve(root, path))), path)
    manifest.source[path] = sha(bytes)
  }
  const framingPath = 'frontend/src/pages/MeasureDemoPage.test.tsx'
  const framing = readFileSync(resolve(scratch, 'integrated-framing-test.tsx'))
  assert.equal(sha(framing), sha(readFileSync(resolve(root, framingPath))))
  manifest.source[framingPath] = sha(framing)
  for (const path of ['backend/app/dashboard.py', 'backend/tests/test_dashboard.py'])
    assert.equal(sha(readFileSync(resolve(root, path))), sha(execFileSync('git', ['show', `${ported}:bodyguard/${path}`], { cwd: root })))
  const changed = new Set(['backend/app/summaries.py', 'frontend/src/api/generated/index.ts', 'frontend/src/api/generated/types.gen.ts'])
  for (const path of git('ls-files', 'frontend/src', 'backend/app', 'backend/tests', 'backend/migrations',
    'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/vite.config.ts', 'backend/uv.lock', 'backend/pyproject.toml').split('\n').filter(Boolean)) {
    if (changed.has(path)) continue
    const bytes = readFileSync(resolve(root, path))
    assert.equal(sha(bytes), sha(execFileSync('git', ['show', `${integratedMain}:bodyguard/${path}`], { cwd: root })))
    manifest.unchanged[path] = sha(bytes)
  }
  function archive(name, bytes) {
    assert(!name.includes('..') && !name.startsWith('/'))
    const path = `evidence/${name}.gz`, compressed = gzipSync(bytes)
    mkdirSync(dirname(resolve(proof, path)), { recursive: true })
    writeFileSync(resolve(proof, path), compressed, { flag: 'wx' })
    manifest.artifacts[path] = { rawSha256: sha(bytes), gzipSha256: sha(compressed), rawBytes: bytes.length }
  }
  for (const folder of ['red-source', 'final-source', 'public-before', 'public-after', 'public-integrated'])
    for (const path of files(resolve(scratch, folder)))
      archive(`${folder}/${relative(resolve(scratch, folder), path)}`, readFileSync(path))
  for (const name of ['sql-red.log', 'sql-red.xml', 'http-red.log', 'http-red.xml',
    'sql-http-green.log', 'sql-http-green.xml', 'backend-full.log', 'backend-full.xml',
    'backend-ruff.log', 'backend-format.log', 'backend-mypy.log', 'openapi-generation.log',
    'frontend-full.log', 'frontend-full.json', 'frontend-typecheck.log', 'frontend-biome.log',
    'frontend-build.log', 'frontend-guard.log', 'frontend-build-cached.log', 'frontend-guard-final.log',
    'frontend-integrated.log', 'frontend-integrated.json', 'frontend-integrated-typecheck.log',
    'frontend-integrated-biome.log', 'frontend-integrated-build.log', 'frontend-integrated-guard.log',
    'integrated-framing-test.tsx', 'owned-stop.log'])
    archive(`results/${name}`, readFileSync(resolve(scratch, name)))
  const before = files(resolve(scratch, 'public-before')), after = files(resolve(scratch, 'public-after')),
    integrated = files(resolve(scratch, 'public-integrated'))
  assert.equal(before.length, 2)
  assert.equal(after.length, 2)
  assert.equal(integrated.length, 2)
  for (const path of before) {
    assert.equal(sha(readFileSync(path)), sha(readFileSync(resolve(scratch, 'public-after', relative(resolve(scratch, 'public-before'), path)))))
    assert.equal(sha(readFileSync(path)), sha(readFileSync(resolve(scratch, 'public-integrated', relative(resolve(scratch, 'public-before'), path)))))
  }
  manifest.publicJsCssByteUnchanged = true
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
  sourceFiles: Object.keys(manifest.source).length, unchangedProductFiles: Object.keys(manifest.unchanged).length,
  publicJsCssByteUnchanged: true, releaseStagesCompleted: false }))
