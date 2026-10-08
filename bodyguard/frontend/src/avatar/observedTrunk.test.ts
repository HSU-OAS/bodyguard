// FR-A-01/03·FR-M-02/07: generated aggregate direction; no anatomical/clinical claim.
import { Bone, Group, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { Point } from '../posture/landmarks'
import { createObservedPoseRig, type PoseRigFrame } from './observedPoseRig'
import { OBSERVED_TRUNK_BINDING, observedTrunkDirection } from './observedTrunk'

function observation(sequence = 1, at = 100, mirror = false): PoseRigFrame {
  const image: Point[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }))
  const world: Point[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
  world[23] = { x: -0.15, y: 0, z: 0 }
  world[24] = { x: 0.15, y: 0, z: 0 }
  world[11] = { x: (mirror ? -0.2 : 0.2) - 0.2, y: -0.5, z: -0.1 }
  world[12] = { x: (mirror ? -0.2 : 0.2) + 0.2, y: -0.5, z: -0.1 }
  world[13] = { x: world[11].x + 0.3, y: -0.5, z: -0.1 }
  world[15] = { x: world[13].x, y: -0.5, z: -0.4 }
  return { generation: 7, sequence, at, result: { landmarks: [image], worldLandmarks: [world] } }
}
function fixture(mirror = false) {
  const model = new Group(),
    root = new Bone(),
    spine = new Bone(),
    middle = new Bone(),
    neck = new Bone(),
    shoulder = new Bone(),
    elbow = new Bone(),
    wrist = new Bone()
  root.name = 'root'
  spine.name = 'spine05'
  middle.name = 'spine03'
  middle.position.y = 0.2
  neck.name = 'neck01'
  neck.position.y = 0.3
  shoulder.name = 'upperarm01L'
  elbow.name = 'lowerarm01L'
  elbow.position.y = -0.3
  wrist.name = 'wristL'
  wrist.position.y = -0.3
  model.add(root)
  root.add(spine)
  spine.add(middle)
  middle.add(neck, shoulder)
  shoulder.add(elbow)
  elbow.add(wrist)
  const abort = new AbortController()
  const options = {
    context: { generation: 7, signal: abort.signal },
    mirror,
    bindings: [
      { bone: shoulder.name, anchor: elbow.name },
      { bone: elbow.name, anchor: wrist.name },
      OBSERVED_TRUNK_BINDING,
    ],
    halfLifeMs: 50,
    maxAgeMs: 250,
  }
  const adapter = createObservedPoseRig(model, options)
  return { model, root, spine, middle, neck, shoulder, elbow, wrist, abort, adapter, options }
}
function axis(from: Bone, to: Bone) {
  from.updateWorldMatrix(true, true)
  return to.getWorldPosition(new Vector3()).sub(from.getWorldPosition(new Vector3())).normalize()
}

