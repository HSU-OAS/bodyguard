import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { FACE_MODEL_PATH, WASM_BASE_PATH } from './constants'
import type { Delegate } from './landmarker'

export type LoadedFaceLandmarker = { landmarker: FaceLandmarker; delegate: Delegate }

// 얼굴 478점과 머리 방향 행렬을 브라우저 안에서 구한다 (원문 57, ADR-0017).
// 표정 계수(blendshapes)는 받지 않는다. 눈·입은 얼굴 점으로 잰다 (avatar/faceTracking.ts).
// GPU로 먼저 시도하고 안 되면 CPU로 내려간다
export async function createFaceLandmarker(): Promise<LoadedFaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)
  const create = (delegate: Delegate) =>
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: false,
    })
  try {
    return { landmarker: await create('GPU'), delegate: 'GPU' }
  } catch {
    return { landmarker: await create('CPU'), delegate: 'CPU' }
  }
}
