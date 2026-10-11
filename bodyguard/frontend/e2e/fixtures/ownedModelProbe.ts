// FR-M-02/07·NFR-08: private real SDK, generated blank frame, no camera/avatar/storage.
import { createWorkerPoseInference } from '../../src/pose/workerInference'

const abort = new AbortController()
let owner: Awaited<ReturnType<typeof createWorkerPoseInference>> | undefined
let job: Promise<void> | undefined
let state = 'idle',
  failure: string | null = null,
  elapsedMs = 0,
  frames = 0
let lastBodyGate: Readonly<{
  bodies: number
  worlds: number
  headUnavailable: boolean
  hands: number
}> | null = null
const snapshot = () => ({ state, failure, elapsedMs, frames, lastBodyGate })
const probe = {
  begin() {
    if (job) throw new Error('Owned probe already started')
    state = 'preparing'
    const start = performance.now()
    job = (async () => {
      try {
        owner = await createWorkerPoseInference(
          { generation: 1, signal: abort.signal },
          { model: 'heavy', face: true, hands: true, matrixLayout: 'column-major' },
        )
        elapsedMs = performance.now() - start
        state = 'ready'
      } catch (error) {
        elapsedMs = performance.now() - start
        state = 'failed'
        failure =
          error instanceof Error && error.message === 'Resource cleanup failed'
            ? 'cleanup'
            : 'preparation'
      }
    })()
    return job.then(snapshot)
  },
  async infer(at = 1) {
    if (!owner || state !== 'ready') throw new Error('Probe not prepared')
    if (!Number.isFinite(at) || at <= 0) throw new Error('Invalid generated input timestamp')
    // Generated empty canvas, NOT a captured camera/human/clinical fixture.
    const canvas = new OffscreenCanvas(640, 480),
      context = canvas.getContext('2d')
    if (!context) throw new Error('Probe canvas unavailable')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 640, 480)
    const frame = new VideoFrame(canvas, { timestamp: at * 1000 })
    try {
      const result = await owner.detect(frame, at)
      // Test-only bounded shape, never points/matrices or a real captured frame.
      lastBodyGate = Object.freeze({
        bodies: result.landmarks.length,
        worlds: result.worldLandmarks.length,
        headUnavailable: result.headOrientation === null,
        hands: result.hands?.length ?? -1,
      })
      result.close()
      frames++
    } finally {
      frame.close()
    }
    return snapshot()
  },
  async close() {
    abort.abort()
    await job
    try {
      await owner?.dispose()
    } catch {
      failure = 'cleanup'
    }
    owner = undefined
    state = 'closed'
    return snapshot()
  },
  snapshot,
}
Object.assign(window, { ownedModelProbe: probe })
