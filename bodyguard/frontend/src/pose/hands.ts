import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import { GESTURE_MODEL_PATH, WASM_BASE_PATH } from './constants'
import type { Delegate } from './landmarker'

export type LoadedGestureRecognizer = { recognizer: GestureRecognizer; delegate: Delegate }

// 손가락 21점과 제스처(엄지척 등)를 브라우저 안에서 인식한다 (원문 53·54, ADR-0016).
// GPU로 먼저 시도하고 안 되면 CPU로 내려간다
export async function createGestureRecognizer(): Promise<LoadedGestureRecognizer> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH)
  const create = (delegate: Delegate) =>
    GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: GESTURE_MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    })
  try {
    return { recognizer: await create('GPU'), delegate: 'GPU' }
  } catch {
    return { recognizer: await create('CPU'), delegate: 'CPU' }
  }
}
