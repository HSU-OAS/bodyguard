// FR-A-01/03: synthetic bodies for the natural display mode. Display shaping only, not accuracy.
import { Bone, Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { OBSERVED_LIMB_BINDINGS } from './directionalRig'
import { shownFlexion } from './hingeLimits'
import { createObservedPoseRig, type PoseRigFrame, UPRIGHT_SAMPLES } from './observedPoseRig'
import { OBSERVED_TRUNK_BINDING } from './observedTrunk'

const deg = (radians: number) => (radians * 180) / Math.PI
type P = { x: number; y: number; z: number }

function setup() {
  const model = new Group()
  const named = (name: string, parent: Group | Bone, x: number, y: number) => {
    const bone = new Bone()
    bone.name = name
    bone.position.set(x, y, 0)
    parent.add(bone)
    return bone
  }
  const spine = named('spine05', model, 0, 1)
  const neck = named('neck01', spine, 0, 0.5)
  const bones: Record<string, Bone> = {}
  for (const [side, sign] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    const clavicle = named(`clavicle${side}`, spine, 0.02 * sign, 0.45)
    const shoulder = named(`shoulder01${side}`, clavicle, 0.18 * sign, 0)
    const upper = named(`upperarm01${side}`, shoulder, 0, 0)
    const lower = named(`lowerarm01${side}`, upper, 0, -0.3)
    const wrist = named(`wrist${side}`, lower, 0, -0.3)
    Object.assign(bones, {
      [`clavicle${side}`]: clavicle,
      [`shoulder${side}`]: shoulder,
      [`upper${side}`]: upper,
      [`lower${side}`]: lower,
      [`wrist${side}`]: wrist,
    })
  }
  const abort = new AbortController()
  const adapter = createObservedPoseRig(model, {
    context: { generation: 3, signal: abort.signal },
    bindings: [...OBSERVED_LIMB_BINDINGS.slice(0, 4), OBSERVED_TRUNK_BINDING],
    halfLifeMs: 1,
    maxAgeMs: 1000,
    mirror: false,
    natural: true,
    shoulders: true,
    relaxAfterMs: 300,
  })
  const world = (bone: Bone) => {
    model.updateWorldMatrix(true, true)
    return bone.getWorldPosition(new Vector3())
  }
  const axis = (a: Bone, b: Bone) => world(b).sub(world(a)).normalize()
  return {
    adapter,
    bones,
    spine,
    trunk: () => axis(spine, neck),
    side: () => world(bones.shoulderL).sub(world(bones.shoulderR)).normalize(),
    shoulderHeight: () => world(bones.shoulderL).y,
    elbow: () => deg(axis(bones.upperL, bones.lowerL).angleTo(axis(bones.lowerL, bones.wristL))),
    forearm: () => axis(bones.lowerL, bones.wristL),
  }
}

/** Upright person in MediaPipe world space (y down, smaller z closer to the camera). */
function body(edit?: (w: P[], visible: number[]) => void) {
  const w: P[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
  const visible = Array.from({ length: 33 }, () => 1)
  const put = (i: number, x: number, y: number, z = 0) => {
    w[i] = { x, y, z }
  }
  put(23, 0.1, 0)
  put(24, -0.1, 0)
  put(11, 0.2, -0.5)
  put(12, -0.2, -0.5)
  put(7, 0.07, -0.65)
  put(8, -0.07, -0.65)
  put(13, 0.2, -0.2)
  put(15, 0.2, 0.1)
  put(14, -0.2, -0.2)
  put(16, -0.2, 0.1)
  edit?.(w, visible)
  return { w, visible }
}

function frame(sequence: number, at: number, edit?: (w: P[], visible: number[]) => void) {
  const { w, visible } = body(edit)
  return {
    generation: 3,
    sequence,
    at,
    result: {
      landmarks: [visible.map((visibility) => ({ x: 0.5, y: 0.5, z: 0, visibility }))],
      worldLandmarks: [w],
    },
  } satisfies PoseRigFrame
}

function run(
  h: ReturnType<typeof setup>,
  from: number,
  count: number,
  edit?: (w: P[], visible: number[], sequence: number) => void,
) {
  for (let sequence = from; sequence < from + count; sequence++) {
    const at = sequence * 33
    expect(h.adapter.observe(frame(sequence, at, edit && ((w, v) => edit(w, v, sequence))))).toBe(
      true,
    )
    h.adapter.render(at, 33)
  }
  return from + count
}

function calibrated() {
  const h = setup()
  let next = run(h, 1, 2)
  h.adapter.calibrateUpright()
  next = run(h, next, UPRIGHT_SAMPLES + 4)
  expect(h.adapter.getUprightCalibration()).toBe('applied')
  return { h, next }
}

describe('natural display of the observed pose rig', () => {
  it('raises both shoulders on a shrug measured against the upright reference', () => {
    const { h, next } = calibrated()
    const rest = h.shoulderHeight()
    run(h, next, 20, (w) => {
      w[11].y -= 0.05
      w[12].y -= 0.05
    })
    // 5 cm over a 20 cm half shoulder width ≈ 14° of clavicle elevation on an 18 cm clavicle.
    const lift = h.shoulderHeight() - rest
    expect(lift).toBeGreaterThan(0.18 * Math.sin((10 * Math.PI) / 180))
    expect(lift).toBeLessThan(0.18 * Math.sin((18 * Math.PI) / 180))
  })

  it('shows no shrug before an upright reference exists', () => {
    const h = setup()
    run(h, 1, 3)
    const rest = h.shoulderHeight()
    run(h, 4, 10, (w) => {
      w[11].y -= 0.05
      w[12].y -= 0.05
    })
    expect(Math.abs(h.shoulderHeight() - rest)).toBeLessThan(1e-6)
  })

  it('rolls the trunk with the shoulder line, also when the hips are out of frame', () => {
    const { h, next } = calibrated()
    const turn = (30 * Math.PI) / 180
    const rotate = (w: P[], visible: number[]) => {
      for (const i of [11, 12, 13, 14, 15, 16]) {
        const { x, z } = w[i]
        w[i].x = x * Math.cos(turn) - z * Math.sin(turn)
        w[i].z = x * Math.sin(turn) + z * Math.cos(turn)
      }
      visible[23] = visible[24] = 0.1
    }
    const lean = h.trunk().clone()
    run(h, next, 20, rotate)
    // Seen from above, the avatar's side axis turns by the observed 30°.
    const side = h.side()
    expect(Math.abs(deg(Math.atan2(-side.z, side.x)))).toBeCloseTo(30, 0)
    expect(deg(h.trunk().angleTo(lean))).toBeLessThan(0.5)
  })

  it('straightens a small depth-noise elbow bend but keeps a real bend', () => {
    const { h, next } = calibrated()
    const bend = (degrees: number) => (w: P[]) => {
      const r = (degrees * Math.PI) / 180
      w[15] = { x: 0.2, y: -0.2 + 0.3 * Math.cos(r), z: -0.3 * Math.sin(r) }
    }
    let at = run(h, next, 20, bend(30))
    expect(h.elbow()).toBeCloseTo(shownFlexion(30), 0)
    expect(h.elbow()).toBeLessThan(16)
    at = run(h, at, 20, bend(110))
    expect(h.elbow()).toBeCloseTo(110, 0)
    run(h, at, 20, bend(175))
    expect(h.elbow()).toBeCloseTo(150, 0)
  })

  it('steadies a resting forearm but still follows a fast swing', () => {
    const { h, next } = calibrated()
    let at = next
    const jitter = (w: P[], _: number[], sequence: number) => {
      w[15].x += sequence % 2 ? 0.02 : -0.02
    }
    const shown: number[] = []
    for (let i = 0; i < 30; i++) {
      at = run(h, at, 1, jitter)
      shown.push(h.forearm().x)
    }
    const spread = Math.max(...shown.slice(10)) - Math.min(...shown.slice(10))
    // Raw input swings the forearm x by ±0.067 (2 cm over 30 cm).
    expect(spread).toBeLessThan(0.05)
    // Raise the whole arm forward to horizontal: within ~0.3 s the forearm is nearly there.
    run(h, at, 10, (w) => {
      w[13] = { x: 0.2, y: -0.5, z: -0.3 }
      w[15] = { x: 0.2, y: -0.5, z: -0.6 }
    })
    expect(deg(h.forearm().angleTo(new Vector3(0, 0, 1)))).toBeLessThan(10)
  })

  it('eases a limb that left the frame back to rest instead of freezing it mid-motion', () => {
    const { h, next } = calibrated()
    const raised = (w: P[]) => {
      w[13] = { x: 0.5, y: -0.5, z: 0 }
      w[15] = { x: 0.8, y: -0.5, z: 0 }
    }
    let at = run(h, next, 10, raised)
    expect(deg(h.forearm().angleTo(new Vector3(1, 0, 0)))).toBeLessThan(5)
    at = run(h, at, 60, (w, visible) => {
      raised(w)
      visible[13] = visible[15] = 0.1
    })
    expect(deg(h.forearm().angleTo(new Vector3(0, -1, 0)))).toBeLessThan(5)
    h.adapter.dispose()
  })
})
