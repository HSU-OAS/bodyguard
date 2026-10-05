// FR-S-04/NFR-08: actual browser RAF with explicitly synthetic gates/resources and null observations.
import { createObservationLoop } from '../../src/coaching/observationLoop'
import { createCoachingSession } from '../../src/coaching/session'
export async function probeObservationLoop() {
  let loop: ReturnType<typeof createObservationLoop> | null = null
  let reads = 0
  const contexts: AbortSignal[] = []
  const resources: { disposed: number }[] = []
  const acquire = () => {
    const resource = { disposed: 0 }
    resources.push(resource)
    return {
      dispose() {
        resource.disposed++
      },
    }
  }
  const session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'hold', kind: 'hold', targetMs: 100 }],
    },
    ports: { camera: acquire, inference: acquire, avatars: acquire },
    now: () => performance.now(),
    readGates: () => ({
      authenticated: true,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange: () => {
      loop?.sync()
    },
  })
  loop = createObservationLoop({
    session,
    scheduler: {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
    },
    readFrame: (context) => {
      reads++
      contexts.push(context.signal)
      return null
    },
  })
  const wait = async (predicate: () => boolean) => {
    const end = performance.now() + 2000
    while (!predicate()) {
      if (performance.now() > end) throw new Error('Observation loop probe timeout')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  try {
    await session.start()
    await wait(() => reads >= 2)
    await session.pause()
    const atPause = reads
    const oldSignalsAborted = contexts.every((signal) => signal.aborted)
    await new Promise((resolve) => setTimeout(resolve, 50))
    const pauseStopped = reads === atPause
    await session.resume()
    await wait(() => reads >= atPause + 2)
    await loop.close()
    const atClose = reads
    await new Promise((resolve) => setTimeout(resolve, 50))
    const snapshot = session.getSnapshot()
    return {
      actual_browser_raf: true,
      synthetic_gates_resources: true,
      real_human_camera_model_test: false,
      pause_stopped: pauseStopped,
      old_signals_aborted: oldSignalsAborted,
      close_stopped: reads === atClose,
      all_signals_aborted: contexts.every((signal) => signal.aborted),
      resources_created: resources.length,
      all_resources_disposed_once: resources.every((resource) => resource.disposed === 1),
      generation: snapshot.state.generation,
      outcome: snapshot.state.result?.outcome,
      reason: snapshot.state.result?.reason,
      verified_ms: snapshot.state.progress[0].verifiedMs,
    }
  } finally {
    await loop.close()
  }
}
