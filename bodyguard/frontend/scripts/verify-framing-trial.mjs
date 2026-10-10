// S2.M4: retain exact command statuses and hashes, not a clinical/participant verifier.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const destination = process.argv[2]
assert(destination?.startsWith('/private/tmp/bodyguard-observer-framing-proof.'))
const root = fileURLToPath(new URL('..', import.meta.url))
const proof = resolve(destination, 'checks')
mkdirSync(proof, { recursive: false })
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const files = [
  'src/pages/MeasureDemoPage.tsx',
  'src/pages/MeasureDemoPage.test.tsx',
  'src/posture/framingTrial.ts',
  'src/posture/framingTrial.test.ts',
  'e2e/demo.spec.ts',
  'scripts/check-selection-production.mjs',
  'scripts/test-framing-trial-browser.mjs',
  'scripts/verify-framing-trial.mjs',
]
const source = Object.fromEntries(files.map((file) => [file, sha(resolve(root, file))]))
const report = { source, commands: [], production: [], pass: false }
const commands = [
  ['unit', ['node_modules/vitest/vitest.mjs', 'run']],
  ['types', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['biome', ['node_modules/@biomejs/biome/bin/biome', 'check', '.']],
  ['assets', ['scripts/prepare-assets.mjs']],
  ['build', ['node_modules/vite/bin/vite.js', 'build']],
  ['production-guard', ['scripts/check-selection-production.mjs']],
]
for (const [name, args] of commands) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' })
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`
  writeFileSync(resolve(proof, `${name}.log`), log)
  report.commands.push({
    name,
    command: [process.execPath, ...args],
    status: result.status,
    error: result.error?.message ?? null,
    logSHA: sha(resolve(proof, `${name}.log`)),
  })
  console.log(JSON.stringify({ name, status: result.status }))
}
const diff = spawnSync('git', ['diff', '--check'], { cwd: root, encoding: 'utf8' })
writeFileSync(resolve(proof, 'diff.log'), `${diff.stdout ?? ''}${diff.stderr ?? ''}`)
report.commands.push({ name: 'diff', status: diff.status, logSHA: sha(resolve(proof, 'diff.log')) })
for (const file of readdirSync(resolve(root, 'dist/assets'))) {
  if (!/\.(js|css)$/.test(file)) continue
  const path = resolve(root, 'dist/assets', file)
  report.production.push({ file, bytes: readFileSync(path).length, sha256: sha(path) })
}
assert.deepEqual(Object.fromEntries(files.map((file) => [file, sha(resolve(root, file))])), source)
report.pass = report.commands.every((entry) => entry.status === 0)
writeFileSync(resolve(proof, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (!report.pass) process.exitCode = 1
