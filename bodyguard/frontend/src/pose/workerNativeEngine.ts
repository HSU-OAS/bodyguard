// FR-M-02/07·ADR-0016/17: same configured SDK behavior on the worker thread only.
import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
  PoseLandmarker,
} from '@mediapipe/tasks-vision'
import { readHeadOrientation } from '../avatar/headOrientationRig'
import { ResourceCleanupError } from '../coaching/resources'
import { JOINT_COUNT } from '../posture/landmarks'
import { readNativeHands } from './bodyHandVideoSource'
import { WASM_BASE_PATH } from './constants'
import { type OwnedModelAssets, validateOwnedModelAssets } from './ownedModelAssets'
import { copyPosePoints } from './ownedPoseFrame'
import type { WorkerInferenceConfig, WorkerPoseData } from './workerInference'
import type { WorkerInferenceEngine } from './workerInferenceRuntime'

export async function prepareWorkerNativeEngine(
  config: WorkerInferenceConfig,
  signal: AbortSignal,
  modelAssets: OwnedModelAssets,
): Promise<WorkerInferenceEngine> {
  const releases: (() => void)[] = []
  let disposed = false,
    cleanupFailed = false
  function dispose() {
    if (!disposed) {
      disposed = true
      for (const release of releases.reverse()) {
        try {
          release()
        } catch {
          cleanupFailed = true
        }
      }
      releases.length = 0
    }
    if (cleanupFailed) throw new ResourceCleanupError()
  }
  function own<T extends { close(): void }>(task: T): T {
    releases.push(() => task.close())
    signal.throwIfAborted()
    return task
  }
  try {
    signal.throwIfAborted()
    const assets = validateOwnedModelAssets(config, modelAssets)
    if (typeof OffscreenCanvas !== 'function') throw new Error()
    // Fixed same-origin absolute assets. A worker has no DOM/import-meta-relative model URL.
    const path = (asset: string) => new URL(asset, `${new URL(self.location.href).origin}/`).href
    const vision = await FilesetResolver.forVisionTasks(path(WASM_BASE_PATH))
    signal.throwIfAborted()
    async function load<T>(
      create: (delegate: 'GPU' | 'CPU') => Promise<T>,
      preferred: 'GPU' | 'CPU' = 'CPU',
    ): Promise<T> {
      try {
        return await create(preferred)
      } catch {
        signal.throwIfAborted()
        return create(preferred === 'GPU' ? 'CPU' : 'GPU')
      }
    }
    const body = own(
      await load((delegate) =>
        PoseLandmarker.createFromOptions(vision, {
          canvas: new OffscreenCanvas(1, 1),
          baseOptions: { modelAssetBuffer: new Uint8Array(assets.body), delegate },
          runningMode: 'VIDEO',
          numPoses: 2,
        }),
      ),
    )
    const face = assets.face
      ? own(
          await load((delegate) =>
            FaceLandmarker.createFromOptions(vision, {
              canvas: new OffscreenCanvas(1, 1),
              baseOptions: {
                modelAssetBuffer: new Uint8Array(assets.face as ArrayBuffer),
                delegate,
              },
              runningMode: 'VIDEO',
              numFaces: 1,
              outputFacialTransformationMatrixes: true,
              outputFaceBlendshapes: false,
            }),
          ),
        )
      : undefined
    const hands = assets.hands
      ? own(
          // FR-M-07: CPU is a tested candidate for reducing cold-start contention.
          // GPU remains a fallback; tracking accuracy is not yet validated.
          await load(
            (delegate) =>
              GestureRecognizer.createFromOptions(vision, {
                canvas: new OffscreenCanvas(1, 1),
                baseOptions: {
                  modelAssetBuffer: new Uint8Array(assets.hands as ArrayBuffer),
                  delegate,
                },
                runningMode: 'VIDEO',
                numHands: 2,
              }),
            'CPU',
          ),
        )
      : undefined
    return Object.freeze({
      detect(frame: VideoFrame, at: number) {
        if (disposed || signal.aborted) throw new Error('Worker inference unavailable')
        const result = body.detectForVideo(frame, at)
        let copied: WorkerPoseData | undefined,
          inferenceFailed = false,
          resultCleanupFailed = false
        try {
          const landmarks = copyPosePoints(result.landmarks),
            worldLandmarks = copyPosePoints(result.worldLandmarks)
          const single =
            landmarks.length === 1 &&
            worldLandmarks.length === 1 &&
            [landmarks[0], worldLandmarks[0]].every(
              (points) =>
                points.length === JOINT_COUNT &&
                points.every((p) => [p.x, p.y, p.z].every(Number.isFinite)),
            )
          // FR-M-02/07: skip only candidates this existing structural gate discards.
          const nativeFace = single ? face?.detectForVideo(frame, at) : undefined
          const headOrientation =
            single && nativeFace ? readHeadOrientation(nativeFace, config.matrixLayout) : null
          const nativeHands = single ? hands?.recognizeForVideo(frame, at) : undefined
          copied = Object.freeze({
            landmarks,
            worldLandmarks,
            ...(face
              ? {
                  headOrientation,
                }
              : {}),
            ...(hands
              ? { hands: single && nativeHands ? readNativeHands(nativeHands) : Object.freeze([]) }
              : {}),
          })
        } catch {
          inferenceFailed = true
        } finally {
          try {
            result.close()
          } catch {
            resultCleanupFailed = true
          }
        }
        if (resultCleanupFailed) throw new ResourceCleanupError()
        if (inferenceFailed || !copied) throw new Error('Worker inference unavailable')
        return copied
      },
      dispose,
    })
  } catch {
    dispose()
    throw new Error('Worker inference unavailable')
  }
}
