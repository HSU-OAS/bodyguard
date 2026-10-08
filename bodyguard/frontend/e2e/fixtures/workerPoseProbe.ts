// S6.11 private browser probe: fake camera only; no raw input/output retained or exported.
import { closeCamera, openCamera } from '../../src/pose/camera'
import { createVideoPoseSource } from '../../src/pose/videoPoseSource'
import { createWorkerPoseInference } from '../../src/pose/workerInference'

export function mountWorkerPoseProbe() {
  const abort = new AbortController(),
    video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.hidden = true
  let stream: MediaStream | undefined
  let inference: Awaited<ReturnType<typeof createWorkerPoseInference>> | undefined
  let source: ReturnType<typeof createVideoPoseSource> | undefined
  let state = 'idle',
    frames = 0,
    nonempty = 0,
    closed = false
  let startedAt = 0,
    readyMs: number | null = null,
    firstMs: number | null = null
  let preparing: Promise<void> | undefined
  let workerCreated = false
  async function start() {
    if (state !== 'idle') throw new Error('Private worker probe unavailable')
    state = 'preparing'
    startedAt = performance.now()
    try {
      stream = await openCamera(video, abort.signal)
      const pending = createWorkerPoseInference(
        { generation: 1, signal: abort.signal },
        {
          model: 'lite',
          face: true,
          hands: true,
          matrixLayout: 'column-major',
        },
      )
      workerCreated = true
      inference = await pending
      if (abort.signal.aborted) throw new Error()
      source = createVideoPoseSource(
        { generation: 1, signal: abort.signal },
        { video, stream, detect: inference.detect },
      )
      readyMs = performance.now() - startedAt
      state = 'running'
    } catch {
      state = abort.signal.aborted ? 'cancelled' : 'failed'
      if (stream) closeCamera(video, stream)
    }
  }
  async function read() {
    const frame = await source?.read()
    if (frame) {
      frames++
      if (
        frame.result.landmarks.length ||
        frame.result.worldLandmarks.length ||
        frame.result.hands?.length ||
        frame.result.headOrientation
      )
        nonempty++
      firstMs ??= performance.now() - startedAt
    }
  }
  async function close() {
    if (closed) return snapshot()
    closed = true
    abort.abort()
    if (stream) closeCamera(video, stream)
    await source?.dispose()
    await preparing
    await inference?.dispose()
    state = 'closed'
    return snapshot()
  }
  function snapshot() {
    return {
      state,
      workerCreated,
      frames,
      nonempty,
      readyMs,
      firstMs,
      tracksEnded: stream?.getTracks().every((t) => t.readyState === 'ended') ?? true,
      detached: video.srcObject === null,
    }
  }
  return {
    begin() {
      preparing = start()
      return preparing
    },
    read,
    close,
    snapshot,
  }
}
