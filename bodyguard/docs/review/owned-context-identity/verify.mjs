// FR-U-04/FR-R-03/FR-N-03/NFR-08: archive actual executions, never credentials or mailboxes.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const dest = dirname(fileURLToPath(import.meta.url)), root = resolve(dest, '../../../..')
const baseline = '0b440af763e8247680caa2c1335036cf7497d0e5'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const git = (...args) => execFileSync('git', args, { cwd: root })
const inputs = [
  'bodyguard/backend/app/main.py', 'bodyguard/backend/app/notification_preferences.py',
  'bodyguard/backend/tests/test_notification_preferences.py',
  'bodyguard/frontend/src/api/minuteSummaries.ts', 'bodyguard/frontend/src/api/minuteSummaries.test.ts',
  'bodyguard/frontend/src/api/notificationPreferences.ts', 'bodyguard/frontend/src/api/notificationPreferences.test.ts',
  'bodyguard/frontend/src/api/generated/types.gen.ts', 'bodyguard/frontend/e2e/notifications.spec.ts',
]
const raw = entry => gunzipSync(readFileSync(resolve(dest, entry.file)))
function validate(m) {
  for (const [name, entry] of Object.entries(m.artifacts)) {
    assert.equal(sha(raw(entry)), entry.sha256, name)
    assert.equal(raw(entry).length, entry.bytes, name)
    assert.equal(sha(readFileSync(resolve(dest, entry.file))), entry.gzipSha256, name)
  }
  for (const [file, digest] of Object.entries(m.source)) assert.equal(sha(readFileSync(resolve(root, file))), digest, file)
  for (const [file, digest] of Object.entries(m.unchanged)) {
    assert.equal(sha(git('show', `${baseline}:${file}`)), digest, file)
    assert.equal(sha(readFileSync(resolve(root, file))), digest, file)
  }
  const read = name => raw(m.artifacts[name]).toString(), json = name => JSON.parse(read(name))
  for (const [name, expected] of [['red.json', [67, 58, 9, 0]], ['focused-green.json', [67, 67, 0, 0]], ['unit.json', [1577, 1577, 0, 0]]]) {
    const v = json(name)
    assert.deepEqual([v.numTotalTests, v.numPassedTests, v.numFailedTests, v.numPendingTests], expected)
    assert.equal(v.success, expected[2] === 0)
  }
  assert(read('api-red.log').includes('assert 200 == 403'))
  assert(read('api-green.log').includes('537 passed, 4 warnings'))
  assert(read('api.xml').includes('tests="537"'))
  assert(!/<(?:failure|error|skipped)(?:\s|>)/.test(read('api.xml')))
  const red = json('native-red-report.json')
  assert.deepEqual([red.stats.expected, red.stats.unexpected, red.stats.flaky, red.stats.skipped], [0, 1, 0, 0])
  assert(read('native-red.log').includes('Received: 200'))
  for (const [name, count, receiptName, cameraField] of [
    ['notifications-report.json', 5, 'notification-boundaries.json', 'cameraCalls'],
    ['summaries-report.json', 4, 'summary-boundaries.json', 'camera'],
  ]) {
    const report = json(name)
    assert.deepEqual([report.stats.expected, report.stats.unexpected, report.stats.flaky, report.stats.skipped], [count, 0, 0, 0])
    assert.equal(report.errors.length, 0)
    const specs = report.suites.flatMap(s => s.specs)
    assert.equal(specs.length, count)
    for (const spec of specs) {
      assert(spec.ok)
      assert.equal(spec.tests.length, 1)
      const results = spec.tests[0].results
      assert.equal(results.length, 1)
      assert.equal(results[0].status, 'passed')
      assert.equal(results[0].retry, 0)
      const receipt = results[0].attachments.find(a => a.name === receiptName)
      assert(receipt?.body)
      const b = JSON.parse(Buffer.from(receipt.body, 'base64'))
      assert.equal(b.actualProductionChromeHttpSql, true)
      assert.equal(b[cameraField], 0)
      assert.deepEqual([b.unexpected, b.errors, b.storage], [[], [], [0, 0]])
      assert(b.browser)
    }
  }
  for (const prefix of ['api', 'native']) {
    assert(read(`${prefix}-db-ownership.log`).includes('bodyguard_test|bodyguard_test|/private/tmp/bodyguard-auth-test.'))
    assert(read(`${prefix}-db-stop.log`).includes('server stopped'))
    assert(read(`${prefix}-db-status.log`).includes('no server running'))
  }
  assert.equal(m.public.beforeCss, m.public.afterCss)
  assert.notEqual(m.public.beforeJs, m.public.afterJs) // Guard changes intentionally alter public JS.
  return { artifacts: Object.keys(m.artifacts).length, source: Object.keys(m.source).length,
    unchanged: Object.keys(m.unchanged).length, unit: 1577, api: 537, native: 9, originalFailures: 11 }
}
if (process.argv[2] === '--check') {
  console.log(JSON.stringify(validate(JSON.parse(readFileSync(resolve(dest, 'manifest.json'))))))
} else {
  const scratch = process.argv[2]
  assert(scratch && /^\/private\/tmp\/bodyguard-owner-lease\.[A-Za-z0-9]+$/.test(scratch))
  assert.equal(git('rev-parse', 'HEAD').toString().trim(), baseline)
  const m = { baseline, collectedAt: new Date().toISOString(), artifacts: {}, source: {}, unchanged: {}, public: {} }
  function archive(name, bytes) {
    const file = `evidence/${name}.gz`, compressed = gzipSync(bytes)
    mkdirSync(dirname(resolve(dest, file)), { recursive: true })
    writeFileSync(resolve(dest, file), compressed)
    m.artifacts[name] = { file, bytes: bytes.length, sha256: sha(bytes), gzipSha256: sha(compressed) }
  }
  for (const file of inputs) {
    const bytes = readFileSync(resolve(root, file))
    assert.equal(sha(bytes), sha(readFileSync(resolve(scratch, 'final-source', basename(file)))), file)
    m.source[file] = sha(bytes)
    archive(`source/${file}`, bytes)
  }
  for (const name of readdirSync(resolve(scratch, 'red-source'))) archive(`red-source/${name}`, readFileSync(resolve(scratch, 'red-source', name)))
  for (const name of ['red.json', 'red.log', 'focused-green.json', 'focused-green.log', 'unit.json', 'unit.log',
    'api-red.log', 'api-green.log', 'api.xml', 'api-startup-failed.log', 'api-socket-denied.log',
    'native-red.log', 'native-red-report.json', 'notifications-green.log', 'summaries-green.log',
    'gen-api.log', 'typecheck.log', 'biome.log', 'ruff.log', 'ruff-format.log', 'mypy.log', 'private-guard.log',
    ...['api', 'native'].flatMap(p => ['ownership', 'pid', 'stop', 'status'].map(s => `${p}-db-${s}.log`))]) archive(name, readFileSync(resolve(scratch, name)))
  for (const [name, directory] of [
    ['notifications', 'bodyguard/frontend/test-results/notifications-20261010T123937080809Z'],
    ['summaries', 'bodyguard/frontend/test-results/summaries-20261010T124029887557Z'],
  ]) {
    archive(`${name}-report.json`, readFileSync(resolve(root, directory, 'report.json')))
    const screen = readdirSync(resolve(root, directory), { recursive: true }).find(f => basename(String(f)) === (name === 'notifications' ? 'notifications-saved.png' : 'summary-desktop-viewport.png'))
    assert(screen)
    const bytes = readFileSync(resolve(root, directory, String(screen)))
    archive(`${name}-screen.png`, bytes)
    writeFileSync(resolve(dest, `${name}.png`), bytes)
  }
  const files = git('ls-tree', '-r', '--name-only', baseline, 'bodyguard/frontend/src', 'bodyguard/backend/app',
    'bodyguard/backend/migrations', 'bodyguard/frontend/pnpm-lock.yaml', 'bodyguard/backend/uv.lock', 'bodyguard/compose.yaml')
    .toString().trim().split('\n').filter(f => !inputs.includes(f))
  for (const file of files) m.unchanged[file] = sha(git('show', `${baseline}:${file}`))
  for (const [name, directory] of [['before', resolve(scratch, 'public-before')], ['after', resolve(root, 'bodyguard/frontend/dist/assets')]])
    for (const suffix of ['css', 'js']) {
      const matches = readdirSync(directory).filter(f => f.endsWith(`.${suffix}`))
      assert.equal(matches.length, 1)
      const bytes = readFileSync(resolve(directory, matches[0]))
      archive(`public-${name}.${suffix}`, bytes)
      m.public[`${name}${suffix === 'css' ? 'Css' : 'Js'}`] = sha(bytes)
    }
  const self = 'bodyguard/docs/review/owned-context-identity/verify.mjs'
  m.source[self] = sha(readFileSync(resolve(root, self)))
  console.log(JSON.stringify(validate(m)))
  writeFileSync(resolve(dest, 'manifest.json'), `${JSON.stringify(m, null, 2)}\n`)
}
