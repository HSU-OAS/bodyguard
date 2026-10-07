// NFR-07/08: bounded copies of owned test artifacts only, never application/user data.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const destination = fileURLToPath(new URL('.', import.meta.url))
const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
assert(root.endsWith('/BODYGUARD-coaching-resource-lifecycle'))
assert.equal(realpathSync(destination), join(root, 'bodyguard/docs/review/coaching-resources'))
const scratch = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-resource-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = []
function save(target, bytes) {
  let previous
  try {
    previous = lstatSync(target)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (previous) {
    assert(previous.isFile() && !previous.isSymbolicLink() && previous.nlink === 1)
    assert(
      readFileSync(target).equals(bytes),
      'Preserve previous evidence; use a new artifact name',
    )
  } else writeFileSync(target, bytes, { flag: 'wx' })
}
function copy(source, name, binary = false) {
  const stat = lstatSync(source)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size < 2 * 1024 * 1024)
  const raw = readFileSync(source)
  const publicBytes = binary
    ? raw
    : Buffer.from(
        raw
          .toString('utf8')
          .replaceAll(pathToFileURL(root).href, '[workspace]')
          .replaceAll(root, '[workspace]')
          .replaceAll(scratch, '[private-scratch]')
          .replaceAll('hostname="MacBook-Air.local"', 'hostname="local-test-host"'),
      )
  const target = join(destination, name)
  save(target, publicBytes)
  manifest.push({
    name,
    raw_sha256: digest(raw),
    public_sha256: digest(publicBytes),
    bytes: publicBytes.length,
  })
}
for (const name of [
  'contract-red.xml',
  'initial-green.xml',
  'review-red.xml',
  'review-green.xml',
  'full-regression.xml',
  'accepted-regression.xml',
  'accepted-typecheck.stdout',
  'accepted-biome.stdout',
  'accepted-build.stdout',
  'final-production-guard.stdout',
  'production-guard-negative.stdout',
  'selection-browser.stdout',
])
  copy(join(scratch, name), name)
copy(join(root, 'bodyguard/frontend/test-results/selection-report.json'), 'selection-report.json')
copy(
  join(
    root,
    'bodyguard/frontend/test-results/selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png',
  ),
  'production-start.png',
  true,
)
const report = Buffer.from(`${JSON.stringify({ version: 1, artifacts: manifest }, null, 2)}\n`)
const path = join(destination, 'artifacts.json')
save(path, report)
console.log(JSON.stringify({ public_artifacts_verified: manifest.length, copied_user_frames: 0 }))
