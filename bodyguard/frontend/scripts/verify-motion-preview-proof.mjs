// NFR-08: rechecks archived evidence and, optionally, exact current source/public bytes.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('../../', import.meta.url)),
  directory = join(root, 'docs/review/owned-motion-preview')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json')))
assert.equal(manifest.fixtureNotRelease, true)
for (const [name, expected] of Object.entries(manifest.artifacts)) {
  const bytes = readFileSync(join(directory, name))
  assert.equal(bytes.length, expected.bytes)
  assert.equal(sha(bytes), expected.sha256)
}
for (const [name, expected] of Object.entries(manifest.source)) {
  assert.equal(sha(gunzipSync(readFileSync(join(directory, expected.archived)))), expected.sha256)
  if (process.argv.includes('--current'))
    assert.equal(sha(readFileSync(join(root, name))), expected.sha256, name)
}
for (const label of ['chrome155-gate', 'chrome154-gate']) {
  const proof = JSON.parse(readFileSync(join(directory, `browser-${label}.json`)))
  assert(!proof.failed && proof.cases.length === 26 && proof.cases.every((item) => item.passed))
  assert.equal(
    proof.assets['/probe.js'],
    sha(gunzipSync(readFileSync(join(directory, 'probe-gate.js.gz')))),
  )
  for (const [route, hash] of Object.entries(manifest.inputs))
    assert.equal(proof.assets[route], hash)
}
if (process.argv.includes('--current'))
  for (const [name, expected] of Object.entries(manifest.publicAssets)) {
    const bytes = readFileSync(join(root, 'frontend/dist/assets', name))
    assert.equal(bytes.length, expected.bytes)
    assert.equal(sha(bytes), expected.sha256)
  }
process.stdout.write(
  JSON.stringify({
    artifacts: Object.keys(manifest.artifacts).length,
    sourceFiles: Object.keys(manifest.source).length,
    current: process.argv.includes('--current'),
    passed: true,
  }) + '\n',
)
