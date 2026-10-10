// S6.18: immutable technical evidence. No camera, coordinates or clinical acceptance.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const proof = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-inference-warmup-proof\.[A-Za-z0-9]+$/.test(proof))
const root = fileURLToPath(new URL('..', import.meta.url)),
  repo = resolve(root, '../..')
const destination = resolve(repo, 'bodyguard/docs/review/native-inference-warmup')
assert(!existsSync(resolve(destination, 'manifest.json')))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const checks = JSON.parse(readFileSync(resolve(proof, 'accepted-checks/report.json')))
assert(checks.pass)
for (const [file, hash] of Object.entries(checks.source))
  assert.equal(sha(readFileSync(resolve(root, file))), hash)
assert.equal(
  checks.production.find((item) => item.file.endsWith('.js')).sha256,
  '434efb6661a704895d6746ff6a40779c11806d53af276e9244fb4e2ade6e6945',
)
assert.equal(
  checks.production.find((item) => item.file.endsWith('.css')).sha256,
  '043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e',
)
const probe = readFileSync(resolve(proof, 'probe/probe.js')),
  binarySHA = sha(probe)
assert.equal(sha(readFileSync(resolve(proof, 'rebuilt-probe/probe.js'))), binarySHA)
for (const label of ['chrome-154', 'chrome-155'])
  for (const mode of ['normal', 'cancel']) {
    const report = JSON.parse(readFileSync(resolve(proof, `${label}-${mode}-accepted.json`)))
    assert.equal(report.probe, binarySHA)
    assert.equal(report.results.length, mode === 'normal' ? 8 : 2)
    assert(report.results.every((item) => item.passed))
    assert.equal(report.externalRequests, 0)
    assert.deepEqual(report.pageErrors, [])
    for (const gender of ['male', 'female']) {
      const original = execFileSync(
        'git',
        [
          'show',
          `25a9bd6:bodyguard/frontend/src/avatar/models/bodyguard-${gender}-candidate-a37.glb`,
        ],
        { cwd: repo, maxBuffer: 20 * 1024 * 1024 },
      )
      assert.equal(report.glbs[gender], sha(original))
    }
  }
mkdirSync(resolve(destination, 'evidence'), { recursive: false })
const manifest = {
  base: 'f356253a78e72422efb3dabf8792c8432dd7e875',
  proof,
  created: new Date().toISOString(),
  artifacts: {},
  source: {},
}
function archive(name, bytes) {
  const file = 'evidence/' + name + '.gz',
    compressed = gzipSync(bytes)
  mkdirSync(resolve(destination, 'evidence', name, '..'), { recursive: true })
  writeFileSync(resolve(destination, file), compressed, { flag: 'wx' })
  manifest.artifacts[name] = {
    file,
    bytes: bytes.length,
    sha256: sha(bytes),
    compressedSha256: sha(compressed),
  }
}
for (const entry of readdirSync(proof, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue
  const file = resolve(entry.parentPath, entry.name)
  const name = file.slice(proof.length + 1)
  archive('run/' + name, readFileSync(file))
}
for (const file of [...Object.keys(checks.source), 'scripts/collect-inference-warmup.mjs']) {
  const bytes = readFileSync(resolve(root, file)),
    name = 'source/' + file
  archive(name, bytes)
  manifest.source['bodyguard/frontend/' + file] = { artifact: name, sha256: sha(bytes) }
}
for (const file of ['docs/review/native-inference-warmup/verify.mjs']) {
  const bytes = readFileSync(resolve(repo, 'bodyguard', file)),
    name = 'source/bodyguard/' + file
  archive(name, bytes)
  manifest.source['bodyguard/' + file] = { artifact: name, sha256: sha(bytes) }
}
writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
  flag: 'wx',
})
console.log(
  JSON.stringify({
    artifacts: Object.keys(manifest.artifacts).length,
    source: Object.keys(manifest.source).length,
  }),
)
