// FR-M-01/02/07·FR-U-04/NFR-07/08: local native resource leases, no classifier or avatar-ready stub.
import { CameraCleanupError, closeCamera, openCamera } from '../pose/camera'
import { POSE_MODELS, type PoseModel } from '../pose/constants'
import { createFaceLandmarker, type LoadedFaceLandmarker } from '../pose/face'
import { createGestureRecognizer, type LoadedGestureRecognizer } from '../pose/hands'
import { createPoseLandmarker, type LoadedLandmarker } from '../pose/landmarker'
import {
  type OwnedResource,
  ResourceCleanupError,
  type ResourceContext,
  type ResourceNotice,
  ResourceObserverError,
  ResourceOwnershipError,
} from './resources'

type ErrorNotice = Extract<ResourceNotice, { type: 'error' }>
type Options = Readonly<{
  poseModel: PoseModel
  onFailure(notice: ErrorNotice): void | Promise<void>
}>
export type CameraLease = OwnedResource & Readonly<{ stream: MediaStream }>
export type InferenceLease = OwnedResource &
  Readonly<{
    pose: LoadedLandmarker
    hand: LoadedGestureRecognizer
    face: LoadedFaceLandmarker
  }>
type Native = { close(): void }
type Claim = { task: Native; close: Native['close']; cleanup?: Promise<void> }
type Owner = {
  generation: number
  signal: AbortSignal
  abort: AbortController
  unbind(): void
  stream: MediaStream | null
  ended: (() => void) | null
  claims: Claim[]
  disposed: boolean
  inferenceStarted: boolean
  cleanupFailed: boolean
  cleanup?: Promise<void>
}

/** Native handles stay in browser memory. Creating ports requests nothing. Avatar factory,
 * authentication/validated motion, frame classification and recording are deliberately absent.
 * Aborting cannot dismiss the browser's permission popup or cancel MediaPipe creation itself.
 */
