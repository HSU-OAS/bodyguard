// FR-V-03/NFR-08: publish numeric results and execution hashes, never raw DOM/errors.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = realpathSync(fileURLToPath(new URL('../../../frontend/', import.meta.url)))
const scratch = process.argv[2]
assert(/^\/private\/tmp\/bodyguard-startup-causal\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
const destination = fileURLToPath(new URL('./current-20261007/', import.meta.url))
mkdirSync(destination, { recursive: true })
assert.equal(realpathSync(destination), destination.replace(/\/$/, ''))
const sha = value => createHash('sha256').update(value).digest('hex')
const originals = []
function read(path) {
  const stat = lstatSync(path)
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size < 4 * 1024 * 1024)
  assert.equal(realpathSync(path), path)
  const bytes = readFileSync(path)
  originals.push({ path: path.replace(root, '[frontend]').replace(scratch, '[scratch]'),
    sha256: sha(bytes), originalPublished: false })
  return bytes
}
function save(name, value) {
  const path = join(destination, name)
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n')
  if (existsSync(path)) {
    const stat = lstatSync(path)
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1)
    assert.equal(realpathSync(path), path)
    assert(readFileSync(path).equals(bytes), 'Preserve prior current evidence')
    return
  }
  writeFileSync(path, bytes, { flag: 'wx' })
}
const commands = ['startup', 'negative', 'unit', 'check', 'type', 'build', 'guard',
  'selection', 'datahelp', 'records', 'design']
const executions = []
const reports = new Map()
for (const tag of commands) {
  const name = readdirSync(scratch).filter(name =>
    new RegExp('^' + tag + '-[0-9TZ]+\\.json$').test(name)).sort().at(-1)
  assert(name)
  const run = JSON.parse(read(join(scratch, name)))
  assert(run.sourceUnchanged && run.distUnchanged)
  assert.equal(run.code, tag === 'negative' ? 1 : 0)
  assert.equal(run.signal, null)
  for (const digest of Object.values(run.sourceBefore)) assert(/^[a-f0-9]{64}$/.test(digest))
  executions.push({ tag, start: run.start, end: run.end, head: run.head, exitCode: run.code,
    sourceUnchangedAcrossExecution: true, distUnchangedAcrossExecution: true,
    executedSourceHashes: run.sourceBefore, executedDistHashes: run.distBefore,
    captureSourceAtStart: run.captureSourceAtStart ?? null,
    captureSourceUnchanged: run.captureSourceUnchanged ?? null })
  if (['unit', 'check', 'type', 'build', 'guard'].includes(tag)) continue
  const candidates = tag === 'selection' ? ['selection-report.json'] :
    readdirSync(join(root, 'test-results')).filter(name => name.startsWith(
      ['startup', 'negative'].includes(tag) ? 'startup-' : tag + '-'))
      .map(name => name + '/report.json')
  const matching = candidates.filter(name => existsSync(join(root, 'test-results', name)))
    .map(name => ({ name, report: JSON.parse(read(join(root, 'test-results', name))) }))
    .filter(({ report }) => Date.parse(report.stats.startTime) >= Date.parse(run.start) &&
      Date.parse(report.stats.startTime) <= Date.parse(run.end))
  assert.equal(matching.length, 1)
  reports.set(tag, matching[0])
}
const cases = []
function walk(suite, tag) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? [])
    for (const result of test.results ?? []) cases.push({ tag, index: cases.length,
      status: result.status, durationMs: result.duration })
  for (const child of suite.suites ?? []) walk(child, tag)
}
for (const [tag, { report }] of reports) {
  assert.equal(report.stats.skipped, 0)
  assert.equal(report.stats.unexpected, tag === 'negative' ? 1 : 0)
  assert.equal(report.stats.flaky, 0)
  walk(report, tag)
}
for (const [tag, count] of Object.entries({
  startup: 5, negative: 1, selection: 8, datahelp: 3, records: 11, design: 3,
})) {
  const selected = cases.filter(item => item.tag === tag)
  assert.equal(selected.length, count)
  assert(selected.every(item => item.status === (tag === 'negative' ? 'failed' : 'passed')))
}
const negative = reports.get('negative').name.replace('/report.json', '')
const negativeVerified = JSON.parse(execFileSync(process.execPath,
  [join(root, 'scripts/verify-startup-negative.mjs'), 'test-results/' + negative],
  { encoding: 'utf8' }))
