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
import { FACE_MODEL_PATH, GESTURE_MODEL_PATH, POSE_MODELS, WASM_BASE_PATH } from './constants'
import { copyPosePoints } from './ownedPoseFrame'
import type { WorkerInferenceConfig, WorkerPoseData } from './workerInference'
import type { WorkerInferenceEngine } from './workerInferenceRuntime'

export async function prepareWorkerNativeEngine(
  config: WorkerInferenceConfig,
  signal: AbortSignal,
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
    if (typeof OffscreenCanvas !== 'function') throw new Error()
    // Fixed same-origin absolute assets. A worker has no DOM/import-meta-relative model URL.
    const path = (asset: string) => new URL(asset, `${new URL(self.location.href).origin}/`).href
    const vision = await FilesetResolver.forVisionTasks(path(WASM_BASE_PATH))
    signal.throwIfAborted()
    async function load<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
      try {
        return await create('GPU')
      } catch {
        signal.throwIfAborted()
        return create('CPU')
      }
    }
    const body = own(
      await load((delegate) =>
        PoseLandmarker.createFromOptions(vision, {
          canvas: new OffscreenCanvas(1, 1),
          baseOptions: { modelAssetPath: path(POSE_MODELS[config.model].path), delegate },
          runningMode: 'VIDEO',
          numPoses: 2,
        }),
      ),
    )
    const face = config.face
      ? own(
          await load((delegate) =>
            FaceLandmarker.createFromOptions(vision, {
              canvas: new OffscreenCanvas(1, 1),
              baseOptions: { modelAssetPath: path(FACE_MODEL_PATH), delegate },
              runningMode: 'VIDEO',
              numFaces: 1,
              outputFacialTransformationMatrixes: true,
              outputFaceBlendshapes: false,
            }),
          ),
        )
      : undefined
    const hands = config.hands
      ? own(
          await load((delegate) =>
            GestureRecognizer.createFromOptions(vision, {
              canvas: new OffscreenCanvas(1, 1),
              baseOptions: { modelAssetPath: path(GESTURE_MODEL_PATH), delegate },
              runningMode: 'VIDEO',
              numHands: 2,
            }),
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
          const nativeFace = face?.detectForVideo(frame, at)
          const headOrientation =
            single && nativeFace ? readHeadOrientation(nativeFace, config.matrixLayout) : null
          const nativeHands = hands?.recognizeForVideo(frame, at)
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
