// FR-M-01/02/07·NFR-08: copy actual execution evidence; this collector does not run tests.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const [input, preparation, cancellation, priorBuild] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-continuous-input\.[A-Za-z0-9]+$/.test(input))
for (const path of [preparation, priorBuild])
  assert(/^\/private\/tmp\/bodyguard-camera-preparation\.[A-Za-z0-9]+$/.test(path))
assert(/^\/private\/tmp\/bodyguard-camera-cancel\.[A-Za-z0-9]+$/.test(cancellation))
const output = fileURLToPath(new URL('./', import.meta.url))
const frontend = fileURLToPath(new URL('../../../frontend/', import.meta.url))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (dir, name) => JSON.parse(readFileSync(`${dir}/${name}.json`))
const browser = read(input, 'browser-expanded')
assert.equal(browser.failure, null)
assert.equal(browser.cases.length, 7)
assert.deepEqual(browser.sourceBefore, browser.sourceAfter)
for (const entry of browser.sourceBefore)
  assert.equal(sha(readFileSync(resolve(frontend, entry.file))), entry.sha256)
assert.equal(
  sha(readFileSync(`${input}/browser-helper-at-run.mjs`)),
  read(input, 'browser').sourceBefore.find((f) => f.file === 'scripts/test-continuous-input.mjs')
    .sha256,
)
const full = read(input, 'unit-final-bounded')
assert.equal(full.success, true)
assert.equal(full.numFailedTests + full.numPendingTests, 0)
assert.equal(read(preparation, 'camera-regression').failure, null)
assert.equal(read(cancellation, 'continuous-regression-isolated').failure, null)
const records = []
function preserve(dir, name, target = name) {
  const bytes = readFileSync(`${dir}/${name}`)
  writeFileSync(`${output}/${target}.gz`, gzipSync(bytes), { flag: 'wx' })
  records.push({ file: `${target}.gz`, originalBytes: bytes.length, originalSHA256: sha(bytes) })
}
for (const name of [
  'unit-red', 'unit-first', 'unit-ownership', 'unit-interface', 'unit-final',
  'unit-timeout-recheck', 'unit-final-bounded', 'browser', 'browser-final',
  'browser-final-local', 'browser-expanded',
]) preserve(input, `${name}.json`)
preserve(input, 'browser-helper-at-run.mjs')
preserve(preparation, 'camera-regression.json')
preserve(cancellation, 'continuous-regression.json', 'cancellation-concurrent-failure.json')
preserve(cancellation, 'continuous-regression-isolated.json', 'cancellation-isolated.json')
for (const [source, target] of [
  ['browser-expanded-stopped.png', 'stopped-1440.png'],
  ['browser-expanded-stopped-800.png', 'stopped-800.png'],
  ['browser-expanded-input-controls.png', 'input-controls.png'],
]) copyFileSync(`${input}/${source}`, `${output}/${target}`, 1)
const sources = [
  ...browser.sourceBefore.map((f) => f.file),
  'src/pose/cameraPreparation.observation.test.ts',
  'src/pages/CameraPreparation.observation.test.tsx',
  'src/pages/CameraPreparation.retirement.test.tsx',
  'scripts/check-selection-production.mjs',
].map((file) => ({ file, sha256: sha(readFileSync(resolve(frontend, file))) }))
const product = readdirSync(`${preparation}/product/assets`).map((file) => {
  const bytes = readFileSync(`${preparation}/product/assets/${file}`)
  assert(bytes.equals(readFileSync(`${priorBuild}/product/assets/${file}`)))
  return { file, sha256: sha(bytes), identicalToPR129: true }
})
writeFileSync(`${output}/verification.json`, JSON.stringify({
  baseMain: 'b5791b2b1c3b6639d2d3e028b5b2659bda99acc7',
  method: 'copy/compress executed reports and DOM-only PNG; does not execute verification',
  full: { files: full.testResults.length, passed: full.numPassedTests, failed: 0, pending: 0, maxWorkers: 2 },
  browser: { cases: browser.cases, failure: browser.failure, external: browser.external, avatars: browser.avatars, writes: browser.writes, errors: browser.errors, ownedResourcesClosed: browser.ownedResourcesClosed },
  priorRegressions: { camera: 8, cancellationIsolated: 5, cancellationConcurrent: '1 passed, retry readiness TimeoutError; preserved, original startup P2 remains' },
  failures: ['original unit RED1', 'default full run1709 passed/1 existing MeasureDemoPage test5000ms timeout', 'sandbox browser setup failure; separate loopback listen diagnostic EPERM', 'concurrent cancellation readiness timeout'],
  commandResults: { typecheck: 'exit0', scopedBiome: 'exit0', actualViteBuild: '117modules exit0, envDir scratch; no prepare-assets', productionGuard: 'original program with only asset-root substitution; exit0', noticesAndCSP: 'present; JSON parseable; no unsafe-inline scripts', diffCheck: 'exit0 before commit' },
  review: { authorReview: true, independentReview: false, unresolvedScopedP1P2: 0 },
  source: sources, runtimeSourceBefore: browser.sourceBefore, runtimeSourceAfter: browser.sourceAfter,
  product, records,
  notProven: browser.notProven,
  releaseCandidate: false,
}, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ output, reportsPreserved: records.length, sourceHashes: sources.length, productFiles: product.length }))