assert(negativeVerified.intentionalFailurePreserved && !negativeVerified.ariaSnapshotRetained)
const keys = new Set(('actualBrowser actualAuth actualCameraOrHuman productPerformanceGatePassed ' +
  'browserVersion surface transport routingDisablesHttpCache samples pageErrors externalRequests ' +
  'unexpectedApi modelRequests visit selectorPassed twoRafObserved gotoWallMs selectorWallMs observed ' +
  'probe initMs headingMs twoRafMs cameraCalls navigation responseEndMs domContentLoadedMs loadMs ' +
  'me startMs endMs resourceCount visible localStorageCount sessionStorageCount httpConnected ws ' +
  'connected timedOut apiStatuses meStatus wrongMethod trapConnections').split(' '))
function numericOnly(value, key = '') {
  if (value === null || typeof value === 'boolean') return
  if (typeof value === 'number') { assert(Number.isFinite(value) && value >= 0); return }
  if (typeof value === 'string') {
    assert(['first', 'repeat', 'production', 'dev', 'http', 'route'].includes(value) ||
      (key === 'browserVersion' && /^\d+(\.\d+)+$/.test(value)))
    return
  }
  if (Array.isArray(value)) { for (const item of value) numericOnly(item, key); return }
  assert(value && typeof value === 'object')
  for (const [name, item] of Object.entries(value)) {
    assert(keys.has(name), 'Unexpected observation field')
    numericOnly(item, name)
  }
}
const observations = []
function extract(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? [])
    for (const result of test.results ?? []) for (const attachment of result.attachments ?? []) {
      if (!['startup-observations.json', 'boundary-observations.json'].includes(attachment.name)) continue
      assert(attachment.body)
      const value = JSON.parse(Buffer.from(attachment.body, 'base64').toString())
      numericOnly(value)
      observations.push({ name: attachment.name, value })
    }
  for (const child of suite.suites ?? []) extract(child)
}
extract(reports.get('startup').report)
assert.equal(observations.length, 5)
for (const { value } of observations.filter(item => item.name === 'startup-observations.json')) {
  assert.equal(value.samples.length, 2)
  assert(value.samples.every(item => item.selectorPassed && item.twoRafObserved &&
    item.observed.probe.headingMs !== null && item.observed.probe.twoRafMs !== null &&
    item.observed.probe.twoRafMs >= item.observed.probe.headingMs &&
    item.observed.probe.cameraCalls === 0 && item.observed.visible &&
    item.observed.localStorageCount === 0 && item.observed.sessionStorageCount === 0))
  assert.equal(value.pageErrors + value.externalRequests + value.unexpectedApi + value.modelRequests, 0)
}
save('startup-observations.json', observations)
save('negative-artifacts.json', negativeVerified)
const cancellationName = readdirSync(scratch).filter(name =>
  /^cancellation-[0-9TZ]+\.json$/.test(name)).sort().at(-1)
const cancellation = JSON.parse(read(join(scratch, cancellationName)))
assert(cancellation.sourceUnchanged)
assert.equal(cancellation.sourceBefore, sha(readFileSync(join(root, 'scripts/test-startup-browser.mjs'))))
assert(cancellation.samples.every(sample => sample.reached && sample.code === 1 &&
  sample.signal === null && sample.listenersClosed))
save('cancellation.json', cancellation)
save('executions.json', executions)
save('summary.json', {
  executions: executions.map(run => ({ tag: run.tag, exitCode: run.exitCode })),
  browserCases: cases, negativeVerified,
  harnessMandatoryGatesPassed: true, productStartupCauseResolved: false,
  classifierValidated: false, actualHumanValidated: false, allStagesComplete: false,
  originals, rawDOMPublished: false,
})
console.log(JSON.stringify({ harnessMandatoryGatesPassed: true, rawDOMPublished: false,
  productStartupCauseResolved: false, allStagesComplete: false }))
