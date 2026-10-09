// FR-A-02/03/08·NFR-08: archive actual local artifacts, never clinical/public approval.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const [proof, browser, output] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-avatar-neck\.[A-Za-z0-9]+$/.test(proof))
assert(/^\/private\/tmp\/bodyguard-rig-proof\.[A-Za-z0-9]+$/.test(browser))
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
assert.equal(resolve(output), join(root, 'docs/review/avatar-neck-integration'))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (file) => JSON.parse(readFileSync(join(proof, file)))
const author = read('author.json')
const reopen = read('reopen.json')
assert(author.passed && reopen.passed && reopen.independent_reopen)
assert.equal(sha(readFileSync(join(proof, 'input.blend'))), author.loaded_sha256)
assert.equal(sha(readFileSync(join(proof, 'candidate.blend'))), author.output_sha256)
for (const dir of ['source-qa', 'roundtrip-qa', 'source-render-qa', 'roundtrip-render-qa']) {
  const report = read(`${dir}/deformation-report.json`)
  assert(report.passed && report.failures.length === 0)
  assert.equal(report.checks.length, 121)
  assert.equal(new Set(report.checks.map((row) => row.pose)).size, 119)
  const images = readdirSync(join(proof, dir)).filter((file) => file.endsWith('.png'))
  assert.equal(images.length, dir.includes('render') ? 34 : 0)
}
for (const file of ['unchanged-negative.json', 'overwrite-negative.json'])
  assert.equal(read(file).passed, false)
const web = JSON.parse(readFileSync(join(browser, 'browser-reviewed.json')))
assert.deepEqual(web.sourceBefore, web.sourceAfter)
assert.equal(web.samples.length, 2)
assert(web.samples.every((row) => row.passed && row.closed))
assert.deepEqual(web.boundary, { external: 0, camera: 0, errors: [] })
for (const [gender, expected] of Object.entries(web.assetHashes))
  assert.equal(sha(readFileSync(join(proof, 'glb', `bodyguard-${gender}-candidate.glb`))), expected)
for (const [file, expected] of Object.entries(web.sourceBefore))
  assert.equal(sha(readFileSync(join(root, 'frontend', file))), expected)

mkdirSync(output) // intentionally refuse a pre-existing evidence directory
const entries = []
function save(source, name, compress = false) {
  const raw = readFileSync(source)
  const bytes = compress ? gzipSync(raw, { level: 9, mtime: 0 }) : raw
  const destination = join(output, name)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, bytes, { flag: 'wx' })
  entries.push({
    file: name,
    bytes: bytes.length,
    sha256: sha(bytes),
    raw_sha256: sha(raw),
    compressed: compress,
  })
}
const jsonAndLogs = [
  'author.json',
  'author.log',
  'reopen.json',
  'reopen.log',
  'unchanged-negative.json',
  'unchanged-negative.log',
  'overwrite-negative.json',
  'overwrite-negative.log',
  'source-qa.log',
  'roundtrip-qa.log',
  'export.log',
  'source-render-qa.log',
  'roundtrip-render-qa.log',
  'new-ruff.log',
  'new-ruff-final.log',
  'new-format-final.log',
  'copied-helper-ef.log',
]
for (const file of jsonAndLogs) save(join(proof, file), `logs/${file}.gz`, true)
for (const dir of [
  'source-qa',
  'roundtrip-qa',
  'source-render-qa',
  'roundtrip-render-qa',
  'before-render',
  'after-render',
  'glb',
]) {
  for (const file of readdirSync(join(proof, dir))) {
    if (!statSync(join(proof, dir, file)).isFile()) continue
    save(
      join(proof, dir, file),
      `${dir}/${file}${file.endsWith('.json') ? '.gz' : ''}`,
      file.endsWith('.json'),
    )
  }
}
save(join(proof, 'author-executed.py'), 'executed/author-before-format.py.gz', true)
for (const file of readdirSync(dirname(fileURLToPath(import.meta.url)))) {
  if (!file.endsWith('.py')) continue
  save(join(dirname(fileURLToPath(import.meta.url)), file), `executed/${file}.gz`, true)
}
for (const file of readdirSync(browser)) {
  if (!/\.(png|log|json)$/.test(file)) continue
  save(
    join(browser, file),
    `browser/${file}${file.endsWith('.png') ? '' : '.gz'}`,
    !file.endsWith('.png'),
  )
}
save(join(browser, 'probe/probe.js'), 'executed/actual-browser-bundle.js.gz', true)
save(
  join(root, 'frontend/scripts/test-avatar-neck-browser.mjs'),
  'executed/test-avatar-neck-browser.mjs.gz',
  true,
)
save(join(proof, 'candidate.blend'), 'candidate-unapproved.blend')
save(join(proof, 'web.blend'), 'web-unapproved.blend')
save(join(proof, 'web-roundtrip.blend'), 'web-roundtrip-unapproved.blend')
writeFileSync(
  join(output, 'manifest.json'),
  JSON.stringify(
    {
      source_main: 'a46652833ce7380c6298d1a9d122a7b9e6db2cdd',
      original_draft_source: '25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad',
      input_source_sha256: author.loaded_sha256,
      candidate_sha256: author.output_sha256,
      actual_browser: web.browser,
      actual_camera: false,
      appearance_approved: false,
      final_avatar_adopted: false,
      stages_1_to_6_complete: false,
      entries,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
)
console.log(
  JSON.stringify({
    saved: entries.length,
    bytes: entries.reduce((n, e) => n + e.bytes, 0),
    appearance_approved: false,
  }),
)
