// FR-U-05/NFR-08: immutable test-only synthetic evidence; never a release pass.
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
const root = resolve(proof, '../../..')
const frontend = resolve(root, 'frontend')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = (file) => JSON.parse(readFileSync(file))
const manifestFile = resolve(proof, 'manifest.json')
const [mode, scratch, ...arguments_] = process.argv.slice(2)
const inputs = [
  'frontend/e2e/withdrawal.spec.ts',
  'frontend/e2e/password.spec.ts',
  'frontend/playwright.account.config.ts',
  'frontend/vite.config.ts',
  'frontend/package.json',
  'frontend/pnpm-lock.yaml',
  'backend/uv.lock',
  'backend/tests/run_browser.py',
  'backend/tests/conftest.py',
  'backend/tests/withdrawal_data_probe.py',
  'backend/tests/test_withdrawal_data_probe.py',
  'docs/review/account-data-web-lifecycle/collect.mjs',
]
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((file) => {
    const path = resolve(directory, file.name)
    assert(!file.isSymbolicLink())
    return file.isDirectory() ? files(path) : [path]
  })
}
function hashes(directory) {
  return Object.fromEntries(
    files(directory).map((file) => [relative(directory, file), sha(readFileSync(file))]),
  )
}
if (mode !== '--check') {
  assert(/^\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+$/.test(scratch ?? ''))
  assert.equal(realpathSync(scratch), scratch)
}
if (mode === '--snapshot') {
  const [label, baselineFrontend] = arguments_
  assert(/^[a-z-]+$/.test(label ?? ''))
  const directory = resolve(scratch, 'evidence', label)
  assert(!existsSync(directory), 'Never overwrite executed inputs')
  mkdirSync(directory, { recursive: true })
  const product = git(
    'ls-files',
    'frontend/src',
    'backend/app',
    'backend/migrations',
    'frontend/vite.config.ts',
    'frontend/package.json',
    'frontend/pnpm-lock.yaml',
    'backend/uv.lock',
  )
    .split('\n')
    .filter(Boolean)
  const state = { head: git('rev-parse', 'HEAD'), product: {}, inputs: {} }
  for (const file of product) {
    const bytes = readFileSync(resolve(root, file))
    assert.equal(
      sha(bytes),
      sha(execFileSync('git', ['show', `HEAD:bodyguard/${file}`], { cwd: root })),
      file,
    )
    state.product[file] = sha(bytes)
  }
  for (const file of inputs) {
    const bytes = readFileSync(resolve(root, file))
    state.inputs[file] = sha(bytes)
    mkdirSync(dirname(resolve(directory, file)), { recursive: true })
    writeFileSync(resolve(directory, file), bytes, { flag: 'wx' })
  }
  if (baselineFrontend) state.baselineBundle = hashes(resolve(baselineFrontend, 'dist'))
  writeFileSync(resolve(directory, 'state.json'), `${JSON.stringify(state, null, 2)}\n`, {
    flag: 'wx',
  })
  console.log(
    JSON.stringify({
      snapshot: label,
      unchangedProductFiles: product.length,
      inputs: inputs.length,
    }),
  )
  process.exit(0)
}
if (mode === '--record') {
  assert(
    !existsSync(manifestFile) && !existsSync(resolve(proof, 'evidence')),
    'Preserve all earlier evidence',
  )
  const before = json(resolve(scratch, 'evidence/before-web/state.json'))
  const final = json(resolve(scratch, 'evidence/final-web/state.json'))
  assert.equal(before.head, final.head)
  for (const [file, expected] of Object.entries(before.product))
    assert.equal(sha(readFileSync(resolve(root, file))), expected, file)
  assert.deepEqual(hashes(resolve(frontend, 'dist')), before.baselineBundle)
  for (const [file, expected] of Object.entries(final.inputs))
    assert.equal(sha(readFileSync(resolve(root, file))), expected, `Final executed source: ${file}`)
  const manifest = {
    baselineHead: before.head,
    unchangedProductFiles: Object.keys(before.product).length,
    publicBundleByteIdentical: true,
    actualWebHttpSql: true,
    syntheticMailData: true,
    actualHumanCamera: false,
    actualExternalMail: false,
    startupP2Resolved: false,
    source: final.inputs,
    artifacts: {},
    runs: [],
  }
  function archive(name, bytes) {
    assert(!name.includes('..') && !name.startsWith('/'))
    const file = `evidence/${name}.gz`,
      compressed = gzipSync(bytes)
    mkdirSync(dirname(resolve(proof, file)), { recursive: true })
    writeFileSync(resolve(proof, file), compressed, { flag: 'wx' })
    manifest.artifacts[file] = {
      rawSha256: sha(bytes),
      gzipSha256: sha(compressed),
      rawBytes: bytes.length,
    }
  }
  for (const file of files(resolve(scratch, 'evidence')))
    archive(`scratch/${relative(resolve(scratch, 'evidence'), file)}`, readFileSync(file))
  for (const specification of arguments_) {
    const [folder, passed, failed] = specification.split(':')
    assert(/^withdrawal-\d+T\d+Z$/.test(folder))
    const directory = resolve(frontend, 'test-results', folder),
      report = json(resolve(directory, 'report.json'))
    assert.equal(report.stats.expected, Number(passed))
    assert.equal(report.stats.unexpected, Number(failed))
    assert.equal(report.stats.skipped + report.stats.flaky + report.errors.length, 0)
    const cases = report.suites.flatMap((suite) =>
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
    assert(cases.every((test) => test.results.every((result) => result.retry === 0)))
    manifest.runs.push({ folder, passed: Number(passed), failed: Number(failed), cases })
    for (const file of files(directory))
      archive(`${folder}/${relative(directory, file)}`, readFileSync(file))
  }
  // Password uses the unchanged runner's list reporter; never invent a JSON report.
  assert(/5 passed/.test(readFileSync(resolve(scratch, 'evidence/password-final.log'), 'utf8')))
  for (const file of files(resolve(frontend, 'test-results/password')))
    archive(
      `password/${relative(resolve(frontend, 'test-results/password'), file)}`,
      readFileSync(file),
    )
  const unit = json(resolve(scratch, 'evidence/unit.json'))
  assert(unit.success && unit.numTotalTests === 1481 && unit.numPassedTests === 1481)
  assert.equal(unit.numFailedTests + unit.numPendingTests, 0)
  manifest.unit = { passed: 1481, failed: 0, skipped: 0 }
  manifest.password = { passed: 5, reporter: 'unchanged-list', jsonReport: false }
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
}
assert(['--check', '--record'].includes(mode))
const manifest = json(manifestFile)
for (const [file, expected] of Object.entries(manifest.artifacts)) {
  const compressed = readFileSync(resolve(proof, file)),
    bytes = gunzipSync(compressed)
  assert.equal(sha(compressed), expected.gzipSha256)
  assert.equal(sha(bytes), expected.rawSha256)
  assert.equal(bytes.length, expected.rawBytes)
}
for (const [file, expected] of Object.entries(manifest.source))
  assert.equal(sha(readFileSync(resolve(root, file))), expected, file)
console.log(
  JSON.stringify({
    checked: true,
    artifacts: Object.keys(manifest.artifacts).length,
    sourceFiles: Object.keys(manifest.source).length,
    startupP2Resolved: false,
  }),
)
