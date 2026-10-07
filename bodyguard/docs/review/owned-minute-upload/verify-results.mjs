// NFR-07/08: reuse passing flat JUnit checks; inspect every browser result, not just totals.
import assert from 'node:assert/strict'
export { passingJUnit, passingPublicBrowser } from '../minute-summary-web/verify-results.mjs'
export function passingBrowser(report, expected) {
  assert.deepEqual(Object.fromEntries(['expected', 'unexpected', 'skipped', 'flaky'].map(key =>
    [key, report.stats?.[key]])), { expected, unexpected: 0, skipped: 0, flaky: 0 })
  assert.deepEqual(report.errors, [])
  let count = 0
  function walk(suites) {
    assert(Array.isArray(suites))
    for (const suite of suites) {
      assert(Array.isArray(suite.specs))
      assert(suite.suites === undefined || Array.isArray(suite.suites))
      for (const spec of suite.specs) {
        assert.equal(spec.ok, true)
        assert.equal(spec.tests.length, 1)
        for (const test of spec.tests) {
          assert.equal(test.expectedStatus, 'passed')
          assert.equal(test.status, 'expected')
          assert.equal(test.results.length, 1)
          assert.equal(test.results[0].status, 'passed')
          assert.deepEqual(test.results[0].errors, [])
          assert(!test.results[0].error)
          count++
        }
      }
      walk(suite.suites ?? [])
    }
  }
  walk(report.suites)
  assert.equal(count, expected)
}
