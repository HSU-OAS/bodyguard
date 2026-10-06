// Validate the flat JUnit dialect emitted by the pinned Vitest/pytest runners.
// Every suite is checked: a passing child must never hide a failing aggregate.
import assert from 'node:assert/strict'

function counter(attributes, name, required = true) {
  const matches = [...attributes.matchAll(new RegExp(`\\b${name}="([^"]*)"`, 'g'))]
  if (!required && matches.length === 0) return undefined
  assert.equal(matches.length, 1, `Exactly one ${name} counter required`)
  assert.match(matches[0][1], /^(?:0|[1-9]\d*)$/, `Invalid ${name} counter`)
  const value = Number(matches[0][1])
  assert(Number.isSafeInteger(value), `Unsafe ${name} counter`)
  return value
}

export function passingJUnit(xml, expected) {
  assert(!/<!DOCTYPE|<!ENTITY/.test(xml), 'No external entities in evidence')
  assert(!/<!--|<!\[CDATA\[/.test(xml), 'Unsupported non-element evidence markup')
  const roots = [...xml.matchAll(/<testsuites(?=[\s>])([^>]*)>/g)]
  assert.equal(roots.length, 1)
  assert.equal((xml.match(/<\/testsuites\s*>/g) ?? []).length, 1)
  const suites = [...xml.matchAll(/<testsuite(?=[\s>])([^>]*)>/g)]
  assert(suites.length > 0)
  assert.equal((xml.match(/<\/testsuite\s*>/g) ?? []).length, suites.length)
  let total = 0
  for (const [, attributes] of suites) {
    total += counter(attributes, 'tests')
    for (const field of ['failures', 'errors', 'skipped']) assert.equal(counter(attributes, field), 0)
  }
  assert.equal(total, expected)
  const rootTests = counter(roots[0][1], 'tests', false)
  if (rootTests !== undefined) assert.equal(rootTests, expected)
  for (const field of ['failures', 'errors', 'skipped']) {
    const value = counter(roots[0][1], field, false)
    if (value !== undefined) assert.equal(value, 0)
  }
  assert.equal((xml.match(/<testcase(?=[\s/>])/g) ?? []).length, expected)
  assert(!/<(?:failure|error|skipped)(?=[\s/>])/.test(xml), 'Unsuccessful testcase present')
}

export function passingPublicBrowser(log) {
  assert.match(log, /^\s*8 passed \([0-9.]+(?:ms|s|m)\)\s*$/m)
  assert(!/^\s*\d+ (?:failed|skipped|flaky|interrupted|did not run)\b/m.test(log))
}
