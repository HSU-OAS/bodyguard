// Browser-only synthetic source. No camera/SDK/person; never imported by product code.
import type { PreparationState } from '../../src/pose/cameraPreparation'

declare global {
  interface Window {
    referenceFixture: { paused: boolean; invalid: boolean }
  }
}
window.referenceFixture = { paused: false, invalid: false }
export function createCameraPreparation(options: {
  allowed(): boolean
  onState(state: PreparationState): void
}) {
  let state: PreparationState = { phase: 'idle' },
    sequence = 0
  const publish = (next: PreparationState) => {
    state = next
    options.onState(next)
  }
  const stop = async () => publish({ phase: 'idle' })
  return Object.freeze({
    get state() {
      return state
    },
    start: async () => {
      if (options.allowed()) publish({ phase: 'ready' })
    },
    observe: () => {
      if (options.allowed()) publish({ phase: 'observing' })
    },
    stop,
    close: stop,
    takeFrame() {
      if (state.phase !== 'observing' || !options.allowed() || window.referenceFixture.paused)
        return null
      const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.4, z: 0, visibility: 0.9 }))
      points[7].x = 0.4
      points[8].x = 0.6
      points[11] = { ...points[11], x: 0.3, y: 0.6 }
      points[12] = { ...points[12], x: 0.7, y: 0.6 }
      if (window.referenceFixture.invalid) points[11].x = 2
      return {
        generation: 1,
        sequence: ++sequence,
        at: performance.now(),
        image: { width: 640, height: 480, imageIsMirrored: false },
        result: { landmarks: [points], worldLandmarks: [] },
      }
    },
  })
}
