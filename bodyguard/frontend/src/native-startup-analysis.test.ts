// NFR-08·FR-M-02/07: synthetic evidence validation, not native/human or release proof.
import { describe, expect, test } from 'vitest'
import { analyzeNativeStartupRuns } from '../e2e/fixtures/nativeStartupAnalysis'

const hash = 'a'.repeat(64)
function run(variant: 'baseline' | 'candidate', minute = variant === 'baseline' ? 1 : 2) {
  return {
    id: `case-${variant}-${minute}`,
    variant,
    gender: 'male',
    head: (variant === 'baseline' ? '1' : '2').repeat(40),
    beforeSha: variant === 'baseline' ? hash : 'b'.repeat(64),
    afterSha: variant === 'baseline' ? hash : 'b'.repeat(64),
    browser: '154.0.8037.98',
    sdk: '1.0.1',
    assetsSha: hash,
    receiptStart: `2026-10-08T14:0${minute}:00.000Z`,
    reportStart: `2026-10-08T14:0${minute}:01.000Z`,
    receiptEnd: `2026-10-08T14:0${minute}:40.000Z`,
    exitCode: 0,
    pollMs: 5000,
    caseTimeoutMs: 60000,
    retries: 0,
    fakeCamera: true,
    actualPeople: 0,
    physicalCamera: false,
    stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
    timing: {
      closed: true,
      invalid: false,
      events: [
        { stage: 'camera', startMs: 0, endMs: 500 },
        { stage: 'body-sdk', startMs: 501, endMs: 1000 },
        { stage: 'face-sdk', startMs: 1001, endMs: 1400 },
        { stage: 'hands-sdk', startMs: 1401, endMs: 1700 },
        { stage: 'avatar', startMs: 1701, endMs: 2000 },
        { stage: 'render', startMs: 2001, endMs: 2100 },
        { stage: 'result', startMs: 2101, endMs: 3300 },
        { stage: 'result', startMs: 3301, endMs: 3400 },
        { stage: 'result', startMs: 3401, endMs: 3500 },
      ],
    },
  }
}
const pair = () => [run('baseline'), run('candidate')]
const invalid = { valid: false, reason: 'Invalid startup evidence' }
describe('bounded offline native startup evidence', () => {
  test('normal rechecks do not close the mandatory regression, cause or release gate', () => {
    expect(analyzeNativeStartupRuns(pair())).toMatchObject({
      valid: true,
      counts: { passed: 2, failed: 0, skipped: 0 },
      reproduction: 'not-reproduced',
      causalityEstablished: false,
      mandatoryRegressionRetested: false,
      productGatePassed: false,
      cases: expect.arrayContaining([
        expect.objectContaining({ sdkPreparedMs: 1700, firstResultMs: 3300, thirdResultMs: 3500 }),
      ]),
    })
  })
  test('baseline failure refutes candidate necessity only, missing timing stays missing', () => {
    const input = pair()
    input[0].exitCode = 1
    input[0].stats = { expected: 0, unexpected: 1, skipped: 0, flaky: 0 }
    input[0].timing.events = []
    expect(analyzeNativeStartupRuns(input)).toMatchObject({
      valid: true,
      counts: { passed: 1, failed: 1, skipped: 0 },
      reproduction: 'baseline-failed',
      cases: expect.arrayContaining([
        expect.objectContaining({ outcome: 'failed', sdkPreparedMs: null, firstResultMs: null }),
      ]),
      causalityEstablished: false,
    })
  })
  test('candidate-only failure is not causal proof; skips never count as passed', () => {
    const input = pair()
    input[1].exitCode = 1
    input[1].stats = { expected: 0, unexpected: 1, skipped: 0, flaky: 0 }
    expect(analyzeNativeStartupRuns(input)).toMatchObject({
      reproduction: 'candidate-only-failed',
      causalityEstablished: false,
    })
    input[1].exitCode = 0
    input[1].stats = { expected: 0, unexpected: 0, skipped: 1, flaky: 0 }
    expect(analyzeNativeStartupRuns(input)).toMatchObject({
      counts: { passed: 1, failed: 0, skipped: 1 },
      reproduction: 'incomplete',
    })
  })
  test('both variants failing are kept distinct', () => {
    const input = pair()
    for (const item of input) {
      item.exitCode = 1
      item.stats = { expected: 0, unexpected: 1, skipped: 0, flaky: 0 }
    }
    expect(analyzeNativeStartupRuns(input)).toMatchObject({
      counts: { passed: 0, failed: 2, skipped: 0 },
      reproduction: 'both-failed',
    })
  })
  test('multiple factory attempts use the last completed SDK event before first avatar', () => {
    const input = pair()
    input[0].timing.events.splice(4, 0, {
      stage: 'hands-sdk',
      startMs: 1700,
      endMs: 1701,
    })
    expect(analyzeNativeStartupRuns(input)).toMatchObject({
      cases: expect.arrayContaining([expect.objectContaining({ sdkPreparedMs: 1701 })]),
    })
  })
  test('an unfinished SDK attempt before first avatar is never called prepared', () => {
    const input = pair()
    input[0].timing.events.splice(4, 0, {
      stage: 'hands-sdk',
      startMs: 1700,
      endMs: 1701,
    })
    Object.assign(input[0].timing.events[4], { endMs: null })
    expect(analyzeNativeStartupRuns(input)).toMatchObject({
      cases: expect.arrayContaining([expect.objectContaining({ sdkPreparedMs: null })]),
    })
  })
  test('a second generation cannot overwrite the first preparation milestone', () => {
    const input = pair()
    input[0].timing.events.push(
      { stage: 'body-sdk', startMs: 3600, endMs: 3700 },
      { stage: 'face-sdk', startMs: 3701, endMs: 3800 },
      { stage: 'hands-sdk', startMs: 3801, endMs: 3900 },
      { stage: 'avatar', startMs: 3901, endMs: 4000 },
    )
    expect(analyzeNativeStartupRuns(input)).toMatchObject({
      cases: expect.arrayContaining([expect.objectContaining({ sdkPreparedMs: 1700 })]),
    })
  })
  test('per-stage count, backwards events, extra identity fields and symbol payloads reject', () => {
    const input = pair()
    input[0].timing.events.push({ stage: 'result', startMs: 3600, endMs: 3700 })
    expect(analyzeNativeStartupRuns(input)).toEqual(invalid)
    const backwards = pair()
    backwards[0].timing.events[1].endMs = 400
    expect(analyzeNativeStartupRuns(backwards)).toEqual(invalid)
    const foreign = pair()
    Object.assign(foreign[0].stats, { accountId: 'PRIVATE_ID' })
    expect(analyzeNativeStartupRuns(foreign)).toEqual(invalid)
    const symbolic = pair()
    Object.assign(symbolic[0], { [Symbol('PRIVATE_ID')]: 'PRIVATE_COORDINATES' })
    expect(analyzeNativeStartupRuns(symbolic)).toEqual(invalid)
  })
  test.each([
    (r: ReturnType<typeof run>) => {
      r.afterSha = 'c'.repeat(64)
    },
    (r: ReturnType<typeof run>) => {
      r.head = 'bad'
    },
    (r: ReturnType<typeof run>) => {
      r.exitCode = 1
    },
    (r: ReturnType<typeof run>) => {
      r.pollMs = 15000
    },
    (r: ReturnType<typeof run>) => {
      r.caseTimeoutMs = 120000
    },
    (r: ReturnType<typeof run>) => {
      r.retries = 1
    },
    (r: ReturnType<typeof run>) => {
      r.actualPeople = 1
    },
    (r: ReturnType<typeof run>) => {
      r.physicalCamera = true
    },
    (r: ReturnType<typeof run>) => {
      r.fakeCamera = false
    },
    (r: ReturnType<typeof run>) => {
      r.stats.flaky = 1
    },
    (r: ReturnType<typeof run>) => {
      r.stats.expected = 0
    },
    (r: ReturnType<typeof run>) => {
      r.reportStart = '2026-10-09T00:00:00.000Z'
    },
    (r: ReturnType<typeof run>) => {
      r.receiptStart = '2026-02-30T14:00:00.000Z'
    },
    (r: ReturnType<typeof run>) => {
      r.timing.invalid = true
    },
    (r: ReturnType<typeof run>) => {
      r.timing.closed = false
    },
    (r: ReturnType<typeof run>) => {
      r.timing.events[0].endMs = -1
    },
    (r: ReturnType<typeof run>) => {
      r.timing.events[1].startMs = NaN
    },
    (r: ReturnType<typeof run>) => {
      r.timing.events[1].stage = 'PRIVATE_COORDINATES'
    },
    (r: ReturnType<typeof run>) => {
      r.timing.events.push(...Array(31).fill(r.timing.events[0]))
    },
  ])('rejects inconsistent or changed scope without echoing supplied data: %s', (change) => {
    const input = pair()
    change(input[0])
    expect(analyzeNativeStartupRuns(input)).toEqual(invalid)
  })
  test.each(['browser', 'sdk', 'assetsSha', 'gender'] as const)(
    'changed comparison %s is not equivalent',
    (field) => {
      const input = pair()
      input[1][field] = field === 'assetsSha' ? 'c'.repeat(64) : 'different'
      expect(analyzeNativeStartupRuns(input)).toEqual(invalid)
    },
  )
  test('duplicate, missing, excessive, unordered or overlapping runs are rejected', () => {
    const input = pair()
    for (const bad of [
      [],
      [input[0]],
      Array(17).fill(input[0]),
      input.toReversed(),
      [input[0], input[0], input[1]],
    ])
      expect(analyzeNativeStartupRuns(bad)).toEqual(invalid)
    input[1].receiptStart = input[0].receiptStart
    expect(analyzeNativeStartupRuns(input)).toEqual(invalid)
  })
  test('same variant must keep its original HEAD and source between repeated runs', () => {
    const input = [...pair(), run('candidate', 3), run('baseline', 4)]
    expect(analyzeNativeStartupRuns(input)).toMatchObject({ valid: true })
    input[2].head = '3'.repeat(40)
    expect(analyzeNativeStartupRuns(input)).toEqual(invalid)
  })
  test('unexpected payloads, throwing getters and nonobjects produce no raw diagnostics', () => {
    const input = pair()
    Object.assign(input[0], { rawBody: 'PRIVATE_COORDINATES' })
    expect(analyzeNativeStartupRuns(input)).toEqual(invalid)
    const foreign = {
      get variant() {
        throw new Error('PRIVATE_COORDINATES')
      },
    }
    for (const bad of [null, {}, [foreign, run('candidate')]])
      expect(analyzeNativeStartupRuns(bad)).toEqual(invalid)
  })
  test('missing completion is not synthesized and snapshots own their values', () => {
    const input = pair()
    Object.assign(input[0].timing.events[6], { endMs: null })
    const result = analyzeNativeStartupRuns(input)
    expect(result).toMatchObject({
      valid: true,
      cases: expect.arrayContaining([
        expect.objectContaining({ firstResultMs: null, thirdResultMs: null }),
      ]),
    })
    input[0].timing.events[6].endMs = 3333
    expect(result).toMatchObject({
      cases: expect.arrayContaining([expect.objectContaining({ firstResultMs: null })]),
    })
    expect(Object.isFrozen(result)).toBe(true)
    if (result.valid) {
      expect(Object.isFrozen(result.cases)).toBe(true)
      expect(Object.isFrozen(result.cases[0])).toBe(true)
    }
  })
})
