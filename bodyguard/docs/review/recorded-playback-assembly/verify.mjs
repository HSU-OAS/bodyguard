// Executes actual local gates and preserves original outputs; never invents a pass.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'

const [scratch, productScratch, priorProduct] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-recorded-playback\.[A-Za-z0-9]+$/.test(scratch))
for (const path of [productScratch, priorProduct]) assert(/^\/private\/tmp\/bodyguard-camera-preparation\.[A-Za-z0-9]+$/.test(path))
const root = resolve('../docs/review/recorded-playback-assembly'), hash = (data) => createHash('sha256').update(data).digest('hex')
const preserve = (name, data) => {
  const target = `${root}/${name}.gz`, compressed = gzipSync(data)
  if (existsSync(target)) assert(readFileSync(target).equals(compressed))
  else writeFileSync(target, compressed, { flag: 'wx' })
  return { name, bytes: data.length, sha256: hash(data) }
}
const reports = ['verify-first-helper.mjs', 'unit-first.json', 'unit-second.json', 'unit-assembly.json', 'unit-contract.json',
  'unit-reentry-red.json', 'unit-full.json', 'unit-contract-final.json', 'unit-contract-final-v2.json',
  'unit-full-final.json', 'unit-full-final-v2.json', 'unit-contract-final-v3.json',
  'browser-first.json', 'browser-first-helper.mjs', 'browser-final.json', 'browser-runtime-final.json']
const artifacts = reports.map((name) => preserve(name, readFileSync(`${scratch}/${name}`)))
const full = JSON.parse(readFileSync(`${scratch}/unit-full-final-v2.json`)), contract = JSON.parse(readFileSync(`${scratch}/unit-contract-final-v3.json`))
for (const report of [full, contract]) {
  assert.equal(report.success, true); assert.equal(report.numFailedTests, 0); assert.equal(report.numPendingTests, 0)
}
const browser = JSON.parse(readFileSync(`${scratch}/browser-runtime-final.json`))
assert.equal(browser.failure, null); assert.equal(browser.cases.length, 5)
assert.deepEqual(browser.sourceBefore, browser.sourceAfter)
for (const source of browser.sourceAfter) assert.equal(hash(readFileSync(source.file)), source.sha256)
for (const key of ['external', 'avatars', 'camera', 'worker']) assert.equal(browser.controls[key], 0)
assert.deepEqual(browser.controls.errors, [])
const source = ['src/coaching/useRecordedPlayback.ts', 'src/coaching/useRecordedPlayback.test.tsx', 'e2e/fixtures/authCoachingProbe.ts', 'scripts/test-recorded-playback.mjs'].map((file) => {
  const data = readFileSync(file); artifacts.push(preserve(`source-${file.replaceAll('/', '-')}`, data)); return { file, sha256: hash(data) }
})
const commands = []
function run(name, command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 90000 })
  artifacts.push(preserve(`final-${name}.stdout`, Buffer.from(result.stdout ?? '')))
  artifacts.push(preserve(`final-${name}.stderr`, Buffer.from(result.stderr ?? '')))
  commands.push({ name, command, args, exit: result.status, signal: result.signal })
  assert.equal(result.status, 0, `${name} did not pass`)
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
  const prior = readdirSync(`${priorProduct}/product/assets`).filter((n) => n.endsWith(ext)); assert.equal(prior.length, 1)
  assert(data.equals(readFileSync(`${priorProduct}/product/assets/${prior[0]}`)))
  assert(!data.toString().includes('useRecordedPlayback'))
  return { name, bytes: data.length, sha256: hash(data), byteIdenticalToPR132: true }
})
assert.equal(publicAssets.length, 2)
assert(!readdirSync(build, { recursive: true }).some((n) => String(n).endsWith('.glb')))
const html = readFileSync(`${build}/index.html`, 'utf8').replaceAll('&#39;', "'")
assert(html.includes("connect-src 'self'")); assert(!html.includes("'unsafe-eval'"))
JSON.parse(readFileSync(`${build}/licenses/bundled-js.json`)); JSON.parse(readFileSync(`${build}/licenses/bundled-packages.json`))
assert(readFileSync(`${build}/licenses/tailwindcss.txt`).length > 100)
const png = `${root}/record-detail.png`, pngSource = `${scratch}/browser-runtime-final-record.png`
if (existsSync(png)) assert(readFileSync(png).equals(readFileSync(pngSource)))
else copyFileSync(pngSource, png, constants.COPYFILE_EXCL)
writeFileSync(`${root}/verification.json`, JSON.stringify({ baseMain: 'f4bddae03ea16795b83fbadfe4ea1f9ce7aed1e1',
  source, artifacts, commands, publicAssets, screenshotSHA256: hash(readFileSync(png)),
  checks: { fullPassed: full.numPassedTests, fullFiles: full.testResults.length, contractPassed: contract.numPassedTests,
    failed: full.numFailedTests, skipped: full.numPendingTests, browserCases: browser.cases.length, buildExit: 0, cspNoticesAndNoGLB: true },
  preservedFailures: ['initial unit assertions used nonexistent state fields (4 passed/3 failed)',
    'initial and expanded fixture type errors: observed tool outputs, no separate raw log',
    'browser-first record-detail TimeoutError: harness sought wrong existing field label; original helper retained',
    'author review P2: native start error reentry could republish old running UI state; actual RED reproduced then fixed',
    'post-quarantine test still assumed second inert candidate creation; assertion corrected to no new factory call',
    'first verifier compared escaped HTML CSP without decoding; first verifier and earlier command outputs retained; failure was observed in tool output'],
  notProven: browser.notProven,
}, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ artifacts: artifacts.length, actualCommands: commands.length, browserCases: browser.cases.length, publicByteIdentical: true }))
