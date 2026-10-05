// FR-R-01/06/NFR-07: private time-weighted aggregates only, no browser/upload/raw sample history.
const names = ['neck', 'shoulder', 'trunk'] as const
type Name = (typeof names)[number]
type Definition = Readonly<{
  method: string
  unit: string
  minDeviation: number
  maxDeviation: number
}>
type Options = Readonly<{
  clock: Readonly<{ monotonicMs: number; utc: string }>
  clientVersion: string
  baselineId: string | null
  maxIntervalMs: number
  maxBufferedMinutes: number
  definitions: Readonly<Record<Name, Definition>>
}>
type Metric = Readonly<{ deviation: number; bad: boolean }> | null
type Interval = Readonly<{
  startMs: number
  endMs: number
  present: boolean
  background: boolean
  neck: Metric
  shoulder: Metric
  trunk: Metric
}>
type Accumulator = { weight: number; weightedSum: number; bad: number }
type Bucket = {
  start: number
  coverage: number
  measured: number
  unmeasurable: number
  present: number
  background: number
  anyBad: number
  metrics: Record<Name, Accumulator>
}
class InvalidAggregation extends Error {
  constructor() {
    super('Invalid minute aggregation')
  }
}
const finite = (v: number) =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER
function shape(value: unknown, keys: readonly string[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidAggregation()
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw new InvalidAggregation()
  const actual = Reflect.ownKeys(value)
  if (
    actual.length !== keys.length ||
    actual.some((key) => typeof key !== 'string' || !keys.includes(key))
  )
    throw new InvalidAggregation()
}
function identifier(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/.test(value)
}
function validUtc(value: string): boolean {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !value.startsWith('0000') &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  )
}
function empty(start: number): Bucket {
  const metric = (): Accumulator => ({ weight: 0, weightedSum: 0, bad: 0 })
  return {
    start,
    coverage: 0,
    measured: 0,
    unmeasurable: 0,
    present: 0,
    background: 0,
    anyBad: 0,
    metrics: { neck: metric(), shoulder: metric(), trunk: metric() },
  }
}

/** Caller must supply validated observed intervals, calibration/method identity and ownership.
 * Definitions are shape-checked, not clinically adopted. Missing gaps are never forward-filled.
 * No network, persistence, wall-clock default or retained interval/coordinate list exists here.
 */
