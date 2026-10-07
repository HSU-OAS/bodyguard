// FR-V-03/NFR-08: verify an intentional failed run without publishing its raw files.
import assert from 'node:assert/strict'
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)))
const relative = process.argv[2]
assert(/^test-results\/startup-[0-9TZ]+$/.test(relative ?? ''))
const directory = resolve(root, relative)
assert.equal(realpathSync(directory), directory)
const results = []
const reportPath = join(directory, 'report.json')
const reportStat = lstatSync(reportPath)
assert(reportStat.isFile() && !reportStat.isSymbolicLink() && reportStat.size < 4 * 1024 * 1024)
assert.equal(realpathSync(reportPath), reportPath)
let report
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch {
  throw new Error('Invalid owned negative report')
}
function walk(suite) {
  for (const spec of suite.specs ?? [])
    for (const test of spec.tests ?? [])
      for (const result of test.results ?? []) results.push({ title: spec.title, ...result })
  for (const child of suite.suites ?? []) walk(child)
}
walk(report)
assert.equal(report.stats.unexpected, 1)
assert.equal(report.stats.expected, 0)
assert.equal(report.stats.skipped, 0)
assert.equal(results.length, 1)
assert.equal(results[0].title, 'startup negative: closed pages omit failure DOM artifacts')
assert.equal(results[0].status, 'failed')
assert(results[0].duration >= 4900, 'Keep the real visibility deadline')
let textFiles = 0
function inspect(path) {
  const stat = lstatSync(path)
  assert(!stat.isSymbolicLink() && realpathSync(path) === path)
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) inspect(join(path, name))
    return
  }
  assert(stat.isFile() && stat.size < 4 * 1024 * 1024)
  assert(/\.(json|md|txt)$/.test(path), 'No screenshot, trace or video in this failed run')
  const text = readFileSync(path, 'utf8')
  assert(!text.includes('SYNTHETIC_PRIVATE_DOM_SENTINEL'), 'Runtime DOM sentinel retained')
  assert(!text.includes('# Page snapshot') && !text.includes('```yaml'), 'ARIA snapshot retained')
  textFiles++
}
inspect(directory)
console.log(
  JSON.stringify({
    intentionalFailurePreserved: true,
    unexpectedFailures: 1,
    runtimeDomSentinelRetained: false,
    ariaSnapshotRetained: false,
    textFiles,
    productGatePassed: false,
  }),
)
