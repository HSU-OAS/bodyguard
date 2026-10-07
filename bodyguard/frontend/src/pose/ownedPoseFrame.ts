// FR-M-02/07·FR-A-01/03: private single-result handoff, not classification.
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import { JOINT_COUNT, type Point } from '../posture/landmarks'

export type CapturedPoseInput<T> = Readonly<{
  generation: number
  sequence: number
  at: number
  input: T
}>
export type OwnedPoseResult = PoseRigFrame['result'] & Readonly<{ close(): void }>
/** Private frame boundary. Capture supplies borrowed input with original stamps.
 * Detect must return a fresh exclusively owned result; partial failure cleanup stays
 * provider-owned. Caller owns the detector/camera and must retire its session on a
 * read failure. This source neither authenticates nor starts a coaching session.
 */
export function createOwnedPoseFrame<T>(
  context: ResourceContext,
  ports: Readonly<{
    capture(): CapturedPoseInput<T> | null | Promise<CapturedPoseInput<T> | null>
    detect(input: T, at: number): OwnedPoseResult | Promise<OwnedPoseResult>
  }>,
) {
  const { generation, signal } = context
  if (
    !Number.isSafeInteger(generation) ||
    generation <= 0 ||
    typeof ports.capture !== 'function' ||
    typeof ports.detect !== 'function'
  )
    throw new Error('Invalid pose frame source')
  let closed = signal.aborted
  let cleanupFailed = false
  let lastSequence = 0,
    lastAt = -Infinity
  let pending: Promise<PoseRigFrame | null> | undefined
  const alive = () => !closed && !signal.aborted
  function close() {
    closed = true
    signal.removeEventListener('abort', close)
  }
  if (!closed) signal.addEventListener('abort', close, { once: true })
  function copy(poses: readonly (readonly Point[])[]) {
    if (!Array.isArray(poses) || poses.length > 2) throw new Error()
    return Object.freeze(
      poses.map((points) => {
        if (!Array.isArray(points) || points.length > JOINT_COUNT) throw new Error()
        return Object.freeze(
          points.map((point) => {
            const { x, y, z, visibility } = point
            if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number')
              throw new Error()
            return Object.freeze({
              x,
              y,
              z,
              ...(typeof visibility === 'number' ? { visibility } : {}),
            })
          }),
        )
      }),
    )
  }
  async function acquire(): Promise<PoseRigFrame | null> {
    let result: OwnedPoseResult | undefined
    let release: OwnedPoseResult['close'] | undefined
    let frame: PoseRigFrame | null = null
    let failed = false
    try {
      const captured = await ports.capture()
      if (!captured || !alive()) return null
      const suppliedGeneration = captured.generation,
        sequence = captured.sequence,
        at = captured.at
      if (
        suppliedGeneration !== generation ||
        !Number.isSafeInteger(sequence) ||
        sequence <= lastSequence ||
        !Number.isFinite(at) ||
        at < 0 ||
        at <= lastAt
      )
        return null
      const input = captured.input
      if (!alive()) return null
      // Reserve before calling foreign inference; neither a repeated input nor a late
      // result may be re-stamped to appear fresh. Input and detector stay caller-owned.
      lastSequence = sequence
      lastAt = at
      result = await ports.detect(input, at)
      try {
        release = result.close
        if (typeof release !== 'function') throw new Error()
      } catch {
        cleanupFailed = true
      }
      if (!cleanupFailed && alive()) {
        frame = Object.freeze({
          generation: suppliedGeneration,
          sequence,
          at,
          result: Object.freeze({
            landmarks: copy(result.landmarks),
            worldLandmarks: copy(result.worldLandmarks),
          }),
        })
      }
    } catch (error) {
      if (error instanceof ResourceCleanupError) cleanupFailed = true
      else failed = true
    } finally {
      if (result && release) {
        try {
          release.call(result)
        } catch {
          cleanupFailed = true
        }
      }
    }
    if (cleanupFailed) {
      close()
      throw new ResourceCleanupError()
    }
    if (failed && alive()) {
      close()
      throw new Error('Pose frame unavailable')
    }
    return alive() ? frame : null
  }
  function read(): Promise<PoseRigFrame | null> {
    if (!alive() || pending) return Promise.resolve(null)
    let resolve!: (frame: PoseRigFrame | null) => void
    let reject!: (error: unknown) => void
    // Publish ownership before capture can synchronously reenter read/dispose.
    pending = new Promise((yes, no) => {
      resolve = yes
      reject = no
    })
    const reading = pending
    void acquire().then(resolve, reject)
    // Attach both outcomes without leaving an unhandled cleanup rejection.
    void pending.then(
      () => {
        pending = undefined
      },
      () => {
        pending = undefined
      },
    )
    return reading
  }
  async function dispose(): Promise<void> {
    close()
    // The caller can safely close its detector only after this borrowed invocation
    // and native result reclamation finish. A cleanup fault remains observable.
    await pending
    if (cleanupFailed) throw new ResourceCleanupError()
  }
  return Object.freeze({ read, dispose })
}
