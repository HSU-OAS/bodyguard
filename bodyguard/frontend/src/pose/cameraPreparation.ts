// FR-M-01/02/07·FR-U-04·NFR-08: preparation is NOT coaching or an accepted-body gate.
import { ResourceCleanupError } from '../coaching/resources'
import { type CameraErrorKind, cameraErrorKind, closeCamera, openCamera } from './camera'
import { POSE_MODELS, type PoseModel } from './constants'
import { capturePreparationFrame } from './preparationFrame'
import { createWorkerPoseInference } from './workerInference'

export type PreparationState = Readonly<
  | { phase: 'idle' | 'preparing' | 'ready' | 'stopping' }
  | { phase: 'error'; reason: CameraErrorKind | 'inference' | 'frame' | 'cleanup' }
>
type WorkerOwner = Awaited<ReturnType<typeof createWorkerPoseInference>>
type Operation = {
  controller: AbortController
  task: Promise<void>
  stream?: MediaStream
  worker?: WorkerOwner
  tracks: MediaStreamTrack[]
  ended: () => void
  cleanup?: Promise<void>
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
      controller: new AbortController(),
      task: Promise.resolve(),
      tracks: [],
      ended: () => {
        void stop()
      },
    }
    active = op
    const currentGeneration = ++generation
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
          { generation: currentGeneration, signal: op.controller.signal },
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
  async function stop() {
    const op = active
    if (!op) return
    publish({ phase: 'stopping' })
    op.controller.abort()
    // Do not leave the camera running while native teardown or permission settles.
    closeStream(op)
    await op.task
    await cleanup(op)
    finish(op)
  }
  return Object.freeze({
    get state() {
      return state
    },
    start,
    stop,
    close() {
      closed = true
      return stop()
    },
  })
}
