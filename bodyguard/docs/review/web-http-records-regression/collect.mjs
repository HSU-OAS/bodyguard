// FR-U-04/FR-R-03/NFR-08: frozen synthetic web evidence; never a release pass.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const proof = dirname(fileURLToPath(import.meta.url))
const bodyguard = resolve(proof, '../../..')
const frontend = resolve(bodyguard, 'frontend')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = (file) => JSON.parse(readFileSync(file))
const manifestFile = resolve(proof, 'manifest.json')
const [mode, scratch] = process.argv.slice(2)
assert(['--record', '--check'].includes(mode))

if (mode === '--record') {
  assert(/^\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+$/.test(scratch ?? ''))
  assert.equal(realpathSync(scratch), scratch)
  assert(
    !existsSync(manifestFile) && !existsSync(resolve(proof, 'evidence')),
    'Preserve prior evidence',
  )
  const manifest = {
    baselineHead: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: bodyguard,
      encoding: 'utf8',
    }).trim(),
    actualWebHttpSql: true,
    actualMailProvider: false,
    actualHumanCamera: false,
    actualStretchValidation: false,
    startupP2Resolved: false,
    source: {},
    artifacts: {},
    runs: [],
  }
  function archive(name, bytes) {
    assert(!name.includes('..') && !name.startsWith('/'))
    const file = `evidence/${name}.gz`
    mkdirSync(dirname(resolve(proof, file)), { recursive: true })
    const compressed = gzipSync(bytes)
    assert.equal(sha(gunzipSync(compressed)), sha(bytes))
    writeFileSync(resolve(proof, file), compressed, { flag: 'wx' })
    manifest.artifacts[file] = {
      rawSha256: sha(bytes),
      gzipSha256: sha(compressed),
      rawBytes: bytes.length,
    }
  }
  const before = json(resolve(scratch, 'evidence/before-source.json'))
  for (const [path, expected] of Object.entries(before)) {
    if (['e2e/integration.spec.ts', 'e2e/records.spec.ts'].includes(path)) continue
    assert.equal(
      sha(readFileSync(resolve(frontend, path))),
      expected,
      `Untouched product/config: ${path}`,
    )
  }
  manifest.unchangedProductConfigFiles = Object.keys(before).length - 2
  for (const file of readdirSync(resolve(scratch, 'evidence'), { withFileTypes: true })) {
    if (!file.isFile()) continue
    archive(`scratch/${file.name}`, readFileSync(resolve(scratch, 'evidence', file.name)))
  }
  const cases = [
    ['integration-red', 'integration-20261010T073531801911Z', 1, 1],
    ['records-red', 'records-20261010T073646473919Z', 10, 1],
    ['integration-first-green', 'integration-20261010T073829322394Z', 2, 0],
    ['records-final', 'records-20261010T073941309054Z', 11, 0],
    ['integration-final', 'integration-20261010T074054430933Z', 2, 0],
  ]
  for (const [label, folder, passed, failed] of cases) {
    const directory = resolve(frontend, 'test-results', folder)
    const report = json(resolve(directory, 'report.json'))
    assert.equal(report.stats.expected, passed)
    assert.equal(report.stats.unexpected, failed)
    assert.equal(report.stats.skipped + report.stats.flaky + report.errors.length, 0)
    const tests = report.suites.flatMap((suite) =>
      suite.specs.flatMap((spec) =>
        spec.tests.map((test) => ({
          title: spec.title,
          status: test.status,
          results: test.results.map((result) => ({
            status: result.status,
            retry: result.retry,
            durationMs: result.duration,
            boundary: result.attachments
              .filter((item) => item.body)
              .map((item) => ({
                name: item.name,
                value: JSON.parse(Buffer.from(item.body, 'base64')),
              })),
          })),
        })),
      ),
    )
    manifest.runs.push({ label, folder, passed, failed, tests })
    function walk(dir) {
      for (const file of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, file.name)
        if (file.isDirectory()) walk(path)
        else {
          assert(file.isFile())
          archive(`${label}/${relative(directory, path)}`, readFileSync(path))
        }
      }
    }
    walk(directory)
  }
  const unit = json(resolve(scratch, 'evidence/unit.json'))
  assert.equal(unit.success, true)
  assert.equal(unit.numTotalTests, 1481)
  assert.equal(unit.numPassedTests, unit.numTotalTests)
  assert.equal(unit.numFailedTests + unit.numPendingTests, 0)
  manifest.unit = { passed: unit.numPassedTests, failed: 0, skipped: 0 }
  for (const file of [
    'frontend/e2e/integration.spec.ts',
    'frontend/e2e/records.spec.ts',
    'frontend/playwright.account.config.ts',
    'frontend/vite.config.ts',
    'frontend/package.json',
    'frontend/pnpm-lock.yaml',
    'backend/tests/run_browser.py',
    'backend/tests/conftest.py',
    'backend/tests/test_database_ownership.py',
    'backend/uv.lock',
    'docs/review/web-http-records-regression/collect.mjs',
  ]) {
    const bytes = readFileSync(resolve(bodyguard, file))
    archive(`source/${file}`, bytes)
    manifest.source[file] = sha(bytes)
  }
  manifest.publicBundleByteIdentical = true
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
}

const manifest = json(manifestFile)
for (const [file, expected] of Object.entries(manifest.artifacts)) {
  const compressed = readFileSync(resolve(proof, file))
  assert.equal(sha(compressed), expected.gzipSha256)
  const bytes = gunzipSync(compressed)
  assert.equal(sha(bytes), expected.rawSha256)
  assert.equal(bytes.length, expected.rawBytes)
}
for (const [file, expected] of Object.entries(manifest.source))
  assert.equal(sha(readFileSync(resolve(bodyguard, file))), expected, `Current source: ${file}`)
console.log(
  JSON.stringify({
    artifacts: Object.keys(manifest.artifacts).length,
    currentSourceFiles: Object.keys(manifest.source).length,
    checked: true,
    startupP2Resolved: false,
  }),
)
