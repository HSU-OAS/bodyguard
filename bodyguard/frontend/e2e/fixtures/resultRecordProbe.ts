// FR-R-03/FR-U-04: TEST ONLY, synthetic gates/observations/resources, actual session/codec/writer.
import { createRecordWriter, resultRecord } from '../../src/coaching/resultRecord'
import { createCoachingSession } from '../../src/coaching/session'

export async function prepareResultProbe(options: {
  kind: 'completed' | 'partial-skip' | 'skipped' | 'paused-interrupted'
  recordId: string
  startedUtcAt: string
  csrfProof: string
}) {
  let now = 0
  let sequence = 0
  const owner = {}
  let currentOwner: object | null = owner
  let disposed = 0
  const acquire = () => ({
    dispose() {
      disposed++
    },
  })
  const session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps:
        options.kind === 'partial-skip'
          ? [
              { id: 'first', kind: 'hold', targetMs: 100 },
              { id: 'second', kind: 'hold', targetMs: 100 },
            ]
          : [{ id: 'first', kind: 'hold', targetMs: 100 }],
    },
    ports: { camera: acquire, inference: acquire, avatars: acquire },
    now: () => now,
    readGates: () => ({
      authenticated: true,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange() {},
  })
  const writer = createRecordWriter({
    owner,
    readOwner: () => currentOwner,
    csrfProof: options.csrfProof,
  })
  const before = writer.getSnapshot()
  await session.start()
  const frame = async (classification: 'start' | 'target' | 'returned', at: number) => {
    now = at
    await session.observe({
      generation: session.getSnapshot().state.generation,
      sampledAt: now,
      sequence: sequence++,
      personCount: 1,
      stepId: 'first',
      classification,
    })
  }
  if (options.kind === 'skipped') {
    now = 10
    await session.end('skip')
  } else {
    await frame('start', 1)
    await frame('target', 2)
    if (options.kind === 'paused-interrupted') {
      await frame('target', 42)
      now = 50
      await session.pause()
      now = 200
      await session.resume()
      now = 300
      await session.end('user-stop')
    } else {
      await frame('target', 102)
      await frame('returned', 103)
      if (options.kind === 'partial-skip') {
        now = 104
        await session.end('skip')
      }
    }
  }
  const snapshot = session.getSnapshot()
  const row = resultRecord({
    snapshot,
    recordId: options.recordId,
    startedUtcAt: options.startedUtcAt,
  })
  if (!row) throw new Error('Synthetic probe result missing')
  return {
    row,
    before,
    submit: () => writer.submit(row),
    retry: () => writer.retry(),
    snapshot: () => writer.getSnapshot(),
    changeOwner() {
      currentOwner = {}
      writer.syncOwner()
    },
    close: () => writer.close(),
    metadata: {
      synthetic_only: true,
      human_accuracy_verified: false,
      original_outcome: snapshot.state.result?.outcome,
      pending_steps: snapshot.state.result?.steps.filter((step) => step.outcome === 'pending')
        .length,
      disposed_resources: disposed,
    },
  }
}
