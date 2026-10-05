// NFR-07/08: fixed owned synthetic/browser proof only; no video/coordinates.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
const destination = fileURLToPath(new URL('.', import.meta.url))
assert(root.endsWith('/BODYGUARD-coaching-observation-loop'))
assert.equal(
  realpathSync(destination),
  join(root, 'bodyguard/docs/review/coaching-observation-loop'),
)
const scratch = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-observation-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = (value) => createHash('sha256').update(value).digest('hex')
function save(name, bytes) {
  const target = join(destination, name)
  let old
  try {
    old = lstatSync(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (old) {
    assert(old.isFile() && !old.isSymbolicLink() && old.nlink === 1)
    assert(readFileSync(target).equals(bytes), 'Preserve prior proof')
  } else writeFileSync(target, bytes, { flag: 'wx' })
}
const manifest = []
function copy(source, name, binary = false) {
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size < 2 * 1024 * 1024)
  const raw = readFileSync(source)
  const publicRaw = binary
    ? raw
    : Buffer.from(
        raw
          .toString('utf8')
          .replaceAll(pathToFileURL(root).href, '[workspace]')
          .replaceAll(root, '[workspace]')
          .replaceAll(scratch, '[private-scratch]')
          .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"'),
      )
  const bytes = name.endsWith('.stdout')
    ? Buffer.from(
        publicRaw
          .toString('utf8')
          .replace(/[ \t]+$/gm, '')
          .replace(/\n+$/, '\n'),
      )
    : publicRaw
  const original = bytes.equals(publicRaw) ? null : `${name}.original.gz`
  if (original) save(original, gzipSync(publicRaw))
  save(name, bytes)
  manifest.push({
    name,
    raw_sha256: digest(raw),
    original_public_sha256: digest(publicRaw),
    original_proof: original,
    public_sha256: digest(bytes),
    bytes: bytes.length,
  })
}
for (const name of [
  'first-red.xml',
  'contract-red.xml',
  'initial-unit.xml',
  'initial-typecheck.stdout',
  'review-red.xml',
  'final-regression.xml',
  'accepted-typecheck.stdout',
  'accepted-biome.stdout',
  'accepted-build.stdout',
  'guard-negative.stdout',
  'verified-guard.stdout',
  'selection-browser.stdout',
  'selection-report.json',
  'accepted-selection-browser.stdout',
  'accepted-selection-report.json',
])
  copy(join(scratch, name), name)
copy(join(scratch, 'initial-production-start.png'), 'initial-production-start.png', true)
copy(
  join(
    root,
    'bodyguard/frontend/test-results/selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png',
  ),
  'production-start.png',
  true,
)
save(
  'artifacts.json',
  Buffer.from(`${JSON.stringify({ version: 2, artifacts: manifest }, null, 2)}\n`),
)
console.log(JSON.stringify({ verified_artifacts: manifest.length, video_frames_exported: 0 }))
