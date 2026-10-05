// NFR-07/08: only bounded artifacts of the owned synthetic/local browser harness.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const destination = fileURLToPath(new URL('.', import.meta.url))
const root = realpathSync(fileURLToPath(new URL('../../../../', import.meta.url)))
assert(root.endsWith('/BODYGUARD-coaching-session-bridge'))
assert.equal(realpathSync(destination), join(root, 'bodyguard/docs/review/coaching-session'))
const scratch = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-session-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
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
    assert(readFileSync(target).equals(bytes), 'Previous proof must be preserved')
  } else writeFileSync(target, bytes, { flag: 'wx' })
}
const mode = process.argv[3] ?? 'initial'
assert(['initial', 'final'].includes(mode))
const manifest = []
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
  save(name, publicBytes)
  manifest.push({
    name,
    raw_sha256: digest(raw),
    public_sha256: digest(publicBytes),
    bytes: publicBytes.length,
  })
}
const names =
  mode === 'final'
    ? [
        'accessor-red.xml',
        'final-regression.xml',
        'final-typecheck.stdout',
        'final-biome.stdout',
        'verified-build.stdout',
        'verified-production-guard.stdout',
      ]
    : [
        'first-red.xml',
        'contract-red.xml',
        'initial-green.xml',
        'initial-typecheck.stdout',
        'fixed-typecheck.stdout',
        'full-regression.xml',
        'review-red.xml',
        'accepted-regression.xml',
        'accepted-typecheck.stdout',
        'accepted-biome.stdout',
        'final-build.stdout',
        'production-guard-negative.stdout',
        'final-production-guard.stdout',
        'selection-browser.stdout',
      ]
for (const name of names) copy(join(scratch, name), name)
copy(join(root, 'bodyguard/frontend/test-results/selection-report.json'), 'selection-report.json')
copy(
  join(
    root,
    'bodyguard/frontend/test-results/selection/selection-C-06-actual-prod-e74f3-oute-catalog-and-entry-link/production-start.png',
  ),
  'production-start.png',
  true,
)
save(
  mode === 'final' ? 'artifacts-final.json' : 'artifacts.json',
  Buffer.from(`${JSON.stringify({ version: 1, artifacts: manifest }, null, 2)}\n`),
)
console.log(JSON.stringify({ public_artifacts_verified: manifest.length, copied_user_frames: 0 }))
