// S6.18: exact local commands/source hashes; not a participant or old-startup verifier.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const proof = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-inference-warmup-proof\.[A-Za-z0-9]+$/.test(proof))
const root = fileURLToPath(new URL('..', import.meta.url))
const checks = resolve(proof, 'accepted-checks')
mkdirSync(checks, { recursive: false })
const files = [
  'src/coaching/ownedPlaybackResources.ts',
  'src/coaching/ownedPlaybackResources.test.ts',
  'src/coaching/nativePlaybackResources.ts',
  'src/coaching/nativePlaybackResources.test.ts',
  'e2e/fixtures/nativeContentionProbe.ts',
  'e2e/fixtures/nativeWarmup.vite.ts',
  'scripts/test-inference-warmup.mjs',
  'scripts/check-selection-production.mjs',
  'scripts/verify-inference-warmup.mjs',
]
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const source = Object.fromEntries(
  files.map((file) => [file, sha(readFileSync(resolve(root, file)))]),
)
const report = { source, commands: [], production: [], pass: false }
for (const [name, args] of [
  ['unit', ['node_modules/vitest/vitest.mjs', 'run']],
  ['types', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['biome', ['node_modules/@biomejs/biome/bin/biome', 'check', '.']],
  ['assets', ['scripts/prepare-assets.mjs']],
  ['build', ['node_modules/vite/bin/vite.js', 'build']],
  ['production-guard', ['scripts/check-selection-production.mjs']],
]) {
  const start = new Date().toISOString()
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' })
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`
  writeFileSync(resolve(checks, name + '.log'), log, { flag: 'wx' })
  report.commands.push({
    name,
    command: [process.execPath, ...args],
    start,
    end: new Date().toISOString(),
    status: result.status,
    signal: result.signal,
    error: result.error?.code ?? null,
    sha256: sha(log),
  })
  console.log(JSON.stringify({ name, status: result.status }))
}
for (const file of readdirSync(resolve(root, 'dist/assets'))) {
  if (!/\.(js|css)$/.test(file)) continue
  const bytes = readFileSync(resolve(root, 'dist/assets', file))
  report.production.push({ file, bytes: bytes.length, sha256: sha(bytes) })
}
assert.deepEqual(
  source,
  Object.fromEntries(files.map((file) => [file, sha(readFileSync(resolve(root, file)))])),
)
report.pass = report.commands.every((command) => command.status === 0)
writeFileSync(resolve(checks, 'report.json'), JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
})
assert(report.pass)
