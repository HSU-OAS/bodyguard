// FR-S-02/04·FR-M-07: mathematical camera/worker fixture, never real capture/clinical evidence.
import type { ResourceContext } from '../../src/coaching/resources'
import { shrugFrame } from './shrugCandidate'

declare global {
  interface Window {
    shrugWorkspaceFixture: {
      rise: number
      right: number
      headDown: boolean
      head: boolean
      empty: boolean
      paused: boolean
      fail: boolean
      allow: boolean
      delay: boolean
      release?: () => void
      cameras: number
      stops: number
      workers: number
      workerStops: number
    }
  }
}
window.shrugWorkspaceFixture ??= {
  rise: 0,
  right: 0,
  headDown: false,
  head: true,
  empty: false,
  paused: false,
  fail: false,
  allow: true,
  delay: false,
  cameras: 0,
  stops: 0,
  workers: 0,
  workerStops: 0,
}
export async function openCamera() {
  const f = window.shrugWorkspaceFixture
  f.cameras++
  if (f.delay) {
    await new Promise<void>((yes) => {
      f.release = yes
    })
    f.release = undefined
    f.delay = false
  }
  return { getTracks: () => [] } as unknown as MediaStream
}
export function closeCamera() {
  window.shrugWorkspaceFixture.stops++
}
export function cameraErrorKind() {
  return 'unknown' as const
}
export async function createWorkerPoseInference() {
  window.shrugWorkspaceFixture.workers++
  return {
    detect() {
      throw new Error('Fixture source must replace capture')
    },
    dispose() {
      window.shrugWorkspaceFixture.workerStops++
    },
  }
}
export function createVideoPoseSource(context: ResourceContext) {
  let sequence = 0,
    closed = false
  return {
    async read() {
      await new Promise((yes) => setTimeout(yes, 25))
      const f = window.shrugWorkspaceFixture
      if (closed || context.signal.aborted || f.paused) return null
      if (f.fail) throw new Error('Controlled input failure')
      const input = shrugFrame(f.rise, ++sequence, performance.now(), {
          generation: context.generation,
        }),
        points = input.result.landmarks[0]
      points[12].y += (f.rise - f.right) / 480
      if (f.headDown) for (const i of [0, 7, 8]) points[i].y += 40 / 480
      for (const [i, x, y] of [
        [25, 0.42, 0.87],
        [26, 0.58, 0.87],
        [27, 0.42, 0.95],
        [28, 0.58, 0.95],
      ]) {
        points[i].x = x
        points[i].y = y
      }
      return {
        ...input,
        result: {
          landmarks: f.empty ? [] : [points],
          worldLandmarks: f.empty
            ? []
            : [points.map((p) => ({ ...p, x: ((p.x - 0.5) * 640) / 480, y: p.y - 0.8 }))],
          headOrientation: f.head ? [0, 0, 0, 1] : null,
          hands: [],
        },
      }
    },
    dispose() {
      closed = true
    },
  }
}
