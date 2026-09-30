import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { POSE_MODELS, type PoseModel, WASM_BASE_PATH } from './constants'

export type Delegate = 'GPU' | 'CPU'
export type LoadedLandmarker = { landmarker: PoseLandmarker; delegate: Delegate; model: PoseModel }

// FR-M-02 관절 추출은 브라우저 안에서 한다. GPU로 먼저 시도하고 안 되면 CPU로 내려간다
export async function createPoseLandmarker(model: PoseModel): Promise<LoadedLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)
  const create = (delegate: Delegate) =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODELS[model].path, delegate },
      runningMode: 'VIDEO',
      // FR-M-07 복수 검출은 사용하지 않는다. 미검출 인물까지 배제하는지는 실측 대상이다.
      numPoses: 2,
    })
  try {
    return { landmarker: await create('GPU'), delegate: 'GPU', model }
  } catch {
    return { landmarker: await create('CPU'), delegate: 'CPU', model }
  }
}
