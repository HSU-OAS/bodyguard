// FR-M-02/07, NFR-08: preserve the failed clock assumption, not camera/clinical evidence.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const proof = dirname(fileURLToPath(import.meta.url)), root = resolve(proof, '../../..')
const [mode, scratch] = process.argv.slice(2)
const baseline = '2f191b87fb54778beddacf2fd17f3c1ae44b15a2'
const manifestFile = resolve(proof, 'manifest.json')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const inputs = ['frontend/src/pages/MeasureDemoPage.test.tsx', 'frontend/src/pages/MeasureDemoPage.tsx',
  'frontend/src/posture/framingTrial.ts', 'frontend/src/posture/framingTrial.test.ts',
  'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/vite.config.ts',
  'docs/review/framing-harness-clock/collect.mjs']
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    assert(!item.isSymbolicLink())
    const path = resolve(directory, item.name)
    return item.isDirectory() ? files(path) : [path]
  })
}
if (mode !== '--check') {
  assert(/^\/private\/tmp\/bodyguard-framing-clock\.[A-Za-z0-9]+$/.test(scratch ?? ''))
  assert.equal(realpathSync(scratch), scratch)
}
if (mode === '--snapshot') {
  assert.equal(git('rev-parse', 'HEAD'), baseline)
  const target = resolve(scratch, 'final-source')
  assert(!existsSync(target))
  const state = { baseline, inputs: {} }
  for (const path of inputs) {
    const bytes = readFileSync(resolve(root, path))
    state.inputs[path] = sha(bytes)
    mkdirSync(dirname(resolve(target, path)), { recursive: true })
    writeFileSync(resolve(target, path), bytes, { flag: 'wx' })
  }
  writeFileSync(resolve(target, 'state.json'), JSON.stringify(state, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ captured: inputs.length }))
  process.exit(0)
}
if (mode === '--record') {
  assert(!existsSync(manifestFile) && !existsSync(resolve(proof, 'evidence')))
  const state = JSON.parse(readFileSync(resolve(scratch, 'final-source/state.json')))
  assert.equal(state.baseline, baseline)
  const first = JSON.parse(readFileSync(resolve(scratch, 'first-failure/frontend-full.json')))
  const diagnostic = JSON.parse(readFileSync(resolve(scratch, 'first-failure/clock-repro.json')))
  const final = JSON.parse(readFileSync(resolve(scratch, 'results/frontend-full.json')))
  assert.equal(first.numPassedTests, 1503)
  assert.equal(first.numFailedTests, 1)
  assert.equal(diagnostic.numFailedTests, 1)
  assert.equal(diagnostic.numPendingTests, 5)
  assert.equal(final.numPassedTests, 1505)
  assert.equal(final.numFailedTests + final.numPendingTests, 0)
  const manifest = { baseline, source: state.inputs, unchanged: {}, artifacts: {},
    first: { passed: 1503, failed: 1, originalAgeLogged: false },
    controlledCounterexample: { failed: 1, skipped: 5, ageMs: 1001 },
    final: { passed: 1505, failed: 0, pending: 0 },
    productChanged: false, clockGuardRelaxed: false, cameraOrAvatarVerified: false,
    releaseStagesCompleted: false }
  for (const path of git('ls-files', 'frontend/src', 'backend/app', 'backend/migrations',
    'frontend/package.json', 'frontend/pnpm-lock.yaml', 'frontend/vite.config.ts', 'backend/uv.lock')
    .split('\n').filter((path) => path && path !== inputs[0])) {
    const bytes = readFileSync(resolve(root, path))
    assert.equal(sha(bytes), sha(execFileSync('git', ['show', `${baseline}:bodyguard/${path}`], { cwd: root })))
    manifest.unchanged[path] = sha(bytes)
  }
  function archive(name, bytes) {
    assert(!name.includes('..') && !name.startsWith('/'))
    const path = `evidence/${name}.gz`, compressed = gzipSync(bytes)
    mkdirSync(dirname(resolve(proof, path)), { recursive: true })
    writeFileSync(resolve(proof, path), compressed, { flag: 'wx' })
    manifest.artifacts[path] = { rawSha256: sha(bytes), gzipSha256: sha(compressed), rawBytes: bytes.length }
  }
  for (const folder of ['first-failure', 'final-source', 'results', 'public-before', 'public-after'])
    for (const path of files(resolve(scratch, folder)))
      archive(`${folder}/${relative(resolve(scratch, folder), path)}`, readFileSync(path))
  const before = files(resolve(scratch, 'public-before')), after = files(resolve(scratch, 'public-after'))
  assert.equal(before.length, 2)
  assert.equal(after.length, 2)
  for (const path of before)
    assert.equal(sha(readFileSync(path)), sha(readFileSync(resolve(scratch, 'public-after', relative(resolve(scratch, 'public-before'), path)))))
  manifest.publicJsCssByteUnchanged = true
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
}
assert(['--check', '--record'].includes(mode))
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
