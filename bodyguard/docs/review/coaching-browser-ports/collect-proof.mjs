// NFR-07/08: only bounded owned synthetic/fake-camera proof, not user frames.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = fileURLToPath(new URL('.', import.meta.url))
assert(root.endsWith('/BODYGUARD-coaching-browser-ports'))
assert.equal(realpathSync(destination), join(root, 'bodyguard/docs/review/coaching-browser-ports'))
const scratch = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-browser-ports-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
function save(name, bytes) {
  const target = join(destination, name)
  let prior
  try {
    prior = lstatSync(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (prior) {
    assert(prior.isFile() && !prior.isSymbolicLink() && prior.nlink === 1)
    assert(readFileSync(target).equals(bytes), 'Existing proof must be preserved')
  } else writeFileSync(target, bytes, { flag: 'wx' })
}
const manifest = []
function copy(source, name, binary = false) {
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size < 2 * 1024 * 1024)
  const raw = readFileSync(source)
  const originalPublicBytes = binary
    ? raw
    : Buffer.from(
        raw
          .toString('utf8')
          .replaceAll(pathToFileURL(root).href, '[workspace]')
          .replaceAll(root, '[workspace]')
          .replaceAll(scratch, '[private-scratch]')
          .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"'),
      )
  const publicBytes = name.endsWith('.stdout')
    ? Buffer.from(
        originalPublicBytes
          .toString('utf8')
          .replace(/[ \t]+$/gm, '')
          .replace(/\n+$/, '\n'),
      )
    : originalPublicBytes
  const originalProof = originalPublicBytes.equals(publicBytes) ? null : `${name}.original.gz`
  if (originalProof) save(originalProof, gzipSync(originalPublicBytes))
  save(name, publicBytes)
  manifest.push({
    name,
    raw_sha256: digest(raw),
    original_public_sha256: digest(originalPublicBytes),
    original_proof: originalProof,
    public_sha256: digest(publicBytes),
    bytes: publicBytes.length,
  })
}
const names = [
  'first-red.xml',
  'contract-red.xml',
  'initial-unit.xml',
  'initial-typecheck.stdout',
  'ownership-review-red.xml',
  'ownership-review-green.xml',
  'observer-review-red.xml',
  'initial-regression.stdout',
  'full-regression.xml',
  'accepted-regression.xml',
  'final-regression.xml',
  'accepted-typecheck.stdout',
  'accepted-biome.stdout',
  'verified-build.stdout',
  'production-guard-negative.stdout',
  'verified-production-guard.stdout',
  'native-browser-initial.stdout',
  'native-browser-initial.json',
  'native-browser-diagnostic.stdout',
  'native-browser-diagnostic.json',
  'test-only-policy-initial.stdout',
  'test-only-policy-initial.json',
  'selection-browser.stdout',
  'selection-report.json',
]
for (const name of names) copy(join(scratch, name), name)
copy(
  join(
    root,
    'bodyguard/frontend/test-results/selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png',
  ),
  'production-start.png',
  true,
)
save(
  'artifacts-formatted.json',
  Buffer.from(`${JSON.stringify({ version: 2, artifacts: manifest }, null, 2)}\n`),
)
console.log(
  JSON.stringify({
    verified_artifacts: manifest.length,
    copied_user_frames: 0,
    complete_story: false,
  }),
)
