// FR-M-02·NFR-07/08: synthetic technical diagnostics, not native/human timing proof.
import { describe, expect, test } from 'vitest'
import {
  nativeStartupDiagnostic,
  observeNativeStartupLongTasks,
} from '../e2e/fixtures/nativeStartupDiagnostic'

describe('private native preparation diagnostic', () => {
  test('GPU rejection and CPU resolution retain relative technical states only', () => {
    let at = 500
    const p = nativeStartupDiagnostic(() => at)
    const camera = p.begin('camera')
    at = 510
    p.end(camera, 'resolved')
    const gpu = p.begin('body-sdk', 'GPU')
    at = 540
    p.end(gpu, 'rejected')
    const cpu = p.begin('body-sdk', 'CPU')
    const pending = p.snapshot()
    at = 560
    p.end(cpu, 'resolved')
    expect(p.snapshot().events).toEqual([
      { stage: 'camera', delegate: null, startMs: 0, endMs: 10, outcome: 'resolved' },
      { stage: 'body-sdk', delegate: 'GPU', startMs: 10, endMs: 40, outcome: 'rejected' },
      { stage: 'body-sdk', delegate: 'CPU', startMs: 40, endMs: 60, outcome: 'resolved' },
    ])
    expect(pending.events[2]).toMatchObject({ endMs: null, outcome: 'pending' })
    expect(Object.isFrozen(pending.events[2])).toBe(true)
    p.close()
    expect(p.begin('face-sdk', 'GPU')).toBeNull()
    expect(p.snapshot().closed).toBe(true)
  })
  test('missing end is not successful, foreign tokens/states/payloads are ignored', () => {
    const p = nativeStartupDiagnostic(() => 500)
    const t = p.begin('fileset')
    p.end({}, 'resolved')
    p.end(t, 'PRIVATE_ACCOUNT_BODY_URL' as 'resolved')
    expect(p.begin('PRIVATE_ACCOUNT_BODY_URL' as 'camera')).toBeNull()
    expect(p.begin('body-sdk', 'PRIVATE_ACCOUNT_BODY_URL' as 'GPU')).toBeNull()
    p.close()
    p.end(t, 'resolved')
    expect(p.snapshot().events).toEqual([
      { stage: 'fileset', delegate: null, startMs: 0, endMs: null, outcome: 'pending' },
    ])
    expect(JSON.stringify(p.snapshot())).not.toContain('PRIVATE')
  })
  test('a foreign object cannot impersonate a literal stage or retain private payload', () => {
    let coerced = false
    const p = nativeStartupDiagnostic(() => 500)
    const foreign = {
      body: 'PRIVATE_BODY_COORDINATES',
      toString() {
        coerced = true
        return 'camera'
      },
    }
    expect(p.begin(foreign as unknown as 'camera')).toBeNull()
    expect(coerced).toBe(false)
    expect(JSON.stringify(p.snapshot())).not.toContain('PRIVATE')
  })
  test('per-stage and long-task bounds are explicit, values are copied without metadata', () => {
    const p = nativeStartupDiagnostic(() => 500)
    const limits = { camera: 3, fileset: 9, 'body-sdk': 6, 'face-sdk': 6, 'hands-sdk': 6 } as const
    for (const stage of Object.keys(limits) as (keyof typeof limits)[])
      for (let i = 0; i < 20; i++) p.end(p.begin(stage), 'resolved')
    expect(p.snapshot().events).toHaveLength(30)
    expect(p.snapshot().eventsTruncated).toBe(true)
    p.setObserverState('observing')
    for (let i = 0; i < 70; i++) p.longTask(500 + i * 60, 55)
    const snapshot = p.snapshot()
    expect(snapshot.longTasks).toHaveLength(64)
    expect(snapshot.longTasksTruncated).toBe(true)
    expect(Object.isFrozen(snapshot.longTasks[0])).toBe(true)
    p.setObserverState('closed')
    p.close()
    p.longTask(500, 500)
    expect(p.snapshot().observerState).toBe('closed')
    expect(p.snapshot().longTasks).toHaveLength(64)
  })
  test('unsupported observer is distinct from zero observed long tasks', () => {
    const p = nativeStartupDiagnostic(() => 500)
    expect(p.snapshot().observerState).toBe('unsupported')
    p.setObserverState('observing')
    expect(p.snapshot()).toMatchObject({ observerState: 'observing', longTasks: [] })
    p.setObserverState('failed')
    p.setObserverState('PRIVATE_ACCOUNT_BODY_URL' as 'closed')
    expect(p.snapshot().observerState).toBe('failed')
  })
  test('entries before epoch, invalid values or not observed are excluded', () => {
    const p = nativeStartupDiagnostic(() => 500)
    p.setObserverState('observing')
    p.longTask(500, 50)
    p.begin('camera')
    p.longTask(400, 50)
    for (const [start, duration] of [
      [NaN, 50],
      [500, Infinity],
      [500, -1],
      [500, 60001],
    ])
      p.longTask(start, duration)
    p.longTask(520, 50)
    expect(p.snapshot().longTasks).toEqual([{ startMs: 20, durationMs: 50 }])
  })
  test.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1])('invalid clock %s', (at) => {
    const p = nativeStartupDiagnostic(() => at)
    expect(p.begin('camera')).toBeNull()
    expect(p.snapshot()).toMatchObject({ invalid: true, events: [] })
  })
  test('throwing/backward/closing clock cannot fabricate a completed attempt', () => {
    let at = 500
    const p = nativeStartupDiagnostic(() => at)
    const t = p.begin('camera')
    at = 400
    p.end(t, 'resolved')
    expect(p.snapshot()).toMatchObject({
      invalid: true,
      events: [{ endMs: null, outcome: 'pending' }],
    })
    const bad = nativeStartupDiagnostic(() => {
      throw new Error('PRIVATE_BODY')
    })
    expect(bad.begin('camera')).toBeNull()
    expect(JSON.stringify(bad.snapshot())).not.toContain('PRIVATE')
    let close = false
    const reentrant = nativeStartupDiagnostic(() => {
      if (close) reentrant.close()
      return 500
    })
    const token = reentrant.begin('camera')
    close = true
    reentrant.end(token, 'resolved')
    expect(reentrant.snapshot()).toMatchObject({
      closed: true,
      events: [{ endMs: null, outcome: 'pending' }],
    })
  })
})

