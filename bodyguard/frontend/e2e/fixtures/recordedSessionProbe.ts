// FR-R-03/FR-U-04: TEST ONLY, synthetic clocks/ports/authority/observations, real adapters.
import type { ReadyAccount } from '../../src/auth'
import { createRecordedSession } from '../../src/coaching/recordedSession'
import { captureRecordOwner } from '../../src/coaching/recordOwner'

export async function prepareRecordedProbe(options: {
  authority: ReadyAccount
  recordId: string
  utc: string
  delayed: boolean
}) {
  let authority = options.authority
  const abort = new AbortController()
  const context = await captureRecordOwner({
    authority,
    readAuthority: () => authority,
    signal: abort.signal,
  })
  let monotonicMs = 0
  let wall = options.utc
  let disposed = 0
  let waiting = false
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const acquire = () => ({
    dispose() {
      disposed++
    },
  })
  const session = createRecordedSession({
    context,
    recordId: options.recordId,
    readClockPair: () => ({ monotonicMs, utc: wall }),
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'first', kind: 'hold', targetMs: 100 }],
    },
    ports: {
      camera: acquire,
      inference: acquire,
      async avatars() {
        waiting = true
        if (options.delayed) await pending
        return acquire()
      },
    },
    readGates: () => ({
      authenticated: true,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange() {},
  })
  let preparation: Promise<void> | null = null
  function at(ms: number, utc = new Date(Date.parse(options.utc) + ms).toISOString()) {
    monotonicMs = ms
    wall = utc
  }
  let sequence = 0
  async function frame(classification: 'start' | 'target' | 'returned', ms: number) {
    at(ms)
    await session.observe({
      generation: session.getSnapshot().state.generation,
      sampledAt: ms,
      sequence: sequence++,
      personCount: 1,
      stepId: 'first',
      classification,
    })
  }
  return {
    start() {
      preparation = session.start()
    },
    waiting: () => waiting,
    async releaseReady() {
      at(500)
      release()
      await preparation
    },
    async perform() {
      if (!options.delayed) await preparation
      const start = options.delayed ? 500 : 0
      await frame('start', start + 1)
      await frame('target', start + 2)
      if (options.delayed) {
        await frame('target', start + 42)
        at(start + 50)
        await session.pause()
        at(start + 200, '2030-01-01T00:00:00.000Z')
        await session.resume()
        at(start + 300, '2020-01-01T00:00:00.000Z')
        await session.end('user-stop')
      } else {
        await frame('target', 102)
        await frame('returned', 103)
      }
    },
    save: session.save,
    retry: session.retry,
    async replace() {
      authority = { ...authority }
      await session.syncOwner()
    },
    dispose: session.dispose,
    state() {
      const snapshot = session.getSnapshot()
      return {
        session: snapshot.state.status,
        started: snapshot.state.startedAt,
        elapsed: snapshot.state.result?.elapsedMs ?? null,
        record: session.getRecordSnapshot(),
        disposed,
        synthetic_only: true,
      }
    },
  }
}