export function createMinuteAggregation(supplied: Options) {
  let options: Options
  let anchor: number
  try {
    shape(supplied, [
      'clock',
      'clientVersion',
      'baselineId',
      'maxIntervalMs',
      'maxBufferedMinutes',
      'definitions',
    ])
    const suppliedClock = supplied.clock
    shape(suppliedClock, ['monotonicMs', 'utc'])
    const clock = Object.freeze({
      monotonicMs: suppliedClock.monotonicMs,
      utc: suppliedClock.utc,
    })
    const clientVersion = supplied.clientVersion
    const baselineId = supplied.baselineId
    const maxIntervalMs = supplied.maxIntervalMs
    const maxBufferedMinutes = supplied.maxBufferedMinutes
    if (
      !finite(clock.monotonicMs) ||
      clock.monotonicMs < 0 ||
      !validUtc(clock.utc) ||
      !identifier(clientVersion) ||
      (baselineId !== null &&
        (typeof baselineId !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            baselineId,
          ))) ||
      !Number.isSafeInteger(maxIntervalMs) ||
      maxIntervalMs < 1 ||
      maxIntervalMs > 60_000 ||
      !Number.isSafeInteger(maxBufferedMinutes) ||
      maxBufferedMinutes < 1 ||
      maxBufferedMinutes > 60
    )
      throw new InvalidAggregation()
    const suppliedDefinitions = supplied.definitions
    shape(suppliedDefinitions, names)
    const definitions = Object.fromEntries(
      names.map((name) => {
        const source = suppliedDefinitions[name]
        shape(source, ['method', 'unit', 'minDeviation', 'maxDeviation'])
        const definition = {
          method: source.method,
          unit: source.unit,
          minDeviation: source.minDeviation,
          maxDeviation: source.maxDeviation,
        }
        if (
          !identifier(definition.method) ||
          !identifier(definition.unit) ||
          !finite(definition.minDeviation) ||
          !finite(definition.maxDeviation) ||
          definition.minDeviation >= definition.maxDeviation
        )
          throw new InvalidAggregation()
        return [name, Object.freeze(definition)]
      }),
    ) as Record<Name, Definition>
    options = Object.freeze({
      clock,
      clientVersion,
      baselineId,
      maxIntervalMs,
      maxBufferedMinutes,
      definitions: Object.freeze(definitions),
    })
    anchor = Date.parse(clock.utc)
  } catch {
    throw new InvalidAggregation()
  }
  const buckets = new Map<number, Bucket>()
  const baseMinute = Math.floor(anchor / 60_000) * 60_000
  let closed = false
  let lastEnd = options.clock.monotonicMs
  let lastFlush = options.clock.monotonicMs
  function close(): void {
    closed = true
    buckets.clear()
  }
  function minuteOffset(ms: number): number {
    if (!finite(ms) || ms < options.clock.monotonicMs) throw new InvalidAggregation()
    const elapsed = ms - options.clock.monotonicMs
    if (!Number.isFinite(elapsed) || elapsed > 253402300799999 - anchor)
      throw new InvalidAggregation()
    // Split relative times before adding the large UTC epoch; retain high-resolution intervals.
    return anchor - baseMinute + elapsed
  }
  function push(source: Interval): void {
    if (closed) throw new InvalidAggregation()
    try {
      shape(source, ['startMs', 'endMs', 'present', 'background', ...names])
      const start = source.startMs
      const end = source.endMs
      const present = source.present
      const background = source.background
      if (
        !finite(start) ||
        !finite(end) ||
        start < Math.max(lastEnd, lastFlush) ||
        end <= start ||
        end - start > options.maxIntervalMs ||
        typeof present !== 'boolean' ||
        typeof background !== 'boolean' ||
        (background && present)
      )
        throw new InvalidAggregation()
      const metrics = Object.fromEntries(
        names.map((name) => {
          const input = source[name]
          if (input === null) return [name, null]
          shape(input, ['deviation', 'bad'])
          const metric = { deviation: input.deviation, bad: input.bad }
          const definition = options.definitions[name]
          if (
            !finite(metric.deviation) ||
            metric.deviation < definition.minDeviation ||
            metric.deviation > definition.maxDeviation ||
            typeof metric.bad !== 'boolean' ||
            background ||
            !present
          )
            throw new InvalidAggregation()
          return [name, metric]
        }),
      ) as Record<Name, Metric>
      const from = minuteOffset(start)
      const until = minuteOffset(end)
      const first = Math.floor(from / 60_000) * 60_000
      const last = Math.ceil(until / 60_000) * 60_000 - 60_000
      let additional = 0
      for (let at = first; at <= last; at += 60_000) if (!buckets.has(baseMinute + at)) additional++
      if (buckets.size + additional > options.maxBufferedMinutes) throw new InvalidAggregation()
      for (let at = first; at <= last; at += 60_000) {
        const weight = Math.min(until, at + 60_000) - Math.max(from, at)
        const key = baseMinute + at
        const bucket = buckets.get(key) ?? empty(key)
        const measured = names.some((name) => metrics[name] !== null)
        bucket.coverage += weight
        if (background) bucket.background += weight
        else if (measured) bucket.measured += weight
        else bucket.unmeasurable += weight
        if (present) bucket.present += weight
        if (names.some((name) => metrics[name]?.bad === true)) bucket.anyBad += weight
        for (const name of names) {
          const metric = metrics[name]
          if (metric === null) continue
          const accumulator = bucket.metrics[name]
          accumulator.weight += weight
          accumulator.weightedSum += metric.deviation * weight
          if (!finite(accumulator.weightedSum)) throw new InvalidAggregation()
          if (metric.bad) accumulator.bad += weight
        }
        buckets.set(key, bucket)
      }
      lastEnd = end
    } catch {
      close()
      throw new InvalidAggregation()
    }
  }
  function flush(now: number) {
    if (closed) return Object.freeze([])
    try {
      if (!finite(now) || now < Math.max(lastEnd, lastFlush)) throw new InvalidAggregation()
      const until = minuteOffset(now)
      const result = []
      for (const [start, bucket] of buckets) {
        if (start - baseMinute + 60_000 > until) continue
        const metrics = Object.fromEntries(
          names.map((name) => {
            const value = bucket.metrics[name]
            return [
              name,
              Object.freeze({
                method: options.definitions[name].method,
                unit: options.definitions[name].unit,
                devMean: value.weight === 0 ? null : value.weightedSum / value.weight,
                measuredSec: value.weight / 1000,
                badSec: value.bad / 1000,
              }),
            ]
          }),
        ) as Record<
          Name,
          Readonly<{
            method: string
            unit: string
            devMean: number | null
            measuredSec: number
            badSec: number
          }>
        >
        result.push(
          Object.freeze({
            minuteStart: new Date(start).toISOString(),
            baselineId: options.baselineId,
            clientVersion: options.clientVersion,
            coverageSec: bucket.coverage / 1000,
            measuredSec: bucket.measured / 1000,
            unmeasurableSec: bucket.unmeasurable / 1000,
            presentSec: bucket.present / 1000,
            backgroundSec: bucket.background / 1000,
            anyBadSec: bucket.anyBad / 1000,
            metrics: Object.freeze(metrics),
          }),
        )
        buckets.delete(start)
      }
      lastFlush = now
      return Object.freeze(result)
    } catch {
      close()
      throw new InvalidAggregation()
    }
  }
  return Object.freeze({
    push,
    flush,
    close,
    getSnapshot: () => Object.freeze({ closed, bufferedMinutes: buckets.size }),
  })
}