describe('optional long-task observer ownership', () => {
  function fixture(fault: 'none' | 'observe' | 'takeRecords' | 'disconnect' = 'none') {
    let disconnected = 0,
      drained = 0,
      notified: PerformanceObserverCallback | null = null
    const row = {
      startTime: 520,
      duration: 55,
      get name() {
        throw new Error('PRIVATE_URL')
      },
      get attribution() {
        throw new Error('PRIVATE_URL')
      },
    } as unknown as PerformanceEntry
    class Observer {
      static supportedEntryTypes = ['longtask']
      constructor(callback: PerformanceObserverCallback) {
        notified = callback
      }
      observe() {
        if (fault === 'observe') throw new Error('PRIVATE_URL')
      }
      takeRecords() {
        drained++
        if (fault === 'takeRecords') throw new Error('PRIVATE_URL')
        return [row]
      }
      disconnect() {
        disconnected++
        if (fault === 'disconnect') throw new Error('PRIVATE_URL')
      }
    }
    return {
      Observer: Observer as unknown as typeof PerformanceObserver,
      notify: () =>
        notified?.(
          { getEntries: () => [row] } as PerformanceObserverEntryList,
          {} as PerformanceObserver,
        ),
      counts: () => ({ disconnected, drained }),
    }
  }
  test('drains pending entries and disconnects once, without reading attribution/name', () => {
    const f = fixture(),
      p = nativeStartupDiagnostic(() => 500)
    p.begin('camera')
    const observer = observeNativeStartupLongTasks(p, f.Observer)
    observer.close()
    p.close()
    f.notify()
    observer.close()
    expect(f.counts()).toEqual({ disconnected: 1, drained: 1 })
    expect(p.snapshot()).toMatchObject({
      observerState: 'closed',
      longTasks: [{ startMs: 20, durationMs: 55 }],
    })
    expect(JSON.stringify(p.snapshot())).not.toContain('PRIVATE')
  })
  test.each(['observe', 'takeRecords', 'disconnect'] as const)(
    'failure %s does not escape or leak the observer',
    (fault) => {
      const f = fixture(fault),
        p = nativeStartupDiagnostic(() => 500)
      p.begin('camera')
      const observer = observeNativeStartupLongTasks(p, f.Observer)
      expect(() => observer.close()).not.toThrow()
      expect(f.counts().disconnected).toBe(1)
      expect(p.snapshot().observerState).toBe('failed')
      expect(JSON.stringify(p.snapshot())).not.toContain('PRIVATE')
    },
  )
  test('unsupported API does not claim a successful observation window', () => {
    const p = nativeStartupDiagnostic(() => 500)
    observeNativeStartupLongTasks(p, null).close()
    expect(p.snapshot()).toMatchObject({ observerState: 'unsupported', longTasks: [] })
  })
})
