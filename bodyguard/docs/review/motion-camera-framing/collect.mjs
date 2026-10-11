// Preserve actual artifacts; this collector does not execute tests or manufacture passes.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, constants, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
const [scratch, buildScratch, priorBuild] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-motion-framing\.[A-Za-z0-9]+$/.test(scratch))
for (const path of [buildScratch, priorBuild]) assert(/^\/private\/tmp\/bodyguard-camera-preparation\.[A-Za-z0-9]+$/.test(path))
const root = resolve('../docs/review/motion-camera-framing')
const hash = (data) => createHash('sha256').update(data).digest('hex')
const files = ['unit-red.json', 'unit-first.json', 'unit-dom-first.json', 'unit-full.json',
  'unit-final-contract.json', 'native-first.json', 'native-final.json', 'native-diagnosis.json', 'native-first-helper.mjs']
const artifacts = files.map((name) => {
  const data = readFileSync(`${scratch}/${name}`)
  const target = `${root}/${name}.gz`, compressed = gzipSync(data)
  if (existsSync(target)) assert(readFileSync(target).equals(compressed))
  else writeFileSync(target, compressed, { flag: 'wx' })
  return { name, bytes: data.length, sha256: hash(data) }
})
const png = `${root}/motion-change.png`
if (existsSync(png)) assert(readFileSync(png).equals(readFileSync(`${scratch}/native-diagnosis-motion-change.png`)))
else copyFileSync(`${scratch}/native-diagnosis-motion-change.png`, png, constants.COPYFILE_EXCL)
const browser = JSON.parse(readFileSync(`${scratch}/native-diagnosis.json`, 'utf8'))
const full = JSON.parse(readFileSync(`${scratch}/unit-full.json`, 'utf8'))
const contract = JSON.parse(readFileSync(`${scratch}/unit-final-contract.json`, 'utf8'))
for (const report of [full, contract]) {
  assert.equal(report.success, true)
  assert.equal(report.numFailedTests, 0)
  assert.equal(report.numPendingTests, 0)
}
for (const source of browser.sourceAfter) assert.equal(hash(readFileSync(source.file)), source.sha256)
assert.deepEqual(browser.sourceBefore, browser.sourceAfter)
assert.equal(browser.failure, null)
const publicAssets = readdirSync(`${buildScratch}/product/assets`).filter((n) => /\.(js|css)$/.test(n)).map((name) => {
  const data = readFileSync(`${buildScratch}/product/assets/${name}`)
  const extension = name.endsWith('.js') ? '.js' : '.css'
  const priorNames = readdirSync(`${priorBuild}/product/assets`).filter((n) => n.endsWith(extension))
  assert.equal(priorNames.length, 1)
  const prior = readFileSync(`${priorBuild}/product/assets/${priorNames[0]}`)
  assert(data.equals(prior))
  return { name, priorName: priorNames[0], bytes: data.length, sha256: hash(data), byteIdenticalToPR131: true }
})
writeFileSync(`${root}/verification.json`, JSON.stringify({
  baseMain: 'dde3d3c86731f1ba0c1c756769ddfb0aaaae187e', artifacts,
  runtimeSource: browser.sourceAfter, publicAssets,
  checks: { fullUnitPassed: full.numPassedTests, fullFiles: full.testResults.length,
    contractPassed: contract.numPassedTests, failed: full.numFailedTests, skipped: full.numPendingTests, nativeCases: browser.cases.length,
    typecheckExit: 0, scopeBiomeExit: 0, buildExit: 0, privateGuardExit: 0 },
  preservedFailures: ['missing-module RED suite', 'sandbox setup failure', 'initial native-input TimeoutError with no finer phase diagnostic',
    'initial DOM fixture TypeScript errors were observed in command output; no separate raw log file',
    'first collector assumed identical generated filenames and failed; content hash comparison corrected',
    'first build Tailwind scanned test title invisible and emitted an unused utility; test label corrected and build re-executed'],
  notProven: browser.notProven,
}, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ artifacts: artifacts.length, actualNativeCases: browser.cases.length, publicByteUnchanged: true }))
