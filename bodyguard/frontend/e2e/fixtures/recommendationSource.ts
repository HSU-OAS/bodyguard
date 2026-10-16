// FR-S-06/FR-M-07: mathematical camera/Worker/input fixture only, never physical capture.
import type { ResourceContext } from '../../src/coaching/resources'

declare global {
  interface Window {
    recommendationFixture: {
      mode: 'all' | 'upper' | 'occluded' | 'multiple' | 'empty'
      paused: boolean
      delay: boolean
      release?: () => void
      cameras: number
      stops: number
      workers: number
      workerStops: number
    }
  }
}
window.recommendationFixture ??= {
  mode: 'all',
  paused: false,
  delay: false,
  cameras: 0,
  stops: 0,
  workers: 0,
  workerStops: 0,
}
export async function openCamera() {
  const f = window.recommendationFixture
  f.cameras++
  if (f.delay) {
    await new Promise<void>((resolve) => {
      f.release = resolve
    })
    f.release = undefined
    f.delay = false
  }
  return { getVideoTracks: () => [], getTracks: () => [] } as unknown as MediaStream
}
export function closeCamera() {
  window.recommendationFixture.stops++
}
export function cameraErrorKind() {
  return 'unknown' as const
}
export async function capturePreparationFrame() {
  return { close() {} } as ImageBitmap
}
export async function createWorkerPoseInference() {
  const f = window.recommendationFixture
  f.workers++
  return {
    async detect() {
      return { close() {} }
    },
    dispose() {
      f.workerStops++
    },
  }
}
export function createVideoPoseSource(context: ResourceContext) {
  let closed = false,
    sequence = 0
  return {
    async read() {
      await new Promise((resolve) => setTimeout(resolve, 20))
      const f = window.recommendationFixture
      if (closed || context.signal.aborted || f.paused) return null
      const points = Array.from({ length: 33 }, (_, i) => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility:
          (f.mode === 'upper' && [13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(i)) ||
          (f.mode === 'occluded' && i === 7)
            ? 0
            : 1,
      }))
      return {
        generation: context.generation,
        sequence: ++sequence,
        at: performance.now(),
        result: {
          landmarks: f.mode === 'empty' ? [] : f.mode === 'multiple' ? [points, points] : [points],
          worldLandmarks: [],
        },
      }
    },
    dispose() {
      closed = true
    },
  }
}
