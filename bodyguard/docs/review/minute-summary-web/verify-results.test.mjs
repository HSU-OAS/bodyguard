import assert from 'node:assert/strict'
import test from 'node:test'
import { passingJUnit, passingPublicBrowser } from './verify-results.mjs'

const suite = (count, values = '') => `<testsuite tests="${count}" failures="0" errors="0" skipped="0" ${values}>${'<testcase />'.repeat(count)}</testsuite>`
const root = (body, values = '') => `<testsuites ${values}>${body}</testsuites>`

test('real runner-shaped aggregate and suite-only totals', () => {
  passingJUnit(root(suite(2) + suite(1), 'tests="3" failures="0" errors="0"'), 3)
  passingJUnit(root(suite(3)), 3)
})
test('a passing child cannot hide root failure, error, or skip', () => {
  for (const field of ['failures', 'errors', 'skipped'])
    assert.throws(() => passingJUnit(root(suite(2), `tests="2" ${field}="1"`), 2))
})
test('a passing sibling cannot hide a failed, erroneous, or skipped suite', () => {
  for (const field of ['failures', 'errors', 'skipped'])
    assert.throws(() => passingJUnit(root(suite(1) + suite(1).replace(`${field}="0"`, `${field}="1"`)), 2))
})
test('aggregate, suite totals and actual testcase counts must agree', () => {
  assert.throws(() => passingJUnit(root(suite(2), 'tests="3"'), 2))
  assert.throws(() => passingJUnit(root(suite(2)), 3))
  assert.throws(() => passingJUnit(root(suite(2).replace('<testcase />', '')), 2))
})
test('testcase failure tags override zero counters', () => {
  for (const tag of ['failure', 'error', 'skipped'])
    assert.throws(() => passingJUnit(root(suite(1).replace('<testcase />', `<testcase><${tag}/></testcase>`)), 1))
})
test('comment and CDATA markup cannot manufacture a testcase count', () => {
  for (const fake of ['<!--<testcase />-->', '<![CDATA[<testcase />]]>'])
    assert.throws(() => passingJUnit(root(suite(1).replace('<testcase />', fake)), 1))
})
test('invalid, absent or duplicate counters and unsupported wrappers are rejected', () => {
  for (const body of [suite(1, 'tests="1"'), suite(1).replace('tests="1"', 'tests="1.1"'), suite(1).replace('skipped="0"', ''), suite(1).replace('</testsuite>', ''), ''])
    assert.throws(() => passingJUnit(root(body), 1))
  assert.throws(() => passingJUnit('<!DOCTYPE x>' + root(suite(1)), 1))
})
test('public browser complete summary, not a passing substring', () => {
  passingPublicBrowser('warning\n  8 passed (13.6s)\n')
  for (const log of ['8 passed, 1 failed (13.6s)', '18 passed (13.6s)', '8 passed (13.6s)\n1 failed', '1 skipped\n8 passed (13.6s)', '8 passed (13.6s)\n1 flaky'])
    assert.throws(() => passingPublicBrowser(log))
})
