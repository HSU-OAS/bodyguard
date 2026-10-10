// S4.D4 / NFR-08: retain actual screenshots, original sources and failed attempts unchanged.
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const [proofRoot, acceptedRoot] = process.argv.slice(2)
assert(proofRoot?.startsWith('/private/tmp/bodyguard-account-minimal-copy-proof.'))
assert(acceptedRoot === join(proofRoot, 'accepted3'))
const root = fileURLToPath(new URL('..', import.meta.url))
const output = resolve(root, '../docs/review/account-minimal-copy/evidence')
mkdirSync(output, { recursive: false })
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const manifest = {
  provenance:
    'Actual production Chrome screenshots; synthetic API/credentials, no real mail/SQL/camera.',
  original: {},
  artifacts: {},
  current: {},
}
function inventory(folder, prefix = '') {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const relative = join(prefix, entry.name)
    if (entry.isDirectory()) inventory(join(folder, entry.name), relative)
    else {
      assert(entry.isFile())
      manifest.original[relative] = sha(readFileSync(join(folder, entry.name)))
    }
  }
}
inventory(proofRoot)
execFileSync('tar', ['-czf', join(output, 'original-proof.tar.gz'), '-C', proofRoot, '.'])
manifest.artifacts['original-proof.tar.gz'] = sha(
  readFileSync(join(output, 'original-proof.tar.gz')),
)
for (const phase of ['baseline', 'final']) {
  const report = JSON.parse(readFileSync(join(acceptedRoot, phase, 'report.json'), 'utf8'))
  assert(report.passed && report.screens.length === 14 && report.flows.length === 7)
  assert(
    report.cameraCalls === 0 &&
      report.externalOrigins.length === 0 &&
      report.pageErrors.length === 0,
  )
  for (const name of [
    'report.json',
    '1-member-1440.png',
    '3-reset-1440.png',
    '8-forgot-800.png',
    '14-complete-1440.png',
  ]) {
    const target = `${phase}-${name}`
    copyFileSync(join(acceptedRoot, phase, name), join(output, target))
    manifest.artifacts[target] = sha(readFileSync(join(output, target)))
  }
  for (const [file, expected] of Object.entries(report.source)) {
    const index = Object.keys(report.source).indexOf(file)
    assert(sha(readFileSync(join(acceptedRoot, phase, `source-${index}.txt`))) === expected)
    if (phase === 'final') assert(sha(readFileSync(join(root, file))) === expected)
  }
}
for (const file of [
  'src/pages/MemberPage.tsx',
  'src/pages/PasswordPage.tsx',
  'src/pages/MemberPage.test.tsx',
  'src/pages/PasswordPage.test.tsx',
  'scripts/test-account-copy-browser.mjs',
]) {
  const bytes = readFileSync(join(root, file))
  const target = `current-${file.replaceAll('/', '--')}.gz`
  writeFileSync(join(output, target), gzipSync(bytes))
  manifest.artifacts[target] = sha(readFileSync(join(output, target)))
  manifest.current[file] = sha(bytes)
}
for (const name of readdirSync(join(root, 'dist/assets'))) {
  if (!/\.(js|css)$/.test(name)) continue
  const target = `production-${name}.gz`
  writeFileSync(join(output, target), gzipSync(readFileSync(join(root, 'dist/assets', name))))
  manifest.artifacts[target] = sha(readFileSync(join(output, target)))
}
writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2))
process.stdout.write(
  `${JSON.stringify({ original: Object.keys(manifest.original).length, artifacts: Object.keys(manifest.artifacts).length, current: Object.keys(manifest.current).length })}\n`,
)
