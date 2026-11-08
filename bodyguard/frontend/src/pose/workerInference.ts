// FR-M-02/07·FR-A-03/NFR-07/08: private same-browser, one-in-flight inference owner.
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import { POSE_MODELS, type PoseModel } from './constants'
import { createInferenceWorker } from './inferenceWorker'
import { prepareOwnedModelAssets, validateOwnedModelAssets } from './ownedModelAssets'
import type { OwnedPoseResult } from './ownedPoseFrame'

export type WorkerInferenceConfig = Readonly<{
  model: PoseModel
  face: boolean
  hands: boolean
  matrixLayout: 'column-major' | 'row-major'
}>
export type WorkerPoseData = Omit<OwnedPoseResult, 'close'>
const unavailable = () => new Error('Worker inference unavailable')
// Technical disposal bound, NOT a motion/clinical timer or the native start test limit.
const CLEANUP_LIMIT_MS = 5000
// FR-M-07/NFR-07: bounded technical wait for each request; no clinical/time gate changes.
const RESPONSE_LIMIT_MS = 5000

export async function createWorkerPoseInference(
  context: ResourceContext,
  options: WorkerInferenceConfig,
) {
  const { generation, signal } = context
  let config: WorkerInferenceConfig
  try {
    config = Object.freeze({
      model: options.model,
      face: options.face,
      hands: options.hands,
      matrixLayout: options.matrixLayout,
    })
    if (
      !Number.isSafeInteger(generation) ||
      generation <= 0 ||
      signal.aborted ||
      typeof Worker !== 'function' ||
      typeof config.model !== 'string' ||
      !Object.hasOwn(POSE_MODELS, config.model) ||
      typeof config.face !== 'boolean' ||
      typeof config.hands !== 'boolean' ||
      !['column-major', 'row-major'].includes(config.matrixLayout)
    )
      throw unavailable()
  } catch {
    throw unavailable()
  }
  let worker: Worker
  let terminateWorker: () => void
  try {
    const owned = createInferenceWorker()
    worker = owned.worker
    terminateWorker = owned.terminate
  } catch {
    throw unavailable()
  }
  let retiring = false,
    terminated = false,
    ready = false,
    cleanupFailed = false
  let initSent = false
  let booted = false
  const modelAbort = new AbortController()
  let nextId = 0,
    lastAt = -Infinity
  let pending:
    | { id: number; at: number; resolve(value: OwnedPoseResult): void; reject(error: Error): void }
    | undefined
  let resolveReady!: () => void, rejectReady!: (error: Error) => void
  const prepared = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // postMessage itself may fail before the await below owns the rejection.
  void prepared.catch(() => {})
  let resolveBoot!: () => void, rejectBoot!: (error: Error) => void
  const boot = new Promise<void>((resolve, reject) => {
    resolveBoot = resolve
    rejectBoot = reject
  })
  void boot.catch(() => {})
  let disposal: Promise<void> | undefined
  let finishDisposal: ((clean: boolean) => void) | undefined
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined
  let cleanupDeadline: number | undefined
  let responseTimer: ReturnType<typeof setTimeout> | undefined
  let responseDeadline: number | undefined
  function clearResponseTimer() {
    if (responseTimer !== undefined) clearTimeout(responseTimer)
    responseTimer = undefined
    responseDeadline = undefined
  }
  function awaitResponse() {
    clearResponseTimer()
    responseDeadline = performance.now() + RESPONSE_LIMIT_MS
    responseTimer = setTimeout(() => {
      responseTimer = undefined
      failed()
    }, RESPONSE_LIMIT_MS)
  }
  function terminate() {
    if (terminated) return
    terminated = true
    signal.removeEventListener('abort', aborted)
    worker.removeEventListener('message', message)
    worker.removeEventListener('error', failed)
    worker.removeEventListener('messageerror', failed)
    if (cleanupTimer !== undefined) clearTimeout(cleanupTimer)
    clearResponseTimer()
    terminateWorker()
  }
  function rejectWork() {
    clearResponseTimer()
    const current = pending
    pending = undefined
    current?.reject(unavailable())
    if (!booted) rejectBoot(unavailable())
    if (!ready) rejectReady(unavailable())
  }
  function failed() {
    if (terminated) return
    rejectWork()
    // Reject authority immediately; even protocol/SDK failure must reclaim native
    // tasks before terminating, or report the bounded cleanup failure to its owner.
    void dispose().catch(() => {})
  }
  function message(event: MessageEvent<unknown>) {
    if (terminated) return
    try {
      const data = event.data as Record<string, unknown>
      // No SDK can exist until the installed native handler acknowledges its boot.
      // Keep boot + init within the SAME original response deadline after model reads.
      if (data?.type === 'boot' && !retiring) {
        if (
          typeof data !== 'object' ||
          Array.isArray(data) ||
          booted ||
          initSent ||
          Object.keys(data).length !== 1 ||
          (responseDeadline !== undefined && performance.now() >= responseDeadline)
        )
          throw unavailable()
        booted = true
        resolveBoot()
        return
      }
      if (!data || typeof data !== 'object' || data.generation !== generation) throw unavailable()
      if (retiring) {
        if (data.type === 'closed')
          finishDisposal?.(
            data.clean === true &&
              cleanupDeadline !== undefined &&
              performance.now() < cleanupDeadline,
          )
        return
      }
      // A delayed timer callback cannot make an overdue response timely.
      if (responseDeadline !== undefined && performance.now() >= responseDeadline)
        throw unavailable()
      if (data.type === 'ready' && initSent && data.id === 0 && !ready && !pending) {
        clearResponseTimer()
        ready = true
        resolveReady()
        return
      }
      if (
        data.type !== 'result' ||
        !ready ||
        !pending ||
        data.id !== pending.id ||
        data.at !== pending.at ||
        !data.result ||
        typeof data.result !== 'object'
      )
        throw unavailable()
      const current = pending
      clearResponseTimer()
      pending = undefined
      // Downstream owned-frame boundary copies/validates all bounded body/head/hand fields.
      const result = data.result as WorkerPoseData
      current.resolve({ ...result, close() {} })
    } catch {
      failed()
    }
  }
  function dispose(): Promise<void> {
    if (disposal) return disposal
    retiring = true
    modelAbort.abort()
    rejectWork()
    if (terminated) return Promise.reject(new ResourceCleanupError())
    disposal = new Promise<void>((resolve, reject) => {
      finishDisposal = (clean) => {
        finishDisposal = undefined
        clean = clean && !cleanupFailed
        try {
          terminate()
        } catch {
          clean = false
        }
        if (clean) resolve()
        else reject(new ResourceCleanupError())
      }
      // No native task can exist before init is sent. After init, require the original ack.
      if (!initSent) {
        finishDisposal(true)
        return
      }
      // As with inference responses, a delayed event loop must not turn a late
      // acknowledgement into an on-time cleanup. The timeout remains unchanged.
      cleanupDeadline = performance.now() + CLEANUP_LIMIT_MS
      cleanupTimer = setTimeout(() => finishDisposal?.(false), CLEANUP_LIMIT_MS)
      try {
        worker.postMessage({ type: 'close', generation })
      } catch {
        finishDisposal(false)
      }
    })
    return disposal
  }
  function aborted() {
    void dispose().catch(() => {})
  }
  worker.addEventListener('message', message)
  worker.addEventListener('error', failed)
  worker.addEventListener('messageerror', failed)
  signal.addEventListener('abort', aborted, { once: true })
  try {
    if (signal.aborted) {
      aborted()
      throw unavailable()
    }
    const assets = validateOwnedModelAssets(
      config,
      await Promise.race([
        prepareOwnedModelAssets(config, modelAbort.signal),
        prepared.then(() => {
          throw unavailable()
        }),
      ]),
    )
    if (retiring || signal.aborted) throw unavailable()
    awaitResponse()
    await boot
    if (
      retiring ||
      signal.aborted ||
      responseDeadline === undefined ||
      performance.now() >= responseDeadline
    )
      throw unavailable()
    initSent = true
    worker.postMessage({ type: 'init', generation, id: 0, config, assets }, Object.values(assets))
    await prepared
    if (retiring || signal.aborted) throw unavailable()
  } catch {
    if (!retiring) failed()
    if (disposal) await disposal
    throw unavailable()
  }
  return Object.freeze({
    thread: 'worker' as const,
    async detect(frame: VideoFrame, at: number): Promise<OwnedPoseResult> {
      if (
        retiring ||
        terminated ||
        signal.aborted ||
        pending ||
        !Number.isFinite(at) ||
        at < 0 ||
        at <= lastAt ||
        nextId >= Number.MAX_SAFE_INTEGER
      )
        throw unavailable()
      let input: VideoFrame | undefined
      try {
        input = frame.clone()
        if (input.displayWidth <= 0 || input.displayHeight <= 0) throw unavailable()
        const id = ++nextId
        lastAt = at
        const task = new Promise<OwnedPoseResult>((resolve, reject) => {
          pending = { id, at, resolve, reject }
        })
        try {
          awaitResponse()
          worker.postMessage({ type: 'frame', generation, id, at, frame: input }, [input])
        } catch {
          failed()
        } finally {
          try {
            input.close()
          } catch {
            cleanupFailed = true
            failed()
          }
          input = undefined
        }
        return await task
      } catch {
        throw unavailable()
      } finally {
        try {
          input?.close()
        } catch {
          cleanupFailed = true
          failed()
        }
      }
    },
    dispose,
  })
}
