// FR-U-04/05, NFR-08: executed native evidence, not a release or privacy-policy approval.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const proof = dirname(fileURLToPath(import.meta.url))
const root = resolve(proof, '../../..')
const [mode, scratch] = process.argv.slice(2)
const manifestFile = resolve(proof, 'manifest.json')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const changed = ['backend/app/readiness.py', 'backend/tests/test_readiness_constraints.py']
const artifacts = [
  'initdb.log', 'red.log', 'red.xml', 'red-readiness.py', 'red-test_readiness_constraints.py',
  'green-first.log', 'green-first.xml', 'backend-full.log', 'backend-full.xml',
  'full-readiness.py', 'full-test_readiness_constraints.py', 'native-final.log', 'native-final.xml',
  'final-readiness.py', 'final-test_readiness_constraints.py',
  'static-first.log', 'static-final.log', 'static-baseline-old-test.log', 'static-fixed.log',
  'ruff-final.log', 'ruff-fixed.log', 'schema-final.log', 'schema-baseline.log',
  'owned-stop.log',
]
function suite(file, tests, failures) {
  const xml = readFileSync(resolve(scratch, file), 'utf8')
  const header = xml.match(/<testsuite\s[^>]+>/)?.[0]
  assert(header, file)
  for (const [name, expected] of Object.entries({ tests, failures, errors: 0, skipped: 0 }))
    assert.equal(Number(header.match(new RegExp(`${name}="([0-9]+)"`))?.[1]), expected, file)
  return { tests, passed: tests - failures, failures, errors: 0, skipped: 0 }
}
if (mode === '--record') {
  assert(/^\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+$/.test(scratch ?? ''))
  assert.equal(realpathSync(scratch), scratch)
  assert(!existsSync(manifestFile) && !existsSync(resolve(proof, 'evidence')), 'Never replace evidence')
  const baseline = '9f589776de80c8d9f3a41a8f8fe1252e58858bde'
  assert.equal(git('rev-parse', 'HEAD'), baseline)
  const product = git('ls-files', 'frontend/src', 'backend/app', 'backend/migrations',
    'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/vite.config.ts', 'backend/uv.lock')
    .split('\n').filter((file) => file && file !== changed[0])
  const unchanged = {}
  for (const file of product) {
    const bytes = readFileSync(resolve(root, file))
    assert.equal(sha(bytes), sha(execFileSync('git', ['show', `${baseline}:bodyguard/${file}`], { cwd: root })), file)
    unchanged[file] = sha(bytes)
  }
  const inputs = [...new Set([
    ...git('ls-files', 'backend/app', 'backend/tests', 'backend/migrations',
      'backend/uv.lock', 'backend/pyproject.toml', 'backend/alembic.ini').split('\n').filter(Boolean),
    changed[1], 'docs/review/readiness-owned-constraints/collect.mjs',
  ])]
  const manifest = {
    baseline, productChange: changed[0], unchanged, source: {}, artifacts: {},
    actualNativePostgres18: true, actualLoopbackHttp: true,
    actualBrowserOrHumanOrProviderOrHttps: false, avatarAuthoredOrVerified: false,
    schemaPolicyOrMigrationChanged: false, startupP2Resolved: false, releaseStagesCompleted: false,
    runs: { red: suite('red.xml', 22, 20), intermediate: suite('green-first.xml', 41, 0),
      full: suite('backend-full.xml', 509, 0), finalReadiness: suite('native-final.xml', 44, 0) },
    fullTestSource: 'evidence/full-test_readiness_constraints.py.gz',
    finalTestSource: 'evidence/final-test_readiness_constraints.py.gz',
    intermediateExactTestSnapshot: false,
  }
  assert.equal(sha(readFileSync(resolve(scratch, 'full-readiness.py'))), sha(readFileSync(resolve(root, changed[0]))))
  assert.equal(sha(readFileSync(resolve(scratch, 'final-readiness.py'))), sha(readFileSync(resolve(root, changed[0]))))
  assert.equal(sha(readFileSync(resolve(scratch, 'final-test_readiness_constraints.py'))), sha(readFileSync(resolve(root, changed[1]))))
  assert.equal(readFileSync(resolve(scratch, 'schema-final.log'), 'utf8'), readFileSync(resolve(scratch, 'schema-baseline.log'), 'utf8'))
  assert(/Success: no issues found in 12 source files/.test(readFileSync(resolve(scratch, 'static-fixed.log'), 'utf8')))
  assert(/Found 12 errors in 1 file/.test(readFileSync(resolve(scratch, 'static-baseline-old-test.log'), 'utf8')))
  for (const file of inputs) manifest.source[file] = sha(readFileSync(resolve(root, file)))
  mkdirSync(resolve(proof, 'evidence'))
  for (const name of artifacts) {
    const bytes = readFileSync(resolve(scratch, name)), compressed = gzipSync(bytes)
    const file = `evidence/${name}.gz`
    writeFileSync(resolve(proof, file), compressed, { flag: 'wx' })
    manifest.artifacts[file] = { rawSha256: sha(bytes), gzipSha256: sha(compressed), rawBytes: bytes.length }
  }
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
}
assert(['--record', '--check'].includes(mode))
const manifest = JSON.parse(readFileSync(manifestFile))
for (const [file, expected] of Object.entries(manifest.artifacts)) {
  const compressed = readFileSync(resolve(proof, file)), bytes = gunzipSync(compressed)
  assert.equal(sha(compressed), expected.gzipSha256)
  assert.equal(sha(bytes), expected.rawSha256)
  assert.equal(bytes.length, expected.rawBytes)
}
for (const [file, expected] of Object.entries(manifest.source))
  assert.equal(sha(readFileSync(resolve(root, file))), expected, file)
for (const [file, expected] of Object.entries(manifest.unchanged))
  assert.equal(sha(readFileSync(resolve(root, file))), expected, file)
console.log(JSON.stringify({ checked: true, artifacts: Object.keys(manifest.artifacts).length,
  sourceFiles: Object.keys(manifest.source).length, unchangedProductFiles: Object.keys(manifest.unchanged).length,
  actualLoopbackHttp: true, actualBrowser: false, stagesCompleted: false }))
