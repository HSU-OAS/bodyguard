// FR-M-01/02·NFR-07/08: TEST diagnostics do not change acquisition, data or completion.
import { describe, expect, test } from 'vitest'
import { nativeStartupTiming } from '../e2e/fixtures/nativeStartupTiming'

describe('bounded native startup timing', () => {
  test('relative concurrent start/end, no synthetic completion, immutable snapshots', () => {
    let at = 500
    const p = nativeStartupTiming(() => at)
    const a = p.begin('camera')
    at += 20
    const b = p.begin('body-sdk')
    const old = p.snapshot()
    at += 30
    p.end(a)
    expect(p.snapshot().events).toEqual([
      { stage: 'camera', startMs: 0, endMs: 50 },
      { stage: 'body-sdk', startMs: 20, endMs: null },
    ])
    expect(old.events[0].endMs).toBeNull()
    expect(Object.isFrozen(old.events[0])).toBe(true)
    p.close()
    p.end(b)
    expect(p.begin('face')).toBeNull()
    expect(p.snapshot().events[1].endMs).toBeNull()
  })
  test('at most3 per literal stage, no foreign stage/payload retained', () => {
    const p = nativeStartupTiming(() => 500)
    const names = [
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
    for (const name of names) for (let i = 0; i < 20; i++) p.end(p.begin(name))
    expect(p.snapshot().events).toHaveLength(30)
    expect(p.begin('PRIVATE_COORDINATES_ACCOUNT_URL' as 'camera')).toBeNull()
    expect(JSON.stringify(p.snapshot())).not.toContain('PRIVATE')
    p.end({})
    expect(p.snapshot().events).toHaveLength(30)
  })
  test.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1])(
    'invalid clock %s records no false timing',
    (at) => {
      const p = nativeStartupTiming(() => at)
      expect(p.begin('camera')).toBeNull()
      expect(p.snapshot()).toMatchObject({ invalid: true, events: [] })
    },
  )
  test('clock failure/backwards stops measurements, not the caller operation', () => {
    let at = 500
    const p = nativeStartupTiming(() => at)
    const a = p.begin('camera')
    at = 400
    expect(() => p.end(a)).not.toThrow()
    expect(p.snapshot()).toMatchObject({ invalid: true, events: [{ endMs: null }] })
    const bad = nativeStartupTiming(() => {
      throw new Error('PRIVATE_COORDINATES')
    })
    expect(bad.begin('camera')).toBeNull()
    expect(JSON.stringify(bad.snapshot())).not.toContain('PRIVATE')
  })
  test('a clock closing/reentering the probe cannot finish a stale token', () => {
    let close = false
    const p = nativeStartupTiming(() => {
      if (close) p.close()
      return close ? 520 : 500
    })
    const token = p.begin('camera')
    close = true
    p.end(token)
    expect(p.snapshot()).toMatchObject({ closed: true, events: [{ endMs: null }] })
  })
})
