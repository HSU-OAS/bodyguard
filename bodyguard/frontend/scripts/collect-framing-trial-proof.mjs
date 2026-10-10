// S2.M4: preserve failed and passing technical evidence without camera/coordinate exports.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const destination = process.argv[2]
assert(destination?.startsWith('/private/tmp/bodyguard-observer-framing-proof.'))
const root = fileURLToPath(new URL('..', import.meta.url))
const proof = resolve(destination)
const output = resolve(root, '../docs/review/observer-framing')
mkdirSync(output, { recursive: false })
const sha = (data) => createHash('sha256').update(data).digest('hex')
const checks = JSON.parse(readFileSync(resolve(proof, 'checks/report.json'), 'utf8'))
const browser = JSON.parse(readFileSync(resolve(proof, 'browser/report.json'), 'utf8'))
assert(checks.pass && browser.pass)
for (const [file, digest] of Object.entries(checks.source))
  assert.equal(sha(readFileSync(resolve(root, file))), digest)
for (const [file, digest] of Object.entries(browser.source))
  assert.equal(sha(readFileSync(resolve(root, file))), digest)
const manifest = {
  base: '6791e5db91f4c1c803628b1946c2d176d5f8aff2',
  provenance: browser.provenance,
  artifacts: {},
  source: {},
  production: checks.production,
}
function artifact(name, data, compressed = true) {
  const content = compressed ? gzipSync(data) : data
  const path = compressed ? `${name}.gz` : name
  mkdirSync(resolve(output, path, '..'), { recursive: true })
  writeFileSync(resolve(output, path), content, { flag: 'wx' })
  manifest.artifacts[path] = { sha256: sha(data), bytes: data.length, compressed }
}
for (const entry of readdirSync(proof, { recursive: true, withFileTypes: true })) {
  assert(!entry.isSymbolicLink())
  if (!entry.isFile()) continue
  const path = resolve(entry.parentPath, entry.name)
  artifact(`raw/${relative(proof, path)}`, readFileSync(path))
}
const source = [
  ...Object.keys(checks.source),
  'scripts/collect-framing-trial-proof.mjs',
  'scripts/verify-framing-trial-proof.mjs',
]
for (const [index, file] of source.entries()) {
  const data = readFileSync(resolve(root, file))
  const path = `source/current-${index}.txt`
  artifact(path, data)
  manifest.source[file] = { sha256: sha(data), artifact: `${path}.gz` }
}
const original = execFileSync(
  'git',
  ['show', `${manifest.base}:bodyguard/frontend/src/pages/MeasureDemoPage.tsx`],
  { cwd: root },
)
artifact('source/original-MeasureDemoPage.tsx', original)
for (const name of [
  'tuning-1440',
  'validation-1440',
  'validation-800',
  'settings-invalidated-800',
]) {
  const input = resolve(proof, 'browser', `${name}.png`)
  copyFileSync(input, resolve(output, `${name}.png`))
  manifest.artifacts[`${name}.png`] = {
    sha256: sha(readFileSync(input)),
    bytes: readFileSync(input).length,
    compressed: false,
  }
}
writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
  flag: 'wx',
})
console.log(
  JSON.stringify({
    artifacts: Object.keys(manifest.artifacts).length,
    sources: source.length,
    pass: true,
  }),
)
