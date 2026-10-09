// Mechanical preservation of private synthetic tests. No actual camera/body export.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const out = dirname(fileURLToPath(import.meta.url)), root = resolve(out, '../../../..')
const proof = '/private/tmp/bodyguard-native-feedback-proof.mqJwGB'
const base = 'e2360f6989c4454f0b320c70eb0578217dfacb77'
const historical = '884700e3cebfce2b1c0c51fdca2cce4788e6dc4b'
const sha = b => createHash('sha256').update(b).digest('hex')
const files = [], sources = []
// FR-R-03/NFR-08: explicit test artifacts only. Later GitHub metadata may contain
// temporary credentials; never sweep the proof directory into repository evidence.
const labels = [
  'assets-final', 'biome-final', 'biome-first', 'build-final', 'db-create-start',
  'db-create-stop', 'db-create', 'db-init', 'frontend-unit', 'guard-corrected',
  'guard-final', 'missing-neck-contract', 'original-contract', 'typecheck-final', 'typecheck-first',
  ...['neck-final-male', 'neck-final-female', 'default-male', 'default-female'].flatMap(label =>
    ['browser', 'db-start', 'db-stop', 'identity'].map(suffix => label + '-' + suffix)),
  'neck-male-db-start', 'neck-male-db-stop', 'neck-male-identity',
]
const allowed = new Set([
  'base-probe.ts', 'browser-before-db-order-fix.mjs', 'browser.mjs',
  'missing-neck-contract.spec.ts', 'run.mjs', 'unit-results.json',
  ...labels.flatMap(label => ['.receipt.json', '.stderr.txt', '.stdout.txt'].map(suffix => label + suffix)),
  ...['neck-final-male', 'neck-final-female', 'default-male', 'default-female'].flatMap(label =>
    ['-source-before.json', '-source-after.json'].map(suffix => label + suffix)),
])
const selected = readdirSync(proof).sort().filter(name => allowed.has(name))
if (process.argv.includes('--list')) {
  console.log(JSON.stringify(selected)); process.exit(0)
}
function save(name, bytes, collection, extra = {}) {
  assert(/^[A-Za-z0-9_.-]+$/.test(name))
  const file = name + '.gz', compressed = gzipSync(bytes, { level: 9 }), path = resolve(out, file)
  if (existsSync(path)) assert.equal(sha(readFileSync(path)), sha(compressed), 'Do not overwrite evidence')
  else writeFileSync(path, compressed, { flag: 'wx' })
  collection.push({ file, bytes: bytes.length, sha256: sha(bytes), compressedSha256: sha(compressed), ...extra })
}
for (const name of selected) {
  save('local-' + name, readFileSync(resolve(proof, name)), files, { origin: proof + '/' + name })
}
save('test-cli-dispatcher', readFileSync(resolve(proof, 'bin/pnpm')), files)
const git = (...args) => execFileSync('git', args, { cwd: root })
save('original-nativehead.spec.ts', git('show', historical + ':bodyguard/frontend/e2e/nativehead.spec.ts'), files)
save('original-nativeHeadAuthProbe.ts', git('show', historical + ':bodyguard/frontend/e2e/fixtures/nativeHeadAuthProbe.ts'), files)
save('original-nativePlaybackResources.ts', git('show', historical + ':bodyguard/frontend/src/coaching/nativePlaybackResources.ts'), files)
save('original-failed-summary.json', git('show', historical + ':bodyguard/docs/review/native-neck/summary.json'), files)
const bundles = new Map(), browser = []
const resultRoot = resolve(root, 'bodyguard/frontend/test-results')
const reports = readdirSync(resultRoot).filter(n => n.startsWith('nativefeedback-')).map(name => {
  const path = resolve(resultRoot, name, 'report.json')
  return existsSync(path) ? { name, path, report: JSON.parse(readFileSync(path)) } : null
}).filter(Boolean)
for (const [label, mode, gender] of [
  ['neck-final-male', 'neck', 'male'], ['neck-final-female', 'neck', 'female'],
  ['default-male', 'default', 'male'], ['default-female', 'default', 'female'],
]) {
  const receipt = JSON.parse(readFileSync(resolve(proof, label + '-browser.receipt.json')))
  assert.equal(receipt.status, 0)
  const matched = reports.filter(r => Date.parse(r.report.stats.startTime) >= Date.parse(receipt.start) && Date.parse(r.report.stats.startTime) <= Date.parse(receipt.end))
  assert.equal(matched.length, 1)
  const selected = matched[0], dir = resolve(resultRoot, selected.name), rows = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const caseDir = resolve(dir, entry.name)
    for (const file of readdirSync(caseDir)) {
      if (!/^(before-close|native-hands-summary|native-startup-timing)\.json$/.test(file) && !file.endsWith('.png')) continue
      const saved = 'browser-' + browser.length + '-' + rows.length + '-' + file
      save(saved, readFileSync(resolve(caseDir, file)), files)
      rows.push({ file: saved + '.gz', case: entry.name, kind: file })
    }
  }
  const reportName = 'browser-' + browser.length + '-report.json'
  save(reportName, readFileSync(selected.path), files)
  browser.push({ label, mode, gender, original: selected.name, report: reportName + '.gz', stats: selected.report.stats, rows })
  const bundleDir = resolve(proof, 'probe-' + label)
  for (const file of ['probe.js', ...readdirSync(resolve(bundleDir, 'assets')).map(n => 'assets/' + n)]) {
    const b = readFileSync(resolve(bundleDir, file)), hash = sha(b)
    if (!bundles.has(hash)) {
      const saved = 'bundle-' + bundles.size + '-' + file.replaceAll('/', '-')
      save(saved, b, files); bundles.set(hash, { file: saved + '.gz', origins: [] })
    }
    bundles.get(hash).origins.push(bundleDir + '/' + file)
  }
}
for (const path of [
  'bodyguard/frontend/e2e/fixtures/nativeHeadAuthProbe.ts', 'bodyguard/frontend/e2e/nativehead.spec.ts',
  'bodyguard/frontend/src/posture/neckSideObservation.ts', 'bodyguard/frontend/src/posture/capturedImage.ts',
  'bodyguard/frontend/src/coaching/nativePlaybackResources.ts', 'bodyguard/frontend/src/coaching/useRecordedCoaching.ts',
  'bodyguard/frontend/src/coaching/recordedSession.ts', 'bodyguard/frontend/src/auth.tsx',
  'bodyguard/frontend/src/pose/ownedPoseFrame.ts', 'bodyguard/frontend/playwright.account.config.ts',
  'bodyguard/frontend/e2e/fixtures/nativeHead.vite.ts', 'bodyguard/backend/tests/run_browser.py',
  'bodyguard/docs/review/native-neck-full-regression/compare-original.mjs',
]) {
  save('source-' + path.replaceAll('/', '-'), readFileSync(resolve(root, path)), sources, { path })
  if (!path.endsWith('compare-original.mjs')) save('base-' + path.replaceAll('/', '-'), git('show', base + ':' + path), files)
}
const assets = ['male.glb', 'female.glb', 'authored-fixture.json'].map(file => {
  const b = readFileSync(resolve(proof, file)); return { file, bytes: b.length, sha256: sha(b), source: file.endsWith('.glb') ? '25a9bd6 original A37' : 'Existing Blender-authored synthetic fixture' }
})
const publicAssets = readdirSync(resolve(root, 'bodyguard/frontend/dist/assets')).filter(n => /\.(js|css)$/.test(n)).map(file => {
  const b = readFileSync(resolve(root, 'bodyguard/frontend/dist/assets', file)); return { file, bytes: b.length, sha256: sha(b) }
})
const sdkAssets = ['models', 'mediapipe/wasm'].flatMap(dir => readdirSync(resolve(root, 'bodyguard/frontend/public', dir)).map(file => {
  const b = readFileSync(resolve(root, 'bodyguard/frontend/public', dir, file)); return { file: dir + '/' + file, bytes: b.length, sha256: sha(b) }
}))
const versions = Object.fromEntries(['@mediapipe/tasks-vision', 'three'].map(name => [name, JSON.parse(readFileSync(resolve(root, 'bodyguard/frontend/node_modules', name, 'package.json'))).version]))
const manifest = { base, historical, actualHuman: false, actualCamera: false, productPolicyApproved: false, historicalFailureResolved: false, sameHistoricalEnvironment: false, rendererPreparationTested: false, files, sources, browser, bundles: [...bundles.values()], assets, publicAssets, sdkAssets, versions }
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ files: files.length, sources: sources.length, browserRuns: browser.length }))
