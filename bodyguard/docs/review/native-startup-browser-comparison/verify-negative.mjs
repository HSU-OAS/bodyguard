// NFR-08/FR-M-07: mutate private fixture copies, never the retained execution evidence.
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const source = dirname(fileURLToPath(import.meta.url))
const proof = mkdtempSync(join(tmpdir(), 'bodyguard-startup-evidence-negative-'))
const cases = [
  ['unchanged', () => {}, true],
  [
    'false-completion',
    (m) => {
      m.startupP2Resolved = true
    },
    false,
  ],
  [
    'hidden-failure',
    (m) => {
      m.runs[1].stats.unexpected = 0
    },
    false,
  ],
  [
    'missing-original-case',
    (m) => {
      m.originalCases.pop()
    },
    false,
  ],
  [
    'missing-full-timing',
    (m) => {
      m.runs[7].fullTiming = false
    },
    false,
  ],
  [
    'unapproved-source-path',
    (m) => {
      m.sources[0].path = '../../outside'
    },
    false,
  ],
  [
    'invalid-evidence-path',
    (m) => {
      m.files[0].file = '../../outside.gz'
    },
    false,
  ],
  [
    'corrupt-evidence-hash',
    (m) => {
      m.files[0].sha256 = '0'.repeat(64)
    },
    false,
  ],
  [
    'duplicate-evidence',
    (m) => {
      m.files.push(m.files[0])
    },
    false,
  ],
]

for (const [label, mutate, accepted] of cases) {
  const output = join(proof, label)
  cpSync(source, output, { recursive: true, errorOnExist: true })
  const path = join(output, 'manifest.json')
  const manifest = JSON.parse(readFileSync(path))
  mutate(manifest)
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n')
  const start = new Date().toISOString()
  const result = spawnSync(process.execPath, [join(output, 'verify.mjs')], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })
  for (const kind of ['stdout', 'stderr']) {
    writeFileSync(join(output, kind + '.txt'), result[kind] ?? '', { flag: 'wx', mode: 0o600 })
  }
  writeFileSync(
    join(output, 'receipt.json'),
    JSON.stringify(
      {
        label,
        accepted,
        start,
        end: new Date().toISOString(),
        status: result.status,
        signal: result.signal,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx', mode: 0o600 },
  )
  assert.equal(result.signal, null)
  assert.notEqual(result.status, null)
  assert.equal(result.status === 0, accepted, label)
  console.log(JSON.stringify({ label, accepted, status: result.status }))
}
console.log(
  JSON.stringify({
    proof,
    malformedRejected: 8,
    startupP2Resolved: false,
    actualBrowserRerun: false,
  }),
)
