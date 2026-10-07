// FR-R-01/06/NFR-07: synthetic intervals only; no camera/clinical thresholds/user coordinates.
import { expect, it } from 'vitest'
import { createMinuteAggregation } from './minuteAggregation'

function config() {
  const definition = { method: 'synthetic', unit: 'synthetic', minDeviation: -10, maxDeviation: 10 }
  return {
    clock: { monotonicMs: 0, utc: '2026-10-06T00:00:00.000Z' },
    clientVersion: 'fixture-not-release',
    baselineId: null as string | null,
    maxIntervalMs: 1000,
    maxBufferedMinutes: 2,
    definitions: { neck: { ...definition }, shoulder: { ...definition }, trunk: { ...definition } },
  }
}
const metric = (deviation = 2, bad = false) => ({ deviation, bad })
const interval = (startMs = 0, endMs = 100) => ({
  startMs,
  endMs,
  present: true,
  background: false,
  neck: metric(),
  shoulder: null,
  trunk: null,
})

it('M01 no observed interval means no summary and no invented value', () => {
  const definition = { method: 'synthetic', unit: 'synthetic', minDeviation: -10, maxDeviation: 10 }
  const engine = createMinuteAggregation({
    clock: { monotonicMs: 0, utc: '2026-10-06T00:00:00.000Z' },
    clientVersion: 'fixture-not-release',
    baselineId: null,
    maxIntervalMs: 100,
    maxBufferedMinutes: 2,
    definitions: { neck: definition, shoulder: definition, trunk: definition },
  })
  expect(engine.flush(60_000)).toEqual([])
  expect(engine.getSnapshot()).toEqual({ closed: false, bufferedMinutes: 0 })
})
it('M02 irregular intervals weight each measured metric, not sample counts', () => {
  const engine = createMinuteAggregation(config())
  engine.push(interval())
  engine.push({ ...interval(100, 400), neck: metric(6, true), shoulder: metric(-3, true) })
  const [row] = engine.flush(60_000)
  expect(row).toMatchObject({
    coverageSec: 0.4,
    measuredSec: 0.4,
    unmeasurableSec: 0,
    presentSec: 0.4,
    backgroundSec: 0,
    anyBadSec: 0.3,
    metrics: {
      neck: { devMean: 5, measuredSec: 0.4, badSec: 0.3 },
      shoulder: { devMean: -3, measuredSec: 0.3, badSec: 0.3 },
      trunk: { devMean: null, measuredSec: 0, badSec: 0 },
    },
  })
})
it('M02 simultaneous bad metrics count union time only once', () => {
  const engine = createMinuteAggregation(config())
  engine.push({
    ...interval(),
    neck: metric(1, true),
    shoulder: metric(2, true),
    trunk: metric(3, true),
  })
  expect(engine.flush(60_000)[0].anyBadSec).toBe(0.1)
})
it('M03 UTC wall minute boundary splits observed time exactly', () => {
  const options = config()
  options.clock.utc = '2026-10-06T00:00:59.950Z'
  const engine = createMinuteAggregation(options)
  engine.push(interval())
  const [first] = engine.flush(100)
  expect(first).toMatchObject({
    minuteStart: '2026-10-06T00:00:00.000Z',
    measuredSec: 0.05,
    anyBadSec: 0,
  })
  expect(engine.getSnapshot().bufferedMinutes).toBe(1)
  const [second] = engine.flush(60_100)
  expect(second).toMatchObject({ minuteStart: '2026-10-06T00:01:00.000Z', measuredSec: 0.05 })
})
it('M03 gaps and missing metrics never inflate the observed denominator', () => {
  const engine = createMinuteAggregation(config())
  engine.push(interval())
  engine.push({ ...interval(1000, 1100), neck: null })
  expect(engine.flush(59_999)).toEqual([])
  expect(engine.flush(60_000)[0]).toMatchObject({
    coverageSec: 0.2,
    measuredSec: 0.1,
    unmeasurableSec: 0.1,
    presentSec: 0.2,
    metrics: { neck: { devMean: 2, measuredSec: 0.1 }, trunk: { devMean: null } },
  })
})
it('M03 absence/background remain distinct and do not invent prior presence', () => {
  const engine = createMinuteAggregation(config())
  engine.push({ ...interval(), neck: null, present: false })
  engine.push({ ...interval(100, 200), neck: null })
  engine.push({ ...interval(200, 300), neck: null, present: false, background: true })
  expect(engine.flush(60_000)[0]).toMatchObject({
    coverageSec: 0.3,
    measuredSec: 0,
    unmeasurableSec: 0.2,
    presentSec: 0.1,
    backgroundSec: 0.1,
    metrics: { neck: { devMean: null }, shoulder: { devMean: null }, trunk: { devMean: null } },
  })
})
it('M04 copies clock/calibration/method/interval values and deeply freezes returned summaries', () => {
  const options = config()
  options.baselineId = '00000000-0000-4000-8000-000000000001'
  const engine = createMinuteAggregation(options)
  const sample = interval()
  engine.push(sample)
  sample.neck.deviation = 9
  options.clock.utc = '2030-01-01T00:00:00.000Z'
  options.baselineId = null
  options.definitions.neck.method = 'other'
  const rows = engine.flush(60_000)
  expect(rows[0]).toMatchObject({
    baselineId: '00000000-0000-4000-8000-000000000001',
    minuteStart: '2026-10-06T00:00:00.000Z',
    metrics: { neck: { method: 'synthetic', devMean: 2 } },
  })
  expect(Object.isFrozen(rows)).toBe(true)
  expect(Object.isFrozen(rows[0])).toBe(true)
  expect(Object.isFrozen(rows[0].metrics)).toBe(true)
  expect(Object.isFrozen(rows[0].metrics.neck)).toBe(true)
  expect(engine.getSnapshot().bufferedMinutes).toBe(0)
  engine.push(interval(60_000, 60_100))
  expect(engine.flush(120_000)[0].minuteStart).toBe('2026-10-06T00:01:00.000Z')
})
it('M04 close destroys incomplete aggregates; later calls cannot resurrect values', () => {
  const engine = createMinuteAggregation(config())
  engine.push(interval())
  engine.close()
  expect(engine.getSnapshot()).toEqual({ closed: true, bufferedMinutes: 0 })
  expect(engine.flush(60_000)).toEqual([])
  expect(() => engine.push(interval(100, 200))).toThrow('Invalid minute aggregation')
})
it.each([
  { startMs: -1 },
  { startMs: 100, endMs: 100 },
  { endMs: 1001 },
  { endMs: Number.NaN },
  { endMs: Number.POSITIVE_INFINITY },
  { neck: metric(11) },
  { neck: metric(Number.NaN) },
  { neck: { deviation: 2, bad: 'true' } },
  { present: false },
  { background: true },
  { present: 1 },
  { coordinates: [1, 2, 3] },
  { accountId: 'PRIVATE_SUMMARY_ACCOUNT' },
])('M05 invalid interval closes/discards without raw error: %j', (change) => {
  const engine = createMinuteAggregation(config())
  expect(() =>
    engine.push({ ...interval(), ...change } as Parameters<typeof engine.push>[0]),
  ).toThrow('Invalid minute aggregation')
  expect(engine.getSnapshot()).toEqual({ closed: true, bufferedMinutes: 0 })
  expect(engine.flush(60_000)).toEqual([])
})
it('M05 overlapping or stale-after-flush intervals terminally discard accumulators', () => {
  for (const flush of [false, true]) {
    const engine = createMinuteAggregation(config())
    engine.push(interval())
    if (flush) engine.flush(200)
    expect(() => engine.push(interval(50, 150))).toThrow('Invalid minute aggregation')
    expect(engine.getSnapshot()).toEqual({ closed: true, bufferedMinutes: 0 })
  }
})
it('M05 a buffer overflow does not leak a partly accumulated result', () => {
  const options = config()
  options.maxBufferedMinutes = 1
  const engine = createMinuteAggregation(options)
  engine.push(interval())
  expect(() => engine.push(interval(60_000, 60_100))).toThrow('Invalid minute aggregation')
  expect(engine.flush(120_000)).toEqual([])
})
it('M05 bad raw getters are fixed failures, never included in output or log', () => {
  const engine = createMinuteAggregation(config())
  expect(() =>
    engine.push({
      ...interval(),
      get neck(): ReturnType<typeof metric> {
        throw new Error('PRIVATE_SUMMARY_COORDINATES_ACCOUNT')
      },
    }),
  ).toThrow(/^Invalid minute aggregation$/)
  expect(engine.getSnapshot()).toEqual({ closed: true, bufferedMinutes: 0 })
})
it.each([
  { clock: { monotonicMs: 0, utc: '2026-02-30T00:00:00.000Z' } },
  { clock: { monotonicMs: 0, utc: '0000-01-01T00:00:00.000Z' } },
  { clock: { monotonicMs: -1, utc: '2026-10-06T00:00:00.000Z' } },
  { baselineId: 'invented' },
  { clientVersion: '' },
  { maxIntervalMs: 0 },
  { maxBufferedMinutes: 0 },
  { landmarks: [] },
])('M05 no guessed config defaults or raw fields: %j', (change) => {
  expect(() =>
    createMinuteAggregation({ ...config(), ...change } as Parameters<
      typeof createMinuteAggregation
    >[0]),
  ).toThrow('Invalid minute aggregation')
})
it('M05 a reverse flush terminally discards data rather than changing the wall anchor', () => {
  const engine = createMinuteAggregation(config())
  engine.push(interval())
  expect(() => engine.flush(99)).toThrow('Invalid minute aggregation')
  expect(engine.flush(60_000)).toEqual([])
})
it('M04 captures the explicit clock and definitions source only once, never mixes clock pairs', () => {
  let clocks = 0
  let definitions = 0
  const original = config()
  const engine = createMinuteAggregation({
    ...original,
    get clock() {
      clocks++
      return clocks === 1
        ? original.clock
        : { monotonicMs: 300_000, utc: '2030-01-01T00:00:00.000Z' }
    },
    get definitions() {
      definitions++
      return original.definitions
    },
  })
  expect(clocks).toBe(1)
  expect(definitions).toBe(1)
  engine.push(interval())
  expect(engine.flush(60_000)[0].minuteStart).toBe('2026-10-06T00:00:00.000Z')
})
it('M03 high-resolution monotonic intervals do not vanish in a large UTC timestamp addition', () => {
  const engine = createMinuteAggregation(config())
  engine.push(interval(0, 0.0001))
  const rows = engine.flush(60_000)
  expect(rows).toHaveLength(1)
  expect(rows[0].coverageSec).toBeCloseTo(0.0000001, 12)
  expect(rows[0].metrics.neck.devMean).toBe(2)
})
