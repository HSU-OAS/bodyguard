// Mechanical evidence preservation only: fixed private fixture, no camera/human output.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const out = dirname(fileURLToPath(import.meta.url)), root = resolve(out, '../../../..')
const proof = '/private/tmp/bodyguard-native-feedback-proof.b0hre9'
const base = 'c15608a5696349fe6b47e156382f9efd7e44fa0c'
const sha = (b) => createHash('sha256').update(b).digest('hex')
const files = [], sources = []
function save(name, bytes, collection, extra = {}) {
  assert(/^[A-Za-z0-9_.-]+$/.test(name))
  const file = name + '.gz', compressed = gzipSync(bytes, { level: 9 }), path = resolve(out, file)
  if (existsSync(path)) assert.equal(sha(readFileSync(path)), sha(compressed), 'Do not overwrite evidence')
  else writeFileSync(path, compressed, { flag: 'wx' })
  collection.push({ file, bytes: bytes.length, sha256: sha(bytes), compressedSha256: sha(compressed), ...extra })
}
for (const name of readdirSync(proof).sort()) {
  if (!/\.(json|mjs|txt|ts)$/.test(name) || name === 'authored-fixture.json') continue
  save('local-' + name, readFileSync(resolve(proof, name)), files, { origin: proof + '/' + name })
}
save('test-cli-dispatcher', readFileSync(resolve(proof, 'bin/pnpm')), files)
const bundles = new Map()
for (const name of ['probe-prepared-male', 'probe-actual-male', 'probe-final-male', 'probe-final-female', 'probe-baseline-male', 'probe-baseline-female']) {
  const dir = resolve(proof, name)
  for (const file of ['probe.js', ...readdirSync(resolve(dir, 'assets')).map(n => 'assets/' + n)]) {
    const bytes = readFileSync(resolve(dir, file)), hash = sha(bytes)
    if (!bundles.has(hash)) {
      const saved = 'bundle-' + bundles.size + '-' + file.replaceAll('/', '-')
      save(saved, bytes, files)
      bundles.set(hash, { file: saved + '.gz', origins: [] })
    }
    bundles.get(hash).origins.push(dir + '/' + file)
  }
}
const browser = []
const resultRoot = resolve(root, 'bodyguard/frontend/test-results')
for (const name of readdirSync(resultRoot).filter(n => n.startsWith('nativefeedback-')).sort()) {
  const dir = resolve(resultRoot, name), report = JSON.parse(readFileSync(resolve(dir, 'report.json')))
  const rows = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory())) {
    const caseDir = resolve(dir, entry.name)
    for (const file of readdirSync(caseDir)) {
      if (!/^(before-close|native-hands-summary|native-startup-timing)\.json$/.test(file) && !file.endsWith('.png')) continue
      const bytes = readFileSync(resolve(caseDir, file)), saved = 'browser-' + browser.length + '-' + rows.length + '-' + file
      save(saved, bytes, files)
      rows.push({ file: saved + '.gz', case: entry.name, kind: file })
    }
  }
  save('browser-' + browser.length + '-report.json', readFileSync(resolve(dir, 'report.json')), files)
  browser.push({ original: relative(root, dir), report: 'browser-' + browser.length + '-report.json.gz', stats: report.stats, rows })
}
const paths = [
  'bodyguard/frontend/src/avatar/prepareAvatarStage.ts',
  'bodyguard/frontend/src/avatar/prepareAvatarStage.test.ts',
  'bodyguard/frontend/e2e/fixtures/nativeHeadAuthProbe.ts',
  'bodyguard/frontend/e2e/nativehead.spec.ts',
  'bodyguard/backend/tests/run_browser.py',
  'bodyguard/frontend/src/coaching/nativePlaybackResources.ts',
  'bodyguard/frontend/src/coaching/ownedPlaybackResources.ts',
  'bodyguard/frontend/src/coaching/useRecordedCoaching.ts',
  'bodyguard/frontend/src/coaching/recordedSession.ts',
  'bodyguard/frontend/src/auth.tsx',
  'bodyguard/frontend/playwright.account.config.ts',
  'bodyguard/frontend/e2e/fixtures/nativeHead.vite.ts',
]
for (const path of paths) {
  save('source-' + path.replaceAll('/', '-'), readFileSync(resolve(root, path)), sources, { path })
  if (!path.includes('prepareAvatarStage'))
    save('base-' + path.replaceAll('/', '-'), execFileSync('git', ['show', base + ':' + path], { cwd: root }), files)
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
const manifest = { base, actualHuman: false, actualCamera: false, productPolicyApproved: false, original26Passed: false, files, sources, browser, bundles: [...bundles.values()], assets, publicAssets, sdkAssets, versions }
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ files: files.length, sources: sources.length, browserRuns: browser.length }))
