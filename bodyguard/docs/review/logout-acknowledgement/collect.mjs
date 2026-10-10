// FR-U-04/NFR-08: exact executed source and immutable failure evidence, not a release pass.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const proof = dirname(fileURLToPath(import.meta.url)), root = resolve(proof, '../../..')
const [mode, scratch, label, ...runs] = process.argv.slice(2)
const manifestFile = resolve(proof, 'manifest.json')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const inputs = ['frontend/src/api/auth.ts', 'frontend/src/auth.tsx', 'frontend/src/logout.test.tsx',
  'frontend/e2e/account.spec.ts', 'frontend/playwright.account.config.ts', 'frontend/vite.config.ts',
  'frontend/package.json', 'frontend/pnpm-lock.yaml', 'backend/tests/run_browser.py',
  'backend/tests/conftest.py', 'backend/uv.lock', 'docs/review/logout-acknowledgement/collect.mjs']
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    assert(!item.isSymbolicLink())
    const file = resolve(directory, item.name)
    return item.isDirectory() ? files(file) : [file]
  })
}
if (mode !== '--check') {
  assert(/^\/private\/tmp\/bodyguard-auth-test\.[A-Za-z0-9]+$/.test(scratch ?? ''))
  assert.equal(realpathSync(scratch), scratch)
}
if (mode === '--snapshot') {
  assert(/^(before|final)$/.test(label))
  const target = resolve(scratch, 'source', label)
  assert(!existsSync(target), 'Never replace executed source')
  const state = { head: git('rev-parse', 'HEAD'), inputs: {} }
  for (const file of inputs) {
    const bytes = readFileSync(resolve(root, file))
    state.inputs[file] = sha(bytes)
    mkdirSync(dirname(resolve(target, file)), { recursive: true })
    writeFileSync(resolve(target, file), bytes, { flag: 'wx' })
  }
  writeFileSync(resolve(target, 'state.json'), JSON.stringify(state, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ snapshot: label, sourceFiles: inputs.length }))
  process.exit(0)
}
if (mode === '--record') {
  assert(!existsSync(manifestFile) && !existsSync(resolve(proof, 'evidence')))
  const before = JSON.parse(readFileSync(resolve(scratch, 'source/before/state.json')))
  const final = JSON.parse(readFileSync(resolve(scratch, 'source/final/state.json')))
  assert.equal(before.head, 'ced8c9b56b721fab29806a9367ea424ef4103692')
  assert.equal(final.head, before.head)
  const manifest = { baseline: before.head, source: final.inputs, unchanged: {}, artifacts: {}, runs: [],
    actualWebHttpSql: true, wrongLogoutResponseInjected: true, actualProviderOrCamera: false,
    avatarAuthoredOrVerified: false, schemaPolicyChanged: false, startupP2Resolved: false,
    releaseStagesCompleted: false }
  for (const file of git('ls-files', 'frontend/src', 'backend/app', 'backend/migrations',
    'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/vite.config.ts', 'backend/uv.lock')
    .split('\n').filter((file) => file && file !== 'frontend/src/api/auth.ts')) {
    const bytes = readFileSync(resolve(root, file))
    assert.equal(sha(bytes), sha(execFileSync('git', ['show', before.head + ':bodyguard/' + file], { cwd: root })))
    manifest.unchanged[file] = sha(bytes)
  }
  function archive(name, bytes) {
    assert(!name.includes('..') && !name.startsWith('/'))
    const file = 'evidence/' + name + '.gz', compressed = gzipSync(bytes)
    mkdirSync(dirname(resolve(proof, file)), { recursive: true })
    writeFileSync(resolve(proof, file), compressed, { flag: 'wx' })
    manifest.artifacts[file] = { rawSha256: sha(bytes), gzipSha256: sha(compressed), rawBytes: bytes.length }
  }
  for (const file of files(resolve(scratch, 'source')))
    archive('source/' + relative(resolve(scratch, 'source'), file), readFileSync(file))
  for (const file of files(resolve(scratch, 'results')))
    archive('results/' + relative(resolve(scratch, 'results'), file), readFileSync(file))
  for (const specification of [label, ...runs]) {
    const [folder, passed, failed] = specification.split(':')
    assert(/^account-\d+T\d+Z$/.test(folder))
    const directory = resolve(root, 'frontend/test-results', folder)
    const report = JSON.parse(readFileSync(resolve(directory, 'report.json')))
    assert.equal(report.stats.expected, Number(passed))
    assert.equal(report.stats.unexpected, Number(failed))
    assert.equal(report.stats.skipped + report.stats.flaky + report.errors.length, 0)
    const cases = []
    for (const suite of report.suites) for (const spec of suite.specs) for (const test of spec.tests)
      for (const result of test.results) {
        assert.equal(result.retry, 0)
        cases.push({ title: spec.title, status: result.status, durationMs: result.duration,
          boundaries: result.attachments.filter((item) => item.body).map((item) => ({
            name: item.name, value: JSON.parse(Buffer.from(item.body, 'base64').toString()),
          })) })
      }
    manifest.runs.push({ folder, passed: Number(passed), failed: Number(failed), cases })
    for (const file of files(directory)) archive(folder + '/' + relative(directory, file), readFileSync(file))
  }
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
}
assert(['--check', '--record'].includes(mode))
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
  releaseStagesCompleted: false }))
