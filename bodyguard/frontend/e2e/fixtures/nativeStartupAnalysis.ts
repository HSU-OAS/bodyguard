// NFR-08·FR-M-02/07: OFFLINE TEST evidence only; no product imports, inputs or release gate.
type Row = Readonly<{
  id: string
  variant: 'baseline' | 'candidate'
  head: string
  outcome: 'passed' | 'failed' | 'skipped'
  sdkPreparedMs: number | null
  firstResultMs: number | null
  thirdResultMs: number | null
}>
const stages = [
  'camera',
  'body-sdk',
  'face-sdk',
  'hands-sdk',
  'avatar',
  'render',
  'body',
  'face',
  'hands',
  'result',
] as const
const keys = [
  'id',
  'variant',
  'gender',
  'head',
  'beforeSha',
  'afterSha',
  'browser',
  'sdk',
  'assetsSha',
  'receiptStart',
  'reportStart',
  'receiptEnd',
  'exitCode',
  'pollMs',
  'caseTimeoutMs',
  'retries',
  'fakeCamera',
  'actualPeople',
  'physicalCamera',
  'stats',
  'timing',
]
const rejected = Object.freeze({ valid: false as const, reason: 'Invalid startup evidence' })
function check(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid startup evidence')
}
function record(value: unknown, required: readonly string[]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value))
  check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  check(Object.getOwnPropertySymbols(value).length === 0)
  const own = Object.keys(value)
  check(own.length === required.length && required.every((key) => Object.hasOwn(value, key)))
  return value as Record<string, unknown>
}
function text(value: unknown, pattern: RegExp): string {
  check(typeof value === 'string' && pattern.test(value))
  return value
}
function numeric(value: unknown): number {
  check(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= Number.MAX_SAFE_INTEGER,
  )
  return value
}
function utc(value: unknown): number {
  const raw = text(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  const at = Date.parse(raw)
  check(Number.isFinite(at) && new Date(at).toISOString() === raw)
  return at
}
function metrics(value: unknown) {
  const timing = record(value, ['invalid', 'closed', 'events'])
  check(timing.invalid === false && timing.closed === true)
  const events = timing.events
  check(Array.isArray(events) && events.length <= 30)
  const counts = new Map<string, number>()
  let previousStart = -1
  const copied = events.map((event) => {
    const row = record(event, ['stage', 'startMs', 'endMs'])
    check(typeof row.stage === 'string' && stages.includes(row.stage as (typeof stages)[number]))
    const stage = row.stage
    const count = (counts.get(stage) ?? 0) + 1
    check(count <= 3)
    counts.set(stage, count)
    const startMs = numeric(row.startMs)
    check(startMs >= previousStart)
    previousStart = startMs
    const endMs = row.endMs === null ? null : numeric(row.endMs)
    check(endMs === null || endMs >= startMs)
    return { stage, startMs, endMs }
  })
  const avatar = copied.find((row) => row.stage === 'avatar')
  // A GPU attempt may finish before a later CPU attempt. Do not call its first end "SDK ready".
  const sdk = avatar
    ? copied.filter((row) => row.stage.endsWith('-sdk') && row.startMs <= avatar.startMs)
    : []
  const allSdk =
    ['body-sdk', 'face-sdk', 'hands-sdk'].every((stage) =>
      sdk.some((row) => row.stage === stage),
    ) && sdk.every((row) => row.endMs !== null && row.endMs <= (avatar?.startMs ?? -1))
  const results = copied.filter((row) => row.stage === 'result')
  return {
    sdkPreparedMs: allSdk ? Math.max(...sdk.map((row) => row.endMs as number)) : null,
    firstResultMs: results[0]?.endMs ?? null,
    thirdResultMs:
      results.length === 3 && results.every((row) => row.endMs !== null)
        ? Math.max(...results.map((row) => row.endMs as number))
        : null,
  }
}
/**
 * Analyze previously verified, JSON-shaped technical receipts. Hash strings are provenance
 * identifiers, not signature/authentication: the runner must check originals and git blobs.
 * A successful recheck NEVER replaces mandatory regression or establishes a cause.
 */
export function analyzeNativeStartupRuns(input: unknown) {
  try {
    check(Array.isArray(input) && input.length >= 2 && input.length <= 16)
    const identities = new Set<string>()
    const variants = new Map<string, Readonly<{ head: string; sha: string }>>()
    const counts = { passed: 0, failed: 0, skipped: 0 }
    let comparable: string | undefined,
      previousEnd = -Infinity
    const cases = input.map((value): Row => {
      const run = record(value, keys)
      const id = text(run.id, /^[a-z][a-z0-9-]{0,79}$/)
      check(!identities.has(id))
      identities.add(id)
      check(run.variant === 'baseline' || run.variant === 'candidate')
      const variant = run.variant
      const head = text(run.head, /^[a-f0-9]{40}$/)
      const before = text(run.beforeSha, /^[a-f0-9]{64}$/)
      check(run.afterSha === before)
      const known = variants.get(variant)
      check(!known || (known.head === head && known.sha === before))
      variants.set(variant, Object.freeze({ head, sha: before }))
      check(run.gender === 'male' || run.gender === 'female')
      const browser = text(run.browser, /^\d{1,4}(?:\.\d{1,5}){3}$/)
      const sdk = text(run.sdk, /^\d{1,4}\.\d{1,4}\.\d{1,4}$/)
      const assets = text(run.assetsSha, /^[a-f0-9]{64}$/)
      const comparison = [run.gender, browser, sdk, assets].join(':')
      check(comparable === undefined || comparable === comparison)
      comparable = comparison
      check(run.pollMs === 5000 && run.caseTimeoutMs === 60000 && run.retries === 0)
      check(run.fakeCamera === true && run.actualPeople === 0 && run.physicalCamera === false)
      const start = utc(run.receiptStart),
        at = utc(run.reportStart),
        end = utc(run.receiptEnd)
      check(start <= at && at <= end && start >= previousEnd)
      previousEnd = end
      const stats = record(run.stats, ['expected', 'unexpected', 'skipped', 'flaky'])
      const passed = numeric(stats.expected),
        failed = numeric(stats.unexpected),
        skipped = numeric(stats.skipped)
      check(stats.flaky === 0 && [passed, failed, skipped].every(Number.isSafeInteger))
      check(passed + failed + skipped === 1)
      const exit = numeric(run.exitCode)
      check(
        Number.isSafeInteger(exit) &&
          exit <= 255 &&
          ((failed === 1 && exit > 0) || (failed === 0 && exit === 0)),
      )
      const outcome = failed === 1 ? 'failed' : skipped === 1 ? 'skipped' : 'passed'
      counts[outcome]++
      return Object.freeze({ id, variant, head, outcome, ...metrics(run.timing) })
    })
    check(variants.size === 2 && variants.get('baseline')?.head !== variants.get('candidate')?.head)
    const baselineFailed = cases.some(
      (row) => row.variant === 'baseline' && row.outcome === 'failed',
    )
    const candidateFailed = cases.some(
      (row) => row.variant === 'candidate' && row.outcome === 'failed',
    )
    const reproduction =
      counts.skipped > 0
        ? 'incomplete'
        : baselineFailed && candidateFailed
          ? 'both-failed'
          : baselineFailed
            ? 'baseline-failed'
            : candidateFailed
              ? 'candidate-only-failed'
              : 'not-reproduced'
    return Object.freeze({
      valid: true as const,
      counts: Object.freeze(counts),
      cases: Object.freeze(cases),
      reproduction,
      causalityEstablished: false,
      mandatoryRegressionRetested: false,
      productGatePassed: false,
    })
  } catch {
    return rejected
  }
}
