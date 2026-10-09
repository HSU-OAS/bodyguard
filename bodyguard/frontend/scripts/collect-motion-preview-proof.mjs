// NFR-08: immutable technical evidence; screenshots have no webcam/person input.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const [directory] = process.argv.slice(2)
assert(
  directory &&
    /^\/private\/tmp\/bodyguard-motion-preview-proof\.[A-Za-z0-9]+$/.test(directory) &&
    realpathSync(directory) === directory,
)
const root = fileURLToPath(new URL('../../', import.meta.url))
const output = join(root, 'docs/review/owned-motion-preview')
assert(!existsSync(join(output, 'manifest.json')), 'Preserve recorded evidence')
mkdirSync(output, { recursive: true })
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const source = [
  'frontend/src/avatar/ownedMotionPreview.ts',
  'frontend/src/avatar/ownedMotionPreview.test.ts',
  'frontend/e2e/fixtures/motionPreviewProbe.ts',
  'frontend/e2e/fixtures/motionPreview.vite.ts',
  'frontend/e2e/fixtures/nativeReferenceProgram.ts',
  'frontend/src/avatar/ownedAvatarPair.ts',
  'frontend/src/avatar/eightWeightSkin.ts',
  'frontend/src/avatar/referencePlayback.ts',
  'frontend/src/coaching/resources.ts',
  'frontend/package.json',
  'frontend/pnpm-lock.yaml',
  'frontend/scripts/test-motion-preview-browser.mjs',
  'frontend/scripts/check-selection-production.mjs',
  'frontend/scripts/collect-motion-preview-proof.mjs',
]
const manifest = {
  fixtureNotRelease: true,
  source: {},
  artifacts: {},
  inputs: {},
  publicAssets: {},
  checks: {},
}
const put = (name, bytes) => {
  writeFileSync(join(output, name), bytes, { flag: 'wx' })
  manifest.artifacts[name] = { bytes: bytes.length, sha256: sha(bytes) }
}
source.forEach((name, i) => {
  const bytes = readFileSync(join(root, name)),
    archived = `source-${i}.gz`
  put(archived, gzipSync(bytes, { level: 9 }))
  manifest.source[name] = { archived, sha256: sha(bytes) }
})
for (const label of [
  'chrome155-first',
  'chrome154-first',
  'chrome155-reviewed',
  'chrome155-gate',
  'chrome154-gate',
]) {
  const name = `browser-${label}.json`,
    bytes = readFileSync(join(directory, name)),
    proof = JSON.parse(bytes)
  assert(!proof.failed && proof.fixtureNotRelease && proof.cases.length === 26)
  assert(proof.cases.every((item) => item.passed))
  if (label.endsWith('gate')) {
    const bundle = readFileSync(join(directory, 'probe-gate/probe.js'))
    assert.equal(proof.assets['/probe.js'], sha(bundle))
    manifest.inputs = Object.fromEntries(
      Object.entries(proof.assets).filter(([route]) => route !== '/probe.js'),
    )
  }
  put(name, bytes)
}
for (const label of ['final', 'reviewed', 'gate'])
  put(
    `probe-${label}.js.gz`,
    gzipSync(readFileSync(join(directory, `probe-${label}/probe.js`)), { level: 9 }),
  )
for (const label of ['chrome155-gate', 'chrome154-gate'])
  for (const gender of ['male', 'female']) {
    const name = `${label}-${gender}-moving.png`
    put(name, readFileSync(join(directory, name)))
  }
for (const [name, expected] of [
  ['index-x57--wa1.js', 'b5d4f81164c8d3c196e853b3404382bc15077986aa626cd0c3c72571b6325ac0'],
  ['index-dNUNBpCv.css', '043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e'],
]) {
  const bytes = readFileSync(join(root, 'frontend/dist/assets', name))
  assert.equal(sha(bytes), expected, 'Public build byte regression')
  manifest.publicAssets[name] = { bytes: bytes.length, sha256: sha(bytes) }
}
manifest.checks = {
  unitPreview: 24,
  unitAll: 1435,
  actualChromeVersions: ['154.0.8037.57', '155.0.8059.40'],
  finalBrowserAssertions: 48,
  finalBrowserCounterSnapshots: 4,
  syntheticVisibility: true,
  physicalCamera: false,
  participantOrClinicalValidation: false,
}
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' })
process.stdout.write(
  JSON.stringify({
    recordedArtifacts: Object.keys(manifest.artifacts).length,
    sourceFiles: source.length,
    finalBrowserAssertions: 48,
  }) + '\n',
)
