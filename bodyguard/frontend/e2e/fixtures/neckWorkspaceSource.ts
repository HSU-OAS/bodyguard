// FR-S-02/03/04: mathematical source/permission/Worker fixtures only; never a real camera.
import type { ResourceContext } from '../../src/coaching/resources'
import { frame } from './neckCandidate'

declare global {
  interface Window {
    neckWorkspaceFixture: {
      angle: number
      shoulder: number
      empty: boolean
      fail: boolean
      cameras: number
      stops: number
      workers: number
      workerStops: number
      reads: number
      allow: boolean
      delay: boolean
      waiting: boolean
      release?: () => void
    }
  }
}
window.neckWorkspaceFixture ??= {
  angle: 0,
  shoulder: 0,
  empty: false,
  fail: false,
  cameras: 0,
  stops: 0,
  workers: 0,
  workerStops: 0,
  reads: 0,
  allow: true,
  delay: false,
  waiting: false,
}
export async function openCamera() {
  const fixture = window.neckWorkspaceFixture
  fixture.cameras++
  if (fixture.delay) {
    fixture.waiting = true
    await new Promise<void>((resolve) => {
      fixture.release = resolve
    })
    fixture.release = undefined
    fixture.waiting = false
  }
  return { getTracks: () => [] } as unknown as MediaStream
}
export function closeCamera() {
  window.neckWorkspaceFixture.stops++
}
export function cameraErrorKind() {
  return 'unknown' as const
}
export async function createWorkerPoseInference() {
  window.neckWorkspaceFixture.workers++
  return {
    detect() {
      throw new Error('Fixture source must replace capture')
    },
    dispose() {
      window.neckWorkspaceFixture.workerStops++
    },
  }
}
export function createVideoPoseSource(context: ResourceContext) {
  let sequence = 0,
    closed = false
  return {
    async read() {
      if (closed || context.signal.aborted) return null
      const f = window.neckWorkspaceFixture
      f.reads++
      if (f.fail) throw new Error('Controlled inference failure')
      const input = frame(f.angle, ++sequence, performance.now(), {
        generation: context.generation,
        shoulder: f.shoulder,
      })
      const points = input.result.landmarks[0]
      const locations: Record<number, number[]> = {
        13: [0.3, 0.68],
        14: [0.7, 0.68],
        15: [0.24, 0.78],
        16: [0.76, 0.78],
        23: [0.44, 0.76],
        24: [0.56, 0.76],
        25: [0.43, 0.86],
        26: [0.57, 0.86],
        27: [0.43, 0.96],
        28: [0.57, 0.96],
      }
      for (const [index, [x, y]] of Object.entries(locations))
        points[Number(index)] = { ...points[Number(index)], x, y }
      return {
        ...input,
        result: {
          landmarks: f.empty ? [] : [points],
          worldLandmarks: f.empty
            ? []
            : [points.map((p) => ({ ...p, x: p.x - 0.5, y: p.y - 0.76 }))],
          headOrientation: f.empty ? null : [0, 0, Math.sin(f.angle / 2), Math.cos(f.angle / 2)],
          hands: [],
        },
      }
    },
    async dispose() {
      closed = true
    },
  }
}
