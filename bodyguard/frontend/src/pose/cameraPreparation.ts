// FR-M-01/02/07·FR-U-04·NFR-08: preparation is NOT coaching or an accepted-body gate.
import { ResourceCleanupError } from '../coaching/resources'
import { type CameraErrorKind, cameraErrorKind, closeCamera, openCamera } from './camera'
import { POSE_MODELS, type PoseModel } from './constants'
import { capturePreparationFrame } from './preparationFrame'
import { createVideoPoseSource } from './videoPoseSource'
import { createWorkerPoseInference } from './workerInference'

export type PreparationState = Readonly<
  | { phase: 'idle' | 'preparing' | 'ready' | 'connecting' | 'observing' | 'stopping' }
  | { phase: 'error'; reason: CameraErrorKind | 'inference' | 'frame' | 'cleanup' }
>
type WorkerOwner = Awaited<ReturnType<typeof createWorkerPoseInference>>
type ObservationSource = ReturnType<typeof createVideoPoseSource>
type Observation = Awaited<ReturnType<ObservationSource['read']>>
// Technical per-read response bound; not clinical hold time or original startup test limit.
const OBSERVATION_LIMIT_MS = 5000
type Operation = {
  generation: number
  controller: AbortController
  task: Promise<void>
  stream?: MediaStream
  worker?: WorkerOwner
  tracks: MediaStreamTrack[]
  ended: () => void
  cleanup?: Promise<void>
  source?: ObservationSource
  observationTask?: Promise<void>
  latest?: Observation
}
export function createCameraPreparation(
  options: Readonly<{
    video: HTMLVideoElement
    model: PoseModel
    allowed(): boolean
    onState(state: PreparationState): void
  }>,
) {
  const { video, model, allowed, onState } = options
  if (!Object.hasOwn(POSE_MODELS, model)) throw new Error('Camera preparation unavailable')
  let state: PreparationState = Object.freeze({ phase: 'idle' })
  let active: Operation | undefined,
    generation = 0,
    closed = false,
    poisoned = false
  function authorized() {
    try {
      return allowed() === true
    } catch {
      return false
    }
  }
  function publish(next: PreparationState) {
    state = Object.freeze(next)
    try {
      onState(state)
    } catch {
      poisoned = true
      active?.controller.abort()
    }
  }
  function check(op: Operation) {
    if (closed || poisoned || active !== op || op.controller.signal.aborted || !authorized())
      throw new DOMException('Aborted', 'AbortError')
  }
  function closeStream(op: Operation) {
    for (const track of op.tracks) track.removeEventListener('ended', op.ended)
    op.tracks = []
    const stream = op.stream
    op.stream = undefined
    if (stream) {
      try {
        closeCamera(video, stream)
      } catch {
        poisoned = true
      }
    }
  }
  function cleanup(op: Operation) {
    if (op.cleanup) return op.cleanup
    closeStream(op)
    op.cleanup = (async () => {
      try {
        await op.source?.dispose()
      } catch {
        poisoned = true
      }
      op.source = undefined
      op.latest = undefined
      try {
        await op.worker?.dispose()
      } catch {
        poisoned = true
      }
      op.worker = undefined
    })()
    return op.cleanup
  }
  function finish(op: Operation, failure?: PreparationState) {
    if (active !== op) return
    active = undefined
    publish(poisoned ? { phase: 'error', reason: 'cleanup' } : (failure ?? { phase: 'idle' }))
  }
  async function start() {
    if (closed || poisoned || active || !authorized()) return
    if (generation === Number.MAX_SAFE_INTEGER) {
      poisoned = true
      publish({ phase: 'error', reason: 'cleanup' })
      return
    }
    const op: Operation = {
      generation: ++generation,
      controller: new AbortController(),
      task: Promise.resolve(),
      tracks: [],
      ended: () => {
        void stop()
      },
    }
    active = op
    publish({ phase: 'preparing' })
    op.task = (async () => {
      let stage: 'camera' | 'inference' | 'frame' = 'camera'
      try {
        check(op)
        op.stream = await openCamera(video, op.controller.signal)
        check(op)
        op.tracks = op.stream.getVideoTracks()
        for (const track of op.tracks) {
          track.addEventListener('ended', op.ended, { once: true })
          if (track.readyState !== 'live') throw new Error()
        }
        stage = 'inference'
        op.worker = await createWorkerPoseInference(
          { generation: op.generation, signal: op.controller.signal },
          { model, face: true, hands: true, matrixLayout: 'column-major' },
        )
        check(op)
        stage = 'frame'
        const frame = await capturePreparationFrame(video, op.controller.signal)
        let result: Awaited<ReturnType<WorkerOwner['detect']>> | undefined
        try {
          check(op)
          result = await op.worker.detect(frame, performance.now())
          check(op)
        } finally {
          try {
            result?.close()
          } catch {
            poisoned = true
          }
          try {
            frame.close()
          } catch {
            poisoned = true
          }
        }
        check(op)
        publish({ phase: 'ready' })
        // A throwing state observer must not leave camera/SDK alive.
        check(op)
      } catch (error) {
        if (error instanceof ResourceCleanupError) poisoned = true
        const failure: PreparationState | undefined =
          op.controller.signal.aborted || !authorized()
            ? undefined
            : { phase: 'error', reason: stage === 'camera' ? cameraErrorKind(error) : stage }
        op.controller.abort()
        await cleanup(op)
        finish(op, failure)
      }
    })()
    await op.task
  }
  // FR-M-02/07: explicit continuous decoded input, one borrowed inference at a time.
  // Only one copied observation is retained; raw frames/results stay source-owned.
  function observe() {
    const op = active
    if (!op || state.phase !== 'ready' || op.observationTask || !authorized()) return
    op.observationTask = (async () => {
      try {
        check(op)
        if (!op.worker || !op.stream) throw new Error()
        const worker = op.worker
        const source = createVideoPoseSource(
          { generation: op.generation, signal: op.controller.signal },
          { video, stream: op.stream, detect: (frame, at) => worker.detect(frame, at) },
        )
        op.source = source
        publish({ phase: 'connecting' })
        let connected = false
        let deadline = performance.now() + OBSERVATION_LIMIT_MS
        while (true) {
          check(op)
          const remaining = deadline - performance.now()
          if (!Number.isFinite(remaining) || remaining <= 0)
            throw new Error('Camera input unavailable')
          let timer: ReturnType<typeof setTimeout> | undefined
          let observation: Observation
          try {
            observation = await Promise.race([
              source.read(),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Camera input unavailable')), remaining)
              }),
            ])
          } finally {
            if (timer !== undefined) clearTimeout(timer)
          }
          check(op)
          const now = performance.now()
          if (!Number.isFinite(now) || now >= deadline) throw new Error('Camera input unavailable')
          if (observation === null) continue
          // Source preserves the original timestamp; do not refresh an older sample.
          if (
            observation.generation !== op.generation ||
            !Number.isFinite(observation.at) ||
            observation.at < 0 ||
            observation.at > now ||
            now - observation.at >= OBSERVATION_LIMIT_MS
          )
            throw new Error('Camera input unavailable')
          deadline = now + OBSERVATION_LIMIT_MS
          op.latest = observation
          if (!connected) {
            connected = true
            publish({ phase: 'observing' })
          }
        }
      } catch (error) {
        op.latest = undefined
        if (error instanceof ResourceCleanupError) poisoned = true
        const failure: PreparationState | undefined =
          op.controller.signal.aborted || !authorized()
            ? undefined
            : { phase: 'error', reason: 'frame' }
        op.controller.abort()
        await cleanup(op)
        finish(op, failure)
      }
    })()
  }
  async function stop() {
    const op = active
    if (!op) return
    publish({ phase: 'stopping' })
    op.latest = undefined
    op.controller.abort()
    // Do not leave the camera running while native teardown or permission settles.
    closeStream(op)
    await op.task
    await op.observationTask
    await cleanup(op)
    finish(op)
  }
  return Object.freeze({
    get state() {
      return state
    },
    start,
    observe,
    // No React state, logs, persistence or clinical verdict receives these coordinates.
    takeFrame(): Observation {
      const op = active
      if (!op || state.phase !== 'observing' || !authorized() || op.controller.signal.aborted)
        return null
      const frame = op.latest ?? null
      op.latest = undefined
      const now = performance.now()
      if (
        frame &&
        (!Number.isFinite(now) || now < frame.at || now - frame.at >= OBSERVATION_LIMIT_MS)
      )
        return null
      return frame
    },
    stop,
    close() {
      closed = true
      return stop()
    },
  })
}
