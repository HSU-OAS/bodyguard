// FR-M-02/07·NFR-08: private real SDK, generated blank frame, no camera/avatar/storage.
import { createWorkerPoseInference } from '../../src/pose/workerInference'

const abort = new AbortController()
let owner: Awaited<ReturnType<typeof createWorkerPoseInference>> | undefined
let job: Promise<void> | undefined
let state = 'idle',
  failure: string | null = null,
  elapsedMs = 0,
  frames = 0
const snapshot = () => ({ state, failure, elapsedMs, frames })
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
  async infer() {
    if (!owner || state !== 'ready') throw new Error('Probe not prepared')
    // Generated empty canvas, NOT a captured camera/human/clinical fixture.
    const canvas = new OffscreenCanvas(640, 480),
      context = canvas.getContext('2d')
    if (!context) throw new Error('Probe canvas unavailable')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 640, 480)
    const frame = new VideoFrame(canvas, { timestamp: 1000 })
    try {
      const result = await owner.detect(frame, 1)
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
