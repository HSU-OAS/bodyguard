// FR-A-01/03: synthetic camera-pitched upright bodies. Display calibration only, not posture accuracy.
import { Bone, Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  createObservedPoseRig,
  MAX_UPRIGHT_TILT_DEG,
  type PoseRigFrame,
  UPRIGHT_SAMPLES,
} from './observedPoseRig'
import { OBSERVED_TRUNK_BINDING } from './observedTrunk'

const deg = (radians: number) => (radians * 180) / Math.PI
const UP = new Vector3(0, 1, 0)

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
  const upper = named('upperarm01L', spine, 0.2, 0.45)
  const lower = named('lowerarm01L', upper, 0, -0.3)
  const wrist = named('wristL', lower, 0, -0.3)
  const abort = new AbortController()
  const adapter = createObservedPoseRig(model, {
    context: { generation: 3, signal: abort.signal },
    bindings: [
      OBSERVED_TRUNK_BINDING,
      { bone: 'upperarm01L', anchor: 'lowerarm01L' },
      { bone: 'lowerarm01L', anchor: 'wristL' },
    ],
    halfLifeMs: 50,
    maxAgeMs: 1000,
    mirror: false,
  })
  const axis = (a: Bone, b: Bone) => {
    model.updateWorldMatrix(true, true)
    return b.getWorldPosition(new Vector3()).sub(a.getWorldPosition(new Vector3())).normalize()
  }
  return { adapter, abort, trunk: () => axis(spine, neck), forearm: () => axis(lower, wrist) }
}

/** Upright person (MediaPipe world: y down, smaller z = closer), rigidly pitched by the camera so
 * the top of the body leans `pitchDeg` toward the lens. `armForwardDeg` raises the left arm. */
function frame(
  sequence: number,
  pitchDeg: number,
  armForwardDeg = 0,
  hipsVisible = true,
): PoseRigFrame {
  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
  const arm = (armForwardDeg * Math.PI) / 180
  const place = (index: number, x: number, y: number, z = 0) => {
    world[index] = { x, y, z }
  }
  place(23, 0.1, 0)
  place(24, -0.1, 0)
  place(11, 0.2, -0.5)
  place(12, -0.2, -0.5)
  // Left arm hangs (or swings forward toward the camera) from the shoulder.
  place(13, 0.2, -0.5 + 0.3 * Math.cos(arm), -0.3 * Math.sin(arm))
  place(15, 0.2, -0.5 + 0.6 * Math.cos(arm), -0.6 * Math.sin(arm))
  const p = (pitchDeg * Math.PI) / 180
  const pitched = world.map(({ x, y, z }) => ({
    x,
    y: y * Math.cos(p) - z * Math.sin(p),
    z: y * Math.sin(p) + z * Math.cos(p),
  }))
  const image = Array.from({ length: 33 }, (_, index) => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: !hipsVisible && (index === 23 || index === 24) ? 0.1 : 1,
  }))
  return {
    generation: 3,
    sequence,
    at: sequence * 33,
    result: { landmarks: [image], worldLandmarks: [pitched] },
  }
}

function feed(
  h: ReturnType<typeof setup>,
  from: number,
  count: number,
  ...args: [number, number?, boolean?]
) {
  for (let sequence = from; sequence < from + count; sequence++) {
    expect(h.adapter.observe(frame(sequence, ...args))).toBe(true)
    h.adapter.render(sequence * 33, 1000)
  }
  return from + count
}

describe('upright calibration of the observed pose rig', () => {
  it('reproduces the reported hunch: an upright body seen by a pitched camera leans the avatar', () => {
    const h = setup()
    feed(h, 1, 3, 14)
    expect(deg(h.trunk().angleTo(UP))).toBeCloseTo(14, 0)
    expect(h.trunk().z).toBeGreaterThan(0)
    expect(h.adapter.getUprightCalibration()).toBe('none')
    h.adapter.dispose()
  })

  it('removes the shared camera tilt from trunk and limbs after an upright calibration', () => {
    const h = setup()
    let next = feed(h, 1, 2, 14)
    expect(h.adapter.calibrateUpright()).toBe(true)
    expect(h.adapter.getUprightCalibration()).toBe('pending')
    next = feed(h, next, UPRIGHT_SAMPLES, 14)
    expect(h.adapter.getUprightCalibration()).toBe('applied')
    feed(h, next, 2, 14)
    expect(deg(h.trunk().angleTo(UP))).toBeLessThan(0.5)
    expect(deg(h.forearm().angleTo(new Vector3(0, -1, 0)))).toBeLessThan(0.5)
    h.adapter.dispose()
  })

  it('keeps real movement after calibration instead of freezing it to the calibrated pose', () => {
    const h = setup()
    let next = feed(h, 1, 1, 14)
    h.adapter.calibrateUpright()
    next = feed(h, next, UPRIGHT_SAMPLES, 14)
    feed(h, next, 2, 14, 90)
    // Arm raised straight forward toward the camera (+z in avatar space), not tilted by 14°.
    expect(deg(h.forearm().angleTo(new Vector3(0, 0, 1)))).toBeLessThan(0.5)
    h.adapter.dispose()
  })

  it('refuses a calibration taken while clearly not upright and keeps the earlier correction', () => {
    const h = setup()
    let next = feed(h, 1, 1, 10)
    h.adapter.calibrateUpright()
    next = feed(h, next, UPRIGHT_SAMPLES, 10)
    expect(h.adapter.getUprightCalibration()).toBe('applied')
    h.adapter.calibrateUpright()
    next = feed(h, next, UPRIGHT_SAMPLES, MAX_UPRIGHT_TILT_DEG + 15)
    expect(h.adapter.getUprightCalibration()).toBe('rejected')
    feed(h, next, 2, 10)
    expect(deg(h.trunk().angleTo(UP))).toBeLessThan(0.5)
    h.adapter.dispose()
  })

  it('waits for trusted hips and shoulders instead of calibrating from a partial trunk', () => {
    const h = setup()
    let next = feed(h, 1, 1, 14)
    h.adapter.calibrateUpright()
    next = feed(h, next, UPRIGHT_SAMPLES * 2, 14, 0, false)
    expect(h.adapter.getUprightCalibration()).toBe('pending')
    feed(h, next, UPRIGHT_SAMPLES, 14)
    expect(h.adapter.getUprightCalibration()).toBe('applied')
    h.adapter.dispose()
  })

  it('refuses calibration after dispose', () => {
    const h = setup()
    h.adapter.dispose()
    expect(h.adapter.calibrateUpright()).toBe(false)
  })
})
