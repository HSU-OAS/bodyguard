// FR-M-02/07/NFR-08: actual local gate outputs, immutable failure/source evidence.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'

const [scratch, productScratch, priorProduct] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-motion-framing\.[A-Za-z0-9]+$/.test(scratch))
for (const path of [productScratch, priorProduct])
  assert(/^\/private\/tmp\/bodyguard-camera-preparation\.[A-Za-z0-9]+$/.test(path))
const root = resolve('../docs/review/camera-input-handoff')
const baseMain = '7ed34fb64994f3b6758eb8be5fbc0de7e1d897ff'
const hash = (data) => createHash('sha256').update(data).digest('hex')
const artifacts = []
function preserve(name, data) {
  const target = `${root}/${name}.gz`, compressed = gzipSync(data)
  if (existsSync(target)) assert(readFileSync(target).equals(compressed))
  else writeFileSync(target, compressed, { flag: 'wx' })
  assert(gunzipSync(readFileSync(target)).equals(data))
  artifacts.push({ name, bytes: data.length, sha256: hash(data) })
}
for (const name of ['unit-red.json', 'unit-scope.json', 'unit-full.json',
  'native-handoff-red.json', 'native-handoff-final.json', 'native-normal-final.json'])
  preserve(name, readFileSync(`${scratch}/${name}`))
for (const name of ['source-before-videoPoseSource.ts', 'source-before-cameraPreparation.ts', 'red-helper.mjs'])
  preserve(name, gunzipSync(readFileSync(`${scratch}/${name}.gz`)))
const reports = Object.fromEntries(['unit-red', 'unit-scope', 'unit-full',
  'native-handoff-red', 'native-handoff-final', 'native-normal-final'].map((name) =>
  [name, JSON.parse(readFileSync(`${scratch}/${name}.json`))]))
