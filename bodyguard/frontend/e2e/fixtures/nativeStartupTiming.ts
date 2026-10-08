// FR-M-01/02·NFR-07/08: bounded TEST-only relative timing, never input/identity/URL logging.
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
type Stage = (typeof stages)[number]
export function nativeStartupTiming(clock: () => number) {
  const events: { stage: Stage; startMs: number; endMs: number | null }[] = []
  const tokens = new Map<object, number>()
  const counts = new Map<Stage, number>()
  let epoch: number | null = null,
    last = -Infinity,
    invalid = false,
    closed = false,
    reading = false
  function now() {
    if (reading || closed || invalid) return null
    reading = true
    try {
      const value = clock()
      if (closed || invalid) return null
      if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || value < last)
        throw new Error()
      epoch ??= value
      last = value
      return value - epoch
    } catch {
      invalid = true
      return null
    } finally {
      reading = false
    }
  }
  return Object.freeze({
    begin(stage: Stage): object | null {
      if (!stages.includes(stage) || (counts.get(stage) ?? 0) >= 3) return null
      const at = now()
      if (at === null || closed || invalid) return null
      const token = {}
      counts.set(stage, (counts.get(stage) ?? 0) + 1)
      tokens.set(token, events.length)
      events.push({ stage, startMs: at, endMs: null })
      return token
    },
    end(token: object | null) {
      if (!token || closed || !tokens.has(token)) return
      const index = tokens.get(token)
      tokens.delete(token)
      const at = now()
      if (at !== null && index !== undefined) events[index].endMs = at
    },
    close() {
      closed = true
      tokens.clear()
    },
    snapshot: () =>
      Object.freeze({
        invalid,
        closed,
        events: Object.freeze(events.map((event) => Object.freeze({ ...event }))),
      }),
  })
}