describe('observed aggregate trunk swing', () => {
  it('keeps explicit head world orientation after the observed torso parent moves', () => {
    const f = fixture(),
      head = new Bone()
    f.adapter.dispose()
    head.name = 'head'
    head.position.y = 0.1
    f.neck.add(head)
    const d = createObservedPoseRig(f.model, {
        ...f.options,
        head: { bone: 'head', cameraReference: [0, 0, 0, 1], sceneFromCamera: [0, 0, 0, 1] },
      }),
      rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.4),
      v = observation()
    expect(d.observe({ ...v, result: { ...v.result, headOrientation: rotation.toArray() } })).toBe(
      true,
    )
    expect(d.render(100, 0).head?.tracked).toBe(1)
    expect(head.getWorldQuaternion(new Quaternion()).angleTo(rotation)).toBeLessThan(1e-6)
    expect(axis(f.spine, f.neck).angleTo(new Vector3(0.2, 0.5, 0.1).normalize())).toBeLessThan(1e-6)
    d.dispose()
  })
  it.each([false, true])(
    'maps mirror=%s before limbs without changing authored anatomy',
    (mirror) => {
      const f = fixture(mirror),
        input = observation(1, 100, mirror),
        raw = JSON.stringify(input),
        nodes = [f.root, f.middle, f.neck],
        rest = nodes.map((b) => b.quaternion.toArray()),
        transforms = [f.root, f.spine, f.middle, f.neck, f.shoulder, f.elbow, f.wrist].map((b) => [
          b.position.toArray(),
          b.scale.toArray(),
        ])
      expect(f.adapter.observe(input)).toBe(true)
      expect(f.adapter.render(100, 0)).toEqual({ status: 'tracking', tracked: 3, total: 3 })
      expect(axis(f.spine, f.neck).angleTo(new Vector3(0.2, 0.5, 0.1).normalize())).toBeLessThan(
        1e-6,
      )
      expect(axis(f.shoulder, f.elbow).x).toBeCloseTo(mirror ? -1 : 1)
      expect(axis(f.elbow, f.wrist).z).toBeCloseTo(1)
      expect(nodes.map((b) => b.quaternion.toArray())).toEqual(rest)
      expect(
        [f.root, f.spine, f.middle, f.neck, f.shoulder, f.elbow, f.wrist].map((b) => [
          b.position.toArray(),
          b.scale.toArray(),
        ]),
      ).toEqual(transforms)
      expect(JSON.stringify(input)).toBe(raw)
      expect(f.adapter.getCoverage()?.bones).toContain('spine05')
      f.adapter.dispose()
    },
  )
  it.each([11, 12, 23, 24])('revokes hidden endpoint %s but retains observable arm', (index) => {
    const f = fixture()
    f.adapter.observe(observation())
    f.adapter.render(100, 0)
    const old = f.spine.quaternion.toArray(),
      next = observation(2, 110)
    ;(next.result.landmarks[0] as Point[])[index].x = 2
    expect(f.adapter.observe(next)).toBe(true)
    expect(f.adapter.render(110, 10).tracked).toBe(index === 11 ? 1 : 2)
    expect(f.adapter.getCoverage()?.bones).not.toContain('spine05')
    expect(f.spine.quaternion.toArray()).toEqual(old)
    f.adapter.observe(observation(3, 120))
    expect(f.adapter.render(120, 10).tracked).toBe(3)
    f.adapter.dispose()
  })
  it.each(['multiple', 'none', 'short', 'nan', 'zero'])(
    'omits %s trunk, never reuses the old coverage',
    (kind) => {
      const f = fixture()
      f.adapter.observe(observation())
      f.adapter.render(100, 0)
      const old = f.spine.quaternion.toArray(),
        next = observation(2, 110),
        image = Array.from(next.result.landmarks[0]),
        world = Array.from(next.result.worldLandmarks[0])
      if (kind === 'nan') world[24] = { x: NaN, y: 0, z: 0 }
      if (kind === 'zero') {
        world[11] = { x: -0.2, y: 0, z: 0 }
        world[12] = { x: 0.2, y: 0, z: 0 }
      }
      const result = {
        landmarks:
          kind === 'multiple'
            ? [image, image]
            : kind === 'none'
              ? []
              : kind === 'short'
                ? [image.slice(0, 20)]
                : [image],
        worldLandmarks: [world],
      }
      expect(f.adapter.observe({ ...next, result })).toBe(true)
      f.adapter.render(110, 10)
      expect(f.adapter.getCoverage()?.bones).not.toContain('spine05')
      expect(f.spine.quaternion.toArray()).toEqual(old)
      f.adapter.dispose()
    },
  )
  it('copies before mutation and rejects stale/foreign input before touching raw data', () => {
    const f = fixture(),
      v = observation()
    f.adapter.observe(v)
    ;(v.result.worldLandmarks[0] as Point[])[11].x = 5
    f.adapter.render(100, 0)
    expect(axis(f.spine, f.neck).angleTo(new Vector3(0.2, 0.5, 0.1).normalize())).toBeLessThan(1e-6)
    expect(
      f.adapter.observe({
        generation: 8,
        sequence: 2,
        at: 110,
        get result(): never {
          throw new Error('PRIVATE')
        },
      }),
    ).toBe(false)
    expect(f.adapter.render(351, 0).tracked).toBe(0)
    expect(f.adapter.observe(observation(2, 100))).toBe(false)
    f.abort.abort()
    expect(f.adapter.render(352, 0).status).toBe('closed')
    expect(f.adapter.getCoverage()).toBeNull()
  })
  it('leaves pose-only callers unchanged and rejects wrong trunk anchors', () => {
    const f = fixture()
    const limb = createObservedPoseRig(f.model, {
      ...f.options,
      context: { generation: 8, signal: new AbortController().signal },
      bindings: f.options.bindings.slice(0, 2),
    })
    expect(limb.render(0, 0).total).toBe(2)
    expect(() =>
      createObservedPoseRig(f.model, {
        ...f.options,
        bindings: [{ bone: 'spine05', anchor: 'head' }],
      }),
    ).toThrow('Invalid observed pose rig')
    limb.dispose()
    f.adapter.dispose()
  })
  it('rejects nonfinite/zero/overflow directions and deep-freezes copied conversion', () => {
    const v = observation(),
      image = v.result.landmarks[0],
      world = Array.from(v.result.worldLandmarks[0]),
      converted = observedTrunkDirection(image, world, false)
    expect(Object.isFrozen(converted)).toBe(true)
    expect(Object.isFrozen(converted.spine05)).toBe(true)
    expect(Object.isFrozen(OBSERVED_TRUNK_BINDING)).toBe(true)
    world[11] = { x: Number.MAX_VALUE, y: 0, z: 0 }
    world[12] = { x: Number.MAX_VALUE, y: 0, z: 0 }
    world[23] = { x: -Number.MAX_VALUE, y: 0, z: 0 }
    world[24] = { x: -Number.MAX_VALUE, y: 0, z: 0 }
    expect(observedTrunkDirection(image, world, false)).toEqual({})
  })
})