export function createBrowserPorts(video: HTMLVideoElement, options: Options) {
  const poseModel = options.poseModel
  if (!Object.hasOwn(POSE_MODELS, poseModel)) throw new TypeError('Explicit pose model required')
  let current: Owner | null = null
  let lastGeneration = 0
  let poisoned: 'cleanup-error' | 'callback-error' | null = null
  let observerFailed = false
  let cleanupReported = false
  const natives = new WeakSet<object>()
  const pendingCleanup = new Set<Promise<void>>()
  const active = (owner: Owner) =>
    current === owner && !owner.disposed && !poisoned && !owner.abort.signal.aborted

  function notify(notice: ErrorNotice) {
    if (observerFailed) return
    const broke = () => {
      observerFailed = true
      poisoned = 'callback-error'
      if (current) void retire(current).catch(() => {})
    }
    try {
      void Promise.resolve(options.onFailure(Object.freeze(notice))).catch(broke)
    } catch {
      broke()
    }
  }

  function cleanupBroke(owner: Owner) {
    owner.cleanupFailed = true
    poisoned = 'cleanup-error'
    if (!cleanupReported) {
      cleanupReported = true
      notify({ type: 'error', generation: owner.generation, reason: 'cleanup-error' })
    }
    if (current && current !== owner) void retire(current).catch(() => {})
  }

  function closeTask(owner: Owner, claim: Claim): Promise<void> {
    if (claim.cleanup) return claim.cleanup
    const cleanup = Promise.resolve()
      .then(() => claim.close.call(claim.task))
      .catch(() => {
        cleanupBroke(owner)
        throw new ResourceCleanupError()
      })
    claim.cleanup = cleanup
    pendingCleanup.add(cleanup)
    void cleanup.then(
      () => pendingCleanup.delete(cleanup),
      () => pendingCleanup.delete(cleanup),
    )
    return cleanup
  }

  function retire(owner: Owner): Promise<void> {
    if (owner.cleanup) return owner.cleanup
    owner.disposed = true
    if (current === owner) current = null
    owner.unbind()
    if (owner.ended) {
      for (const track of owner.stream?.getTracks() ?? [])
        track.removeEventListener('ended', owner.ended)
      owner.ended = null
    }
    // Register before any native cleanup or abort listener can reenter.
    owner.cleanup = Promise.resolve().then(async () => {
      const tasks = owner.claims.map((claim) => closeTask(owner, claim))
      const stream = owner.stream
      owner.stream = null
      try {
        closeCamera(video, stream)
      } catch {
        cleanupBroke(owner)
      }
      await Promise.allSettled(tasks)
      if (owner.cleanupFailed) throw new ResourceCleanupError()
    })
    owner.abort.abort()
    return owner.cleanup
  }

  function verify(context: ResourceContext) {
    if (poisoned === 'cleanup-error') throw new ResourceCleanupError()
    if (poisoned === 'callback-error') throw new ResourceObserverError()
    if (!Number.isSafeInteger(context.generation) || context.generation <= 0)
      throw new TypeError('Invalid generation')
    context.signal.throwIfAborted()
  }

  async function camera(context: ResourceContext): Promise<CameraLease> {
    verify(context)
    if (context.generation <= lastGeneration) throw new ResourceOwnershipError()
    lastGeneration = context.generation
    if (current) await retire(current)
    // Known cleanup may belong to an older actor whose task finished late.
    await Promise.allSettled([...pendingCleanup])
    verify(context)
    if (context.generation !== lastGeneration) throw new ResourceOwnershipError()
    const owner: Owner = {
      generation: context.generation,
      signal: context.signal,
      abort: new AbortController(),
      unbind: () => {},
      stream: null,
      ended: null,
      claims: [],
      disposed: false,
      inferenceStarted: false,
      cleanupFailed: false,
    }
    const abort = () => {
      void retire(owner).catch(() => {})
    }
    owner.unbind = () => context.signal.removeEventListener('abort', abort)
    context.signal.addEventListener('abort', abort, { once: true })
    current = owner
    try {
      const stream = await openCamera(video, owner.abort.signal)
      owner.stream = stream
      if (!active(owner)) {
        // openCamera normally handles abort, but also reclaim a value returned during replacement.
        try {
          closeCamera(video, stream)
        } catch {
          cleanupBroke(owner)
        }
        owner.stream = null
        if (owner.cleanupFailed) throw new ResourceCleanupError()
        throw new DOMException('Preparation cancelled', 'AbortError')
      }
      owner.ended = () => {
        if (!active(owner)) return
        notify({ type: 'error', generation: owner.generation, reason: 'camera-error' })
        void retire(owner).catch(() => {})
      }
      for (const track of stream.getTracks()) track.addEventListener('ended', owner.ended)
      if (
        stream.getTracks().length === 0 ||
        stream.getTracks().some((track) => track.readyState === 'ended')
      ) {
        throw new DOMException('Camera unavailable', 'NotReadableError')
      }
      return Object.freeze({ stream, dispose: () => retire(owner) })
    } catch (error) {
      if (error instanceof CameraCleanupError) cleanupBroke(owner)
      await retire(owner)
      if (owner.cleanupFailed) throw new ResourceCleanupError()
      throw error
    }
  }

  async function inference(context: ResourceContext): Promise<InferenceLease> {
    verify(context)
    const owner = current
    if (
      !owner ||
      !active(owner) ||
      !owner.stream ||
      owner.generation !== context.generation ||
      owner.inferenceStarted ||
      context.signal !== owner.signal
    ) {
      throw new ResourceOwnershipError()
    }
    owner.inferenceStarted = true
    const owned: Owner = owner
    async function load<T>(factory: () => Promise<T>, select: (loaded: T) => Native): Promise<T> {
      if (!active(owned)) throw new DOMException('Preparation cancelled', 'AbortError')
      const loaded = await factory()
      const task = select(loaded)
      if (!task || typeof task !== 'object' || typeof task.close !== 'function')
        throw new TypeError('Invalid native task')
      if (natives.has(task)) throw new ResourceOwnershipError()
      natives.add(task)
      const claim = { task, close: task.close }
      owned.claims.push(claim)
      if (!active(owned)) {
        await closeTask(owned, claim)
        throw new DOMException('Preparation cancelled', 'AbortError')
      }
      return loaded
    }
    try {
      const pose = await load(
        () => createPoseLandmarker(poseModel),
        (value) => value.landmarker,
      )
      const hand = await load(createGestureRecognizer, (value) => value.recognizer)
      const face = await load(createFaceLandmarker, (value) => value.landmarker)
      return Object.freeze({ pose, hand, face, dispose: () => retire(owner) })
    } catch (error) {
      await retire(owner)
      if (owner.cleanupFailed) throw new ResourceCleanupError()
      throw error
    }
  }
  return Object.freeze({ camera, inference })
}