assert.equal(reports['unit-red'].numFailedTests, 1)
assert.equal(reports['unit-red'].numPassedTests, 21)
for (const name of ['unit-scope', 'unit-full']) {
  const r = reports[name]
  assert.equal(r.success, true)
  assert.equal(r.numFailedTests, 0)
  assert.equal(r.numPendingTests, 0)
}
const red = reports['native-handoff-red']
assert.equal(red.cases.length, 1)
assert.equal(red.failure.phase, 'native-input/observe/first-three-frames')
assert.equal(red.diagnostic.ui, 'frame-error')
assert.equal(red.diagnostic.frames, 1)
assert.deepEqual(red.diagnostic.injected, ['equal'])
assert.equal(red.controlledTimestampFault, true)
for (const name of ['native-handoff-red', 'native-handoff-final', 'native-normal-final']) {
  const r = reports[name]
  assert.deepEqual(r.sourceBefore, r.sourceAfter)
  assert.equal(r.ownedResourcesClosed, true)
  for (const key of ['external', 'avatars', 'writes']) assert.equal(r[key], 0)
  assert.deepEqual(r.errors, [])
}
for (const [name, count, fault] of [['native-handoff-final', 8, true], ['native-normal-final', 6, false]]) {
  const r = reports[name]
  assert.equal(r.failure, null)
  assert.equal(r.cases.length, count)
  assert.equal(r.controlledTimestampFault, fault)
  for (const s of r.sourceAfter) assert.equal(hash(readFileSync(s.file)), s.sha256)
}
const source = ['src/pose/cameraPreparation.ts', 'src/pose/videoPoseSource.ts',
  'src/pose/videoPoseSource.test.ts', 'src/pose/cameraPreparation.observation.test.ts',
  'scripts/test-motion-framing.mjs'].map((file) => {
  const data = readFileSync(file)
  preserve(`source-${file.replaceAll('/', '-')}`, data)
  return { file, sha256: hash(data) }
})
for (const [name, file] of [['source-before-videoPoseSource.ts', 'src/pose/videoPoseSource.ts'],
  ['source-before-cameraPreparation.ts', 'src/pose/cameraPreparation.ts']]) {
  const original = spawnSync('git', ['show', `${baseMain}:bodyguard/frontend/${file}`])
  assert.equal(original.status, 0)
  assert(original.stdout.equals(gunzipSync(readFileSync(`${scratch}/${name}.gz`))))
}
const commands = []
function run(name, command, args) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout: 90000 })
  preserve(`final-${name}.stdout`, Buffer.from(r.stdout ?? ''))
  preserve(`final-${name}.stderr`, Buffer.from(r.stderr ?? ''))
  commands.push({ name, command, args, exit: r.status, signal: r.signal })
  assert.equal(r.status, 0, `${name} did not pass`)
}
run('typecheck', 'pnpm', ['exec', 'tsc', '--noEmit'])
run('scope-biome', 'pnpm', ['exec', 'biome', 'check', ...source.map((s) => s.file)])
run('production-build', process.execPath, ['scripts/build-camera-preparation.mjs', productScratch])
const build = `${productScratch}/product`
let guard = readFileSync('scripts/check-selection-production.mjs', 'utf8')
const oldRoot = "const root = fileURLToPath(new URL('../dist/assets/', import.meta.url))"
assert.equal(guard.split(oldRoot).length, 2)
guard = guard.replace(oldRoot, `const root = ${JSON.stringify(`${build}/assets`)}`)
run('private-guard', process.execPath, ['--input-type=module', '-e', guard])
run('diff-check', 'git', ['diff', '--check'])
const publicAssets = readdirSync(`${build}/assets`).filter((name) => /\.(js|css)$/.test(name)).map((name) => {
  const data = readFileSync(`${build}/assets/${name}`), ext = name.endsWith('.js') ? '.js' : '.css'
  const prior = readdirSync(`${priorProduct}/product/assets`).filter((n) => n.endsWith(ext))
  assert.equal(prior.length, 1)
  assert(data.equals(readFileSync(`${priorProduct}/product/assets/${prior[0]}`)))
  return { name, bytes: data.length, sha256: hash(data), byteIdenticalToPR133: true }
})
assert.equal(publicAssets.length, 2)
assert(!readdirSync(build, { recursive: true }).some((n) => String(n).endsWith('.glb')))
const html = readFileSync(`${build}/index.html`, 'utf8').replaceAll('&#39;', "'")
assert(html.includes("connect-src 'self'"))
assert(!html.includes("'unsafe-eval'"))
JSON.parse(readFileSync(`${build}/licenses/bundled-js.json`))
JSON.parse(readFileSync(`${build}/licenses/bundled-packages.json`))
assert(readFileSync(`${build}/licenses/tailwindcss.txt`).length > 100)
const pngSource = `${scratch}/native-handoff-final-motion-change.png`, png = `${root}/motion-change.png`
if (existsSync(png)) assert(readFileSync(png).equals(readFileSync(pngSource)))
else copyFileSync(pngSource, png, constants.COPYFILE_EXCL)
writeFileSync(`${root}/verification.json`, JSON.stringify({ baseMain, source, artifacts, commands, publicAssets,
  screenshotSHA256: hash(readFileSync(png)),
  checks: { fullPassed: reports['unit-full'].numPassedTests, fullFiles: reports['unit-full'].testResults.length,
    scopePassed: reports['unit-scope'].numPassedTests, failed: 0, skipped: 0,
    controlledNativeCases: 8, normalNativeCases: 6, cspNoticesAndNoGLB: true },
  preservedFailures: ['unit RED 21 passed/1 failed: warmup stamp reached ordered detector',
    'controlled native RED 1 passed/TimeoutError; equal timestamp injection produced frame-error before any continuous Worker frame'],
  notProven: reports['native-handoff-final'].notProven,
}, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ artifacts: artifacts.length, actualCommands: commands.length,
  controlledNativeCases: 8, normalNativeCases: 6, publicByteIdentical: true }))
