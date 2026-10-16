// FR-A-01/03: private positive display stimulus; no physical camera/SDK or correct exercise.
import type { PreparationState } from '../../src/pose/cameraPreparation'

declare global {
  interface Window {
    workspaceAvatarFixture: {
      angle: number
      headAngle: number
      handBend: number
      details: boolean
      empty: boolean
      starts: number
      stops: number
      reads: number
    }
  }
}
window.workspaceAvatarFixture = {
  angle: 0,
  headAngle: 0,
  handBend: 0,
  details: true,
  empty: false,
  starts: 0,
  stops: 0,
  reads: 0,
}
export function createCameraPreparation(options: {
  allowed(): boolean
  onState(state: PreparationState): void
}) {
  let state: PreparationState = { phase: 'idle' },
    generation = 0,
    sequence = 0
  const publish = (next: PreparationState) => {
    state = next
    options.onState(next)
  }
  const stop = async () => {
    window.workspaceAvatarFixture.stops++
    publish({ phase: 'stopping' })
    publish({ phase: 'idle' })
  }
  return Object.freeze({
    get state() {
      return state
    },
    start: async () => {
      if (options.allowed()) {
        generation++
        sequence = 0
        window.workspaceAvatarFixture.starts++
        publish({ phase: 'preparing' })
        publish({ phase: 'ready' })
      }
    },
    observe: () => {
      if (options.allowed()) publish({ phase: 'observing' })
    },
    stop,
    close: stop,
    takeFrame() {
      if (state.phase !== 'observing' || !options.allowed()) return null
      const f = window.workspaceAvatarFixture
      f.reads++
      const points = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.25,
        z: 0,
        visibility: 0.9,
        presence: 0.9,
      }))
      const locations: Record<number, number[]> = {
        0: [0.5, 0.12],
        7: [0.46, 0.12],
        8: [0.54, 0.12],
        11: [0.4, 0.3],
        12: [0.6, 0.3],
        13: [0.3, 0.42],
        14: [0.7, 0.42],
        15: [0.24, 0.54],
        16: [0.76, 0.54],
        23: [0.44, 0.56],
        24: [0.56, 0.56],
        25: [0.43, 0.74],
        26: [0.57, 0.74],
        27: [0.43, 0.92],
        28: [0.57, 0.92],
      }
      for (const [index, [x, y]] of Object.entries(locations))
        points[Number(index)] = { ...points[Number(index)], x, y }
      const world = points.map((p) => ({ ...p, x: p.x - 0.5, y: p.y - 0.56 }))
      const angle = f.angle,
        c = Math.cos(angle),
        s = Math.sin(angle)
      for (const i of [13, 15]) {
        const x = world[i].x - world[11].x,
          y = world[i].y - world[11].y
        world[i] = { ...world[i], x: world[11].x + x * c - y * s, y: world[11].y + x * s + y * c }
      }
      // Generated palm/finger directions; not captured from a person or an SDK result.
      const hands = (['left', 'right'] as const).map((side) => {
        const hand = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
        for (let digit = 0; digit < 5; digit++) {
          const start = digit * 4 + 1
          hand[start] = { x: (2 - digit) * 0.04, y: -0.1, z: 0 }
          for (let joint = 1; joint <= 3; joint++) {
            const previous = hand[start + joint - 1]
            hand[start + joint] = {
              x: previous.x,
              y: previous.y - 0.03 * Math.cos(f.handBend * joint),
              z: previous.z - 0.03 * Math.sin(f.handBend * joint),
            }
          }
        }
        return { side, landmarks: hand.map(() => ({ x: 0.5, y: 0.5, z: 0 })), worldLandmarks: hand }
      })
      return {
        generation,
        sequence: ++sequence,
        at: performance.now(),
        image: { width: 640, height: 480, imageIsMirrored: false },
        result: {
          landmarks: f.empty ? [] : [points],
          worldLandmarks: f.empty ? [] : [world],
          headOrientation: f.details
            ? [0, 0, Math.sin(f.headAngle / 2), Math.cos(f.headAngle / 2)]
            : null,
          hands: f.details ? hands : [],
        },
      }
    },
  })
}
