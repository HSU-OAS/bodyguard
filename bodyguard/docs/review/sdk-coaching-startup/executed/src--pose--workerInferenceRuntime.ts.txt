// FR-M-02/07·NFR-07/08: worker-local bounded state, no raw diagnostics/persistence.

import { ResourceCleanupError } from '../coaching/resources'
import { POSE_MODELS } from './constants'
import { type OwnedModelAssets, validateOwnedModelAssets } from './ownedModelAssets'
import type { WorkerInferenceConfig, WorkerPoseData } from './workerInference'

export type WorkerInferenceEngine = Readonly<{
  detect(frame: VideoFrame, at: number): WorkerPoseData | Promise<WorkerPoseData>
  dispose(): void | Promise<void>
}>
export function createWorkerInferenceRuntime(
  ports: Readonly<{
    prepare(
      config: WorkerInferenceConfig,
      signal: AbortSignal,
      assets: OwnedModelAssets,
    ): Promise<WorkerInferenceEngine>
    send(message: unknown): void
  }>,
) {
  let generation = 0,
    state: 'idle' | 'preparing' | 'ready' | 'closing' | 'closed' | 'failed' = 'idle'
  let engine: WorkerInferenceEngine | undefined
  let preparing: Promise<void> | undefined, inFlight: Promise<void> | undefined
  let lastId = 0,
    lastAt = -Infinity,
    cleanupFailed = false
  const abort = new AbortController()
  function send(message: Record<string, unknown>) {
    ports.send({ ...message, generation })
  }
  function fail(id: number) {
    if (state === 'closing' || state === 'closed') return
    state = 'failed'
    send({ type: 'error', id })
  }
  async function close() {
    if (state === 'closing' || state === 'closed') return
    state = 'closing'
    abort.abort()
    await preparing
    await inFlight
    try {
      await engine?.dispose()
    } catch {
      cleanupFailed = true
    }
    engine = undefined
    state = 'closed'
    send({ type: 'closed', clean: !cleanupFailed })
  }
  function receive(value: unknown) {
    let frame: VideoFrame | undefined,
      id = 0
    try {
      const message = value as Record<string, unknown>
      if (!message || typeof message !== 'object') throw new Error()
      if (message.type === 'init') {
        if (
          state !== 'idle' ||
          message.id !== 0 ||
          !Number.isSafeInteger(message.generation) ||
          (message.generation as number) <= 0
        )
          throw new Error()
        const config = message.config as WorkerInferenceConfig
        if (
          !config ||
          typeof config !== 'object' ||
          typeof config.model !== 'string' ||
          !Object.hasOwn(POSE_MODELS, config.model) ||
          typeof config.face !== 'boolean' ||
          typeof config.hands !== 'boolean' ||
          !['column-major', 'row-major'].includes(config.matrixLayout)
        )
          throw new Error()
        generation = message.generation as number
        const assets = validateOwnedModelAssets(config, message.assets)
        state = 'preparing'
        preparing = Promise.resolve()
          .then(() =>
            ports.prepare(
              Object.freeze({
                model: config.model,
                face: config.face,
                hands: config.hands,
                matrixLayout: config.matrixLayout,
              }),
              abort.signal,
              assets,
            ),
          )
          .then((loaded) => {
            engine = loaded
            if (state === 'preparing') {
              state = 'ready'
              send({ type: 'ready', id: 0 })
            }
          })
          .catch((error) => {
            if (error instanceof ResourceCleanupError) cleanupFailed = true
            fail(0)
          })
        return
      }
      if (message.type === 'frame') frame = message.frame as VideoFrame
      if (message.generation !== generation) throw new Error()
      if (message.type === 'close') {
        void close()
        return
      }
      frame = message.frame as VideoFrame
      id = message.id as number
      const at = message.at as number
      if (
        message.type !== 'frame' ||
        state !== 'ready' ||
        inFlight ||
        !engine ||
        !Number.isSafeInteger(id) ||
        id <= lastId ||
        !Number.isFinite(at) ||
        at < 0 ||
        at <= lastAt ||
        !frame ||
        typeof frame.close !== 'function' ||
        frame.displayWidth <= 0 ||
        frame.displayHeight <= 0
      )
        throw new Error()
      lastId = id
      lastAt = at
      const input = frame
      frame = undefined
      const current = engine
      inFlight = Promise.resolve()
        .then(async () => {
          let result: WorkerPoseData | undefined
          try {
            result = await current.detect(input, at)
          } catch (error) {
            if (error instanceof ResourceCleanupError) cleanupFailed = true
            fail(id)
          } finally {
            try {
              input.close()
            } catch {
              cleanupFailed = true
              fail(id)
            }
          }
          if (result && state === 'ready' && !abort.signal.aborted)
            send({ type: 'result', id, at, result })
        })
        .catch(() => {
          fail(id)
        })
        .finally(() => {
          inFlight = undefined
        })
    } catch {
      try {
        frame?.close()
      } catch {
        cleanupFailed = true
      }
      fail(id)
    }
  }
  return Object.freeze({ receive })
}
