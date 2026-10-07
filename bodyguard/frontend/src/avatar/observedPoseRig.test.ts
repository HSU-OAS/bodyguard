// FR-A-01/03·FR-M-07: synthetic 33-point provider results, not camera/clinical accuracy.
import { Bone, Group, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { Point } from '../posture/landmarks'
import { createObservedPoseRig, type PoseRigFrame } from './observedPoseRig'

function setup(mirror = false) {
  const model = new Group()
  const shoulder = new Bone()
  shoulder.name = 'upperarm01L'
  const elbow = new Bone()
  elbow.name = 'lowerarm01L'
  elbow.position.y = -0.3
  const wrist = new Bone()
  wrist.name = 'wristL'
  wrist.position.y = -0.3
  model.add(shoulder)
  shoulder.add(elbow)
  elbow.add(wrist)
  const abort = new AbortController()
  const adapter = createObservedPoseRig(model, {
    context: { generation: 7, signal: abort.signal },
    bindings: [
      { bone: shoulder.name, anchor: elbow.name },
      { bone: elbow.name, anchor: wrist.name },
    ],
    halfLifeMs: 50,
    maxAgeMs: 250,
    mirror,
  })
  return { adapter, model, shoulder, elbow, wrist, abort }
}
function frame(sequence = 1, at = 100): PoseRigFrame {
  const image = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
  world[13] = { x: 0.3, y: 0, z: 0 }
  world[15] = { x: 0.3, y: 0, z: -0.3 }
  return { generation: 7, sequence, at, result: { landmarks: [image], worldLandmarks: [world] } }
}
function axis(a: Bone, b: Bone) {
  a.updateWorldMatrix(true, true)
  return b.getWorldPosition(new Vector3()).sub(a.getWorldPosition(new Vector3())).normalize()
}

describe('same-result pose rig', () => {
  it('refuses a semantically wrong descendant anchor instead of rotating to the wrong joint', () => {
    const h = setup()
    expect(() =>
      createObservedPoseRig(h.model, {
        context: { generation: 8, signal: new AbortController().signal },
        bindings: [{ bone: 'upperarm01L', anchor: 'wristL' }],
        halfLifeMs: 50,
        maxAgeMs: 250,
        mirror: false,
      }),
    ).toThrow('Invalid observed pose rig')
  })
  it('maps a single result to owned bones without changing source points or bone lengths', () => {
    const h = setup()
    const f = frame()
    const raw = JSON.stringify(f)
    const positions = [
      h.shoulder.position.toArray(),
      h.elbow.position.toArray(),
      h.wrist.position.toArray(),
    ]
    expect(h.adapter.observe(f)).toBe(true)
    expect(h.adapter.render(100, 0)).toEqual({ status: 'tracking', tracked: 2, total: 2 })
    expect(axis(h.shoulder, h.elbow).x).toBeCloseTo(1)
    expect(axis(h.elbow, h.wrist).z).toBeCloseTo(1)
    expect(JSON.stringify(f)).toBe(raw)
    expect([
      h.shoulder.position.toArray(),
      h.elbow.position.toArray(),
      h.wrist.position.toArray(),
    ]).toEqual(positions)
  })
  it('uses explicit mirroring without swapping anatomical bone names', () => {
    const h = setup(true)
    h.adapter.observe(frame())
    h.adapter.render(100, 0)
    expect(axis(h.shoulder, h.elbow).x).toBeCloseTo(-1)
    expect(axis(h.elbow, h.wrist).z).toBeCloseTo(1)
  })
  it.each(['none', 'multiple', 'world-multiple', 'world-missing', 'short-image', 'short-world'])(
    'immediately clears coverage for %s instead of selecting or reusing a person',
    (kind) => {
      const h = setup()
      h.adapter.observe(frame())
      h.adapter.render(100, 0)
      const before = [h.shoulder.quaternion.toArray(), h.elbow.quaternion.toArray()]
      const f = frame(2, 110)
      const image = f.result.landmarks[0]
      const world = f.result.worldLandmarks[0]
      const result = {
        landmarks:
          kind === 'none'
            ? []
            : kind === 'multiple'
              ? [image, image]
              : kind === 'short-image'
                ? [image.slice(0, 20)]
                : [image],
        worldLandmarks:
          kind === 'world-multiple'
            ? [world, world]
            : kind === 'world-missing'
              ? []
              : kind === 'short-world'
                ? [world.slice(0, 20)]
                : [world],
      }
      expect(h.adapter.observe({ ...f, result })).toBe(true)
      expect(h.adapter.render(110, 10)).toEqual({ status: 'untracked', tracked: 0, total: 2 })
      expect([h.shoulder.quaternion.toArray(), h.elbow.quaternion.toArray()]).toEqual(before)
    },
  )
  it('uses only current visible endpoints and resumes only with a new single result', () => {
    const h = setup()
    h.adapter.observe(frame())
    h.adapter.render(100, 0)
    const partial = frame(2, 110)
    ;(partial.result.landmarks[0] as Point[])[15].x = 2
    h.adapter.observe(partial)
    expect(h.adapter.render(110, 10).tracked).toBe(1)
    const occluded = frame(3, 120)
    ;(occluded.result.landmarks[0] as Point[])[13].visibility = 0
    h.adapter.observe(occluded)
    expect(h.adapter.render(120, 10).tracked).toBe(0)
    h.adapter.observe(frame(4, 130))
    expect(h.adapter.render(130, 10).tracked).toBe(2)
  })
  it('omits nonfinite endpoints instead of preserving earlier directions', () => {
    const h = setup()
    h.adapter.observe(frame())
    h.adapter.render(100, 0)
    const f = frame(2, 110)
    ;(f.result.worldLandmarks[0] as Point[])[13].z = NaN
    expect(h.adapter.observe(f)).toBe(true)
    expect(h.adapter.render(110, 10).tracked).toBe(0)
  })
  it('refuses coercible nonnumeric world endpoints', () => {
    const h = setup()
    h.adapter.observe(frame())
    h.adapter.render(100, 0)
    const f = frame(2, 110)
    ;(f.result.worldLandmarks[0] as Point[])[13].x = '0.3' as unknown as number
    expect(h.adapter.observe(f)).toBe(true)
    expect(h.adapter.render(110, 10).tracked).toBe(0)
  })
  it('normalizes finite large directions without squaring overflow or stale-pose reuse', () => {
    const h = setup()
    h.adapter.observe(frame())
    h.adapter.render(100, 0)
    const f = frame(2, 110)
    ;(f.result.worldLandmarks[0] as Point[])[13].x = 1e200
    expect(h.adapter.observe(f)).toBe(true)
    expect(h.adapter.render(110, 10).tracked).toBe(2)
  })
  it('never restamps duplicate, stale or foreign callbacks over a current result', () => {
    const h = setup()
    h.adapter.observe(frame())
    h.adapter.render(100, 0)
    expect(h.adapter.observe({ ...frame(2, 110), generation: 6 })).toBe(false)
    expect(h.adapter.observe(frame(1, 110))).toBe(false)
    expect(h.adapter.observe(frame(2, 99))).toBe(false)
    expect(h.adapter.render(110, 10).tracked).toBe(2)
    expect(h.adapter.render(351, 16).tracked).toBe(0)
    expect(h.adapter.observe(frame(3, 100))).toBe(false)
    expect(h.adapter.render(352, 1).tracked).toBe(0)
  })
  it('copies directions and retains no later-mutable result arrays', () => {
    const h = setup()
    const f = frame()
    h.adapter.observe(f)
    ;(f.result.worldLandmarks[0] as Point[])[13].x = -0.3
    h.adapter.render(100, 0)
    expect(axis(h.shoulder, h.elbow).x).toBeCloseTo(1)
  })
  it('ignores a foreign frame before reading its raw result getter', () => {
    const h = setup()
    const f = frame()
    Object.defineProperty(f, 'result', {
      get: () => {
        throw new Error('PRIVATE_RAW_POSE_FAILURE')
      },
    })
    expect(
      h.adapter.observe({
        generation: 6,
        sequence: 1,
        at: 100,
        get result() {
          return f.result
        },
      }),
    ).toBe(false)
    expect(h.adapter.observe(frame())).toBe(true)
  })
  it('quarantines accessor failures without exposing raw errors or continuing old observation', () => {
    const h = setup()
    h.adapter.observe(frame())
    const f = frame(2, 110)
    Object.defineProperty(f.result, 'worldLandmarks', {
      get: () => {
        throw new Error('PRIVATE_RAW_POSE_FAILURE')
      },
    })
    expect(h.adapter.observe(f)).toBe(false)
    expect(h.adapter.render(110, 10)).toEqual({ status: 'closed', tracked: 0, total: 2 })
    expect(h.adapter.observe(frame(3, 120))).toBe(false)
  })
  it('terminates generation-bound callbacks after abort or idempotent dispose', () => {
    const h = setup()
    h.adapter.observe(frame())
    h.adapter.render(100, 0)
    const before = h.shoulder.quaternion.toArray()
    h.abort.abort()
    h.adapter.dispose()
    h.adapter.dispose()
    expect(h.adapter.observe(frame(2, 110))).toBe(false)
    expect(h.adapter.render(110, 10).status).toBe('closed')
    expect(h.shoulder.quaternion.toArray()).toEqual(before)
    const next = setup()
    expect(next.adapter.observe(frame())).toBe(true)
    expect(h.adapter.observe(frame(3, 120))).toBe(false)
  })
})
