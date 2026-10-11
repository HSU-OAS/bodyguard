// FR-M-02/07·NFR-08: copy original execution reports; does not execute tests.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const [scratch, build, prior] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-input-recovery\.[A-Za-z0-9]+$/.test(scratch))
for (const path of [build, prior]) assert(/^\/private\/tmp\/bodyguard-camera-preparation\.[A-Za-z0-9]+$/.test(path))
const root = fileURLToPath(new URL('./', import.meta.url))
const frontend = fileURLToPath(new URL('../../../frontend/', import.meta.url))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (name) => JSON.parse(readFileSync(`${scratch}/${name}.json`))
const full = read('unit-full'), final = read('stability-check')
assert.equal(full.success, true)
assert.equal(full.numFailedTests + full.numPendingTests, 0)
assert.equal(final.failure, null)
assert.equal(final.cases.length, 4)
assert.deepEqual(final.sourceBefore, final.sourceAfter)
for (const entry of final.sourceBefore) assert.equal(sha(readFileSync(`${frontend}/${entry.file}`)), entry.sha256)
for (const [snapshot, report] of [['baseline-helper.mjs', 'baseline'], ['final-helper-at-run.mjs', 'final']])
  assert.equal(sha(readFileSync(`${scratch}/${snapshot}`)), read(report).sourceBefore.find((f) => f.file === 'scripts/test-input-recovery.mjs').sha256)
const records = []
for (const name of ['baseline.json', 'unit-baseline.json', 'final.json', 'diagnosis.json', 'stability-check.json', 'unit-full.json', 'baseline-helper.mjs', 'final-helper-at-run.mjs']) {
  const bytes = readFileSync(`${scratch}/${name}`)
  writeFileSync(`${root}/${name}.gz`, gzipSync(bytes), { flag: 'wx' })
  records.push({ file: `${name}.gz`, originalBytes: bytes.length, originalSHA256: sha(bytes) })
}
for (const mode of ['capture-fault', 'worker-fault', 'cleanup'])
  copyFileSync(`${scratch}/stability-check-${mode}.png`, `${root}/${mode}.png`, 1)
const product = readdirSync(`${build}/product/assets`).map((file) => {
  const bytes = readFileSync(`${build}/product/assets/${file}`)
  assert(bytes.equals(readFileSync(`${prior}/product/assets/${file}`)))
  return { file, sha256: sha(bytes), identicalToPR130: true }
})
writeFileSync(`${root}/verification.json`, JSON.stringify({
  baseMain: 'bbc2b152d3bd236338b29b1829fafe230179c34a',
  method: 'copy/compress actual reports and DOM-only images; not a test execution',
  full: { files: full.testResults.length, passed: full.numPassedTests, failed: full.numFailedTests, pending: full.numPendingTests, maxWorkers: 2 },
  actualBrowser: { cases: final.cases, failure: final.failure, external: final.external, avatars: final.avatars, writes: final.writes, errors: final.errors, ownedResourcesClosed: final.ownedResourcesClosed },
  attempts: ['baseline4pass/no product fix/RED0', 'strengthened final2pass, held-stage TimeoutError; original preserved, location/cause not retrospectively established', 'fixed-category diagnosis4pass', 'same source/limits stability-check4pass'],
  sourceBefore: final.sourceBefore, sourceAfter: final.sourceAfter,
  unitSource: { file: 'src/pose/cameraPreparation.recovery.test.ts', sha256: sha(readFileSync(`${frontend}/src/pose/cameraPreparation.recovery.test.ts`)) },
  product, records,
  commandResults: { typecheck: 'exit0', scopedBiome: '2files exit0', actualViteBuild: '117modules exit0; envDir scratch/no prepare-assets', productionGuard: 'original program, only scratch asset-root substituted; CSP/notices present/JSON parseable; exit0', diffCheck: 'exit0 before commit' },
  review: { authorOnly: true, independentReview: false, unresolvedTestDiffP1P2: 0, productStartupIssueClosed: false },
  notProven: final.notProven, releaseCandidate: false,
}, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ root, preservedReports: records.length, actualSourceHashes: final.sourceBefore.length, productFiles: product.length }))
