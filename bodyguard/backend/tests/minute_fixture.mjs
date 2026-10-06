// FR-R-01: actual pure TS aggregator exercised with synthetic durations, no camera/raw data.
import { createMinuteAggregation } from '../../frontend/src/summary/minuteAggregation.ts'

const names = ['neck', 'shoulder', 'trunk']
const aggregation = createMinuteAggregation({
  clock: { monotonicMs: 0, utc: '2026-09-30T23:50:00.000Z' },
  clientVersion: 'Fixture+V1',
  baselineId: process.argv[2],
  maxIntervalMs: 60_000,
  maxBufferedMinutes: 60,
  definitions: Object.fromEntries(names.map((name) => [name, {
    method: `fixture-${name}`, unit: 'deg', minDeviation: -10, maxDeviation: 10,
  }])),
})
for (let index = 0; index < 1873; index++) {
  const background = index % 17 === 0
  const present = !background && index % 13 !== 0
  aggregation.push({
    startMs: index * 600_000 / 1873,
    endMs: (index + 1) * 600_000 / 1873,
    present, background,
    ...Object.fromEntries(names.map((name, n) => [name,
      present && index % (n + 2) !== 0 ? { deviation: (index % 11) / 3, bad: index % (n + 3) === 0 } : null,
    ])),
  })
}
const fieldMap = { coverageSec: 'coverage_sec', measuredSec: 'measured_sec', unmeasurableSec: 'unmeasurable_sec', presentSec: 'present_sec', backgroundSec: 'background_sec', anyBadSec: 'any_bad_sec' }
const items = aggregation.flush(600_000).map((item) => ({
  minute_start: item.minuteStart, baseline_id: item.baselineId, client_version: item.clientVersion,
  ...Object.fromEntries(Object.entries(fieldMap).map(([key, value]) => [value, item[key]])),
  ...Object.fromEntries(names.map((name) => [name, {
    method: item.metrics[name].method, unit: item.metrics[name].unit,
    dev_mean: item.metrics[name].devMean, measured_sec: item.metrics[name].measuredSec,
    bad_sec: item.metrics[name].badSec,
  }])),
}))
process.stdout.write(JSON.stringify(items))
