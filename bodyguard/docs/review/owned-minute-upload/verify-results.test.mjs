import assert from 'node:assert/strict'
import test from 'node:test'
import { passingBrowser } from './verify-results.mjs'
function report() {
  return { stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 }, errors: [],
    suites: [{ suites: [], specs: [{ ok: true, tests: [{ expectedStatus: 'passed',
      status: 'expected', results: [{ status: 'passed', errors: [] }] }] }] }] }
}
test('complete browser result accepted, including pinned runner omitted leaf suites', () => {
  passingBrowser(report(), 1)
  const value = report()
  delete value.suites[0].suites
  passingBrowser(value, 1)
})
test('passing aggregate cannot hide failed, skipped, retried or missing testcase', () => {
  for (const status of ['failed', 'skipped', 'timedOut', 'interrupted']) {
    const value = report(); value.suites[0].specs[0].tests[0].results[0].status = status
    assert.throws(() => passingBrowser(value, 1))
  }
  const missing = report(); missing.suites[0].specs = []
  assert.throws(() => passingBrowser(missing, 1))
  const retried = report(); retried.suites[0].specs[0].tests[0].results.push({ status: 'passed', errors: [] })
  assert.throws(() => passingBrowser(retried, 1))
})
test('browser error and unexpected aggregate rejected', () => {
  const value = report(); value.errors.push({ message: 'error' })
  assert.throws(() => passingBrowser(value, 1))
  for (const key of ['unexpected', 'skipped', 'flaky']) {
    const next = report(); next.stats[key] = 1
    assert.throws(() => passingBrowser(next, 1))
  }
})
test('passing sibling cannot hide another failed spec or wrong expected status', () => {
  const value = report()
  value.suites[0].specs.push({ ok: false, tests: [] })
  assert.throws(() => passingBrowser(value, 1))
  const reversed = report()
  reversed.suites[0].specs[0].tests[0].expectedStatus = 'failed'
  assert.throws(() => passingBrowser(reversed, 1))
})
