// FR-A-01/03·FR-M-02/07: synthetic display candidates, not people/clinical measurements.
import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { describe, expect, it } from 'vitest'
import { OBSERVED_LIMB_BINDINGS } from './directionalRig'
import { createHeadRotationRig } from './headOrientationRig'
import { createObservedPoseRig, type PoseRigFrame } from './observedPoseRig'
import { prepareOwnedAvatarPair } from './ownedAvatarPair'

const turn = (n: number) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), n).toArray()
const alignment = () => ({ bone: 'head', cameraReference: turn(0), sceneFromCamera: turn(0) })
function fixture() {
  const model = new Group(),
    shoulder = new Bone(),
    elbow = new Bone(),
    wrist = new Bone(),
    neck = new Bone(),
    head = new Bone()
  shoulder.name = 'upperarm01L'
  elbow.name = 'lowerarm01L'
  wrist.name = 'wristL'
  head.name = 'head'
  elbow.position.y = -0.3
  wrist.position.y = -0.3
  neck.add(head)
  shoulder.add(elbow)
  elbow.add(wrist)
  model.add(shoulder, neck)
  const abort = new AbortController()
  const options = {
    context: { generation: 7, signal: abort.signal },
    bindings: [
      { bone: shoulder.name, anchor: elbow.name },
      { bone: elbow.name, anchor: wrist.name },
    ],
    halfLifeMs: 50,
    maxAgeMs: 250,
    mirror: false,
  }
  return { model, shoulder, elbow, wrist, neck, head, abort, options }
}
function frame(sequence = 1, at = 100, angle = 0.4): PoseRigFrame {
  const image = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
  world[13] = { x: 0.3, y: 0, z: 0 }
  world[15] = { x: 0.3, y: 0, z: -0.3 }
  return {
    generation: 7,
    sequence,
    at,
    result: { landmarks: [image], worldLandmarks: [world], headOrientation: turn(angle) },
  }
}
const rotated = (bone: Bone) => bone.getWorldQuaternion(new Quaternion()).normalize()

describe('copied head display', () => {
  it('allows the owned model to attach to a scene but rejects unsupported outside scale', () => {
    const f = fixture(),
      d = createHeadRotationRig(f.model, { ...f.options, ...alignment() }),
      scene = new Group()
    scene.add(f.model)
    f.model.position.x = 0.75
    d.push({ generation: 7, sequence: 1, at: 100, rotation: turn(0.4) })
    expect(d.render(100, 0).tracked).toBe(1)
    const before = f.head.quaternion.toArray()
    scene.scale.y = 2
    expect(d.render(110, 10).tracked).toBe(0)
    expect(f.head.quaternion.toArray()).toEqual(before)
    d.dispose()
  })
  it('uses owned quaternion without face points and copies input/alignment', () => {
    const f = fixture(),
      a = alignment(),
      rotation = turn(0.5)
    a.cameraReference = turn(0.1)
    const d = createHeadRotationRig(f.model, { ...f.options, ...a })
    a.cameraReference.fill(0)
    expect(d.push({ generation: 7, sequence: 1, at: 100, rotation })).toBe(true)
    rotation.fill(0)
    expect(d.render(100, 0).tracked).toBe(1)
    expect(rotated(f.head).angleTo(new Quaternion().fromArray(turn(0.4)))).toBeLessThan(1e-6)
    d.dispose()
  })
  it.each([[0, 0, 0, 0], [0, 0, 0, 2], [NaN, 0, 0, 1], [0, 0, 1], new Array(4)])(
    'revokes malformed copied rotation %j without neutral pose correction',
    (rotation) => {
      const f = fixture(),
        d = createHeadRotationRig(f.model, { ...f.options, ...alignment() })
      d.push({ generation: 7, sequence: 1, at: 100, rotation: turn(0.4) })
      d.render(100, 0)
      const before = f.head.quaternion.toArray()
      expect(d.push({ generation: 7, sequence: 2, at: 110, rotation })).toBe(true)
      expect(d.render(110, 10).tracked).toBe(0)
      expect(f.head.quaternion.toArray()).toEqual(before)
      d.dispose()
    },
  )
})

describe('same-frame observed body and head', () => {
  it('moves both from one stamp and preserves authored lengths, neck and source', () => {
    const f = fixture(),
      d = createObservedPoseRig(f.model, { ...f.options, head: alignment() }),
      input = frame(),
      raw = JSON.stringify(input),
      positions = [f.head, f.shoulder, f.elbow, f.wrist].map((b) => [
        b.position.toArray(),
        b.scale.toArray(),
      ])
    expect(d.observe(input)).toBe(true)
    expect(d.render(100, 0)).toEqual({
      status: 'tracking',
      tracked: 2,
      total: 2,
      head: { status: 'tracking', tracked: 1, total: 1 },
    })
    expect(rotated(f.head).angleTo(new Quaternion().fromArray(turn(0.4)))).toBeLessThan(1e-6)
    expect(
      f.elbow
        .getWorldPosition(new Vector3())
        .sub(f.shoulder.getWorldPosition(new Vector3()))
        .normalize().x,
    ).toBeCloseTo(1)
    expect(f.neck.quaternion.toArray()).toEqual(turn(0))
    expect(
      [f.head, f.shoulder, f.elbow, f.wrist].map((b) => [b.position.toArray(), b.scale.toArray()]),
    ).toEqual(positions)
    expect(JSON.stringify(input)).toBe(raw)
    d.dispose()
  })
  it('keeps the pose-only API unchanged and never reads its optional face', () => {
    const f = fixture(),
      d = createObservedPoseRig(f.model, f.options),
      v = frame()
    Object.defineProperty(v.result, 'headOrientation', {
      get() {
        throw new Error('Do not read')
      },
    })
    expect(d.observe(v)).toBe(true)
    expect(d.render(100, 0)).toEqual({ status: 'tracking', tracked: 2, total: 2 })
    expect(f.head.quaternion.toArray()).toEqual(turn(0))
    d.dispose()
  })
  it.each(['absent', 'null', 'invalid'])(
    'keeps body moving when face is %s, but freezes head',
    (kind) => {
      const f = fixture(),
        d = createObservedPoseRig(f.model, { ...f.options, head: alignment() })
      d.observe(frame())
      d.render(100, 0)
      const before = f.head.quaternion.toArray(),
        v = frame(2, 110)
      const result = { ...v.result, headOrientation: kind === 'invalid' ? [0, 0, 0, 2] : null }
      if (kind === 'absent') delete (result as { headOrientation?: unknown }).headOrientation
      expect(d.observe({ ...v, result })).toBe(true)
      expect(d.render(110, 10).tracked).toBe(2)
      expect(d.render(110, 0).head?.tracked).toBe(0)
      expect(f.head.quaternion.toArray()).toEqual(before)
      d.dispose()
    },
  )
  it.each(['empty', 'multiple', 'short', 'nonfinite'])(
    'does not bind a good face to %s body',
    (kind) => {
      const f = fixture(),
        d = createObservedPoseRig(f.model, { ...f.options, head: alignment() })
      d.observe(frame())
      d.render(100, 0)
      const before = f.head.quaternion.toArray(),
        v = frame(2, 110),
        points = v.result.landmarks[0]
      const result = {
        ...v.result,
        landmarks:
          kind === 'empty'
            ? []
            : kind === 'multiple'
              ? [points, points]
              : kind === 'short'
                ? [points.slice(0, 20)]
                : [[{ ...points[0], z: NaN }, ...points.slice(1)]],
      }
      expect(d.observe({ ...v, result })).toBe(true)
      expect(d.render(110, 10).head?.tracked).toBe(0)
      expect(f.head.quaternion.toArray()).toEqual(before)
      d.dispose()
    },
  )
  it('rejects wrong, repeated, equal-time and expired stamps before payload access', () => {
    const f = fixture(),
      d = createObservedPoseRig(f.model, { ...f.options, head: alignment() })
    d.observe(frame())
    d.render(100, 0)
    for (const stamp of [
      { generation: 8, sequence: 2, at: 110 },
      { generation: 7, sequence: 1, at: 110 },
      { generation: 7, sequence: 2, at: 100 },
    ])
      expect(
        d.observe({
          ...stamp,
          get result(): never {
            throw new Error('Do not read')
          },
        }),
      ).toBe(false)
    expect(d.render(351, 0).head?.tracked).toBe(0)
    expect(d.observe(frame(2, 100))).toBe(false)
    d.dispose()
  })
  it('newer reentrant payload wins in both drivers', () => {
    const f = fixture(),
      d = createObservedPoseRig(f.model, { ...f.options, head: alignment() })
    const old = frame(),
      newer = frame(2, 110, 0.8)
    expect(
      d.observe({
        ...old,
        get result() {
          expect(d.observe(newer)).toBe(true)
          return old.result
        },
      }),
    ).toBe(false)
    const state = d.render(110, 0)
    expect(state.tracked).toBe(2)
    expect(state.head?.tracked).toBe(1)
    expect(rotated(f.head).angleTo(new Quaternion().fromArray(turn(0.8)))).toBeLessThan(1e-6)
    d.dispose()
  })
  it.each(['abort', 'throw'])('closes both on %s during candidate access', (kind) => {
    const f = fixture(),
      d = createObservedPoseRig(f.model, { ...f.options, head: alignment() })
    const v = frame()
    Object.defineProperty(v.result, 'headOrientation', {
      get() {
        if (kind === 'abort') f.abort.abort()
        else throw new Error('PRIVATE_DATA')
        return turn(0.4)
      },
    })
    expect(d.observe(v)).toBe(false)
    expect(d.render(100, 0).status).toBe('closed')
    expect(d.render(100, 0).head?.status).toBe('closed')
    expect(f.head.quaternion.toArray()).toEqual(turn(0))
    d.dispose()
  })
  it('rejects invalid head preparation without leaving body active', () => {
    const f = fixture()
    expect(() =>
      createObservedPoseRig(f.model, { ...f.options, head: { ...alignment(), bone: 'missing' } }),
    ).toThrow('Invalid observed pose rig')
    f.abort.abort()
  })
  it('rejects a limb name as the head instead of giving two drivers the same bone', () => {
    const f = fixture()
    expect(() =>
      createObservedPoseRig(f.model, {
        ...f.options,
        head: { ...alignment(), bone: 'upperarm01L' },
      }),
    ).toThrow('Invalid observed pose rig')
    f.abort.abort()
  })
})

function source(boundHead = true) {
  const model = new Group(),
    names = [...new Set(OBSERVED_LIMB_BINDINGS.flatMap((v) => [v.bone, v.anchor]))],
    bones = [...names, 'head'].map((name) => {
      const b = new Bone()
      b.name = name
      return b
    })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 1, 2, 3], 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([0.4, 0.3, 0.2, 0.1], 4))
  geometry.setAttribute('joints_1', new Uint16BufferAttribute([4, 5, 6, 7], 4))
  geometry.setAttribute('weights_1', new Float32BufferAttribute([0.1, 0.05, 0.03, 0.02], 4))
  const material = new MeshStandardMaterial(),
    mesh = new SkinnedMesh(geometry, material)
  for (const b of bones) mesh.add(b)
  for (const v of OBSERVED_LIMB_BINDINGS) {
    const bone = bones.find((b) => b.name === v.bone),
      anchor = bones.find((b) => b.name === v.anchor)
    if (!bone || !anchor) throw new Error('Invalid fixture')
    bone.add(anchor)
    anchor.position.y = -0.3
  }
  mesh.bind(new Skeleton(boundHead ? bones : bones.slice(0, -1)))
  model.add(mesh)
  let disposed = 0
  geometry.addEventListener('dispose', () => {
    disposed++
  })
  return { model, released: () => disposed }
}
describe('owned pair with explicit head alignment', () => {
  it('snapshots alignment before loader waits and leaves comparison/source untouched', async () => {
    const f = source(),
      a = alignment()
    let release: (model: Group) => void = () => {}
    const loaded = new Promise<Group>((r) => {
      release = r
    })
    const pairPending = prepareOwnedAvatarPair(
      { generation: 7, signal: new AbortController().signal },
      { load: () => loaded, mirror: false, halfLifeMs: 50, maxAgeMs: 250, head: a },
    )
    a.cameraReference.fill(0)
    a.bone = 'missing'
    release(f.model)
    const pair = await pairPending,
      models = pair.models
    expect(models).not.toBeNull()
    if (!models) throw new Error('Expected owned models')
    pair.observe(frame())
    expect(pair.render(100, 0).head?.tracked).toBe(1)
    expect((models[0].getObjectByName('head') as Bone).quaternion.toArray()).toEqual(turn(0))
    expect((f.model.getObjectByName('head') as Bone).quaternion.toArray()).toEqual(turn(0))
    pair.dispose()
    pair.dispose()
    expect(f.released()).toBe(1)
    expect(pair.render(110, 0).head?.status).toBe('closed')
  })
  it('rejects an unbound head and releases the owned source exactly once', async () => {
    const f = source(false)
    await expect(
      prepareOwnedAvatarPair(
        { generation: 7, signal: new AbortController().signal },
        { load: () => f.model, mirror: false, halfLifeMs: 50, maxAgeMs: 250, head: alignment() },
      ),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(f.released()).toBe(1)
  })
  it('rejects duplicate bound-name candidates and releases partial copies/source', async () => {
    const f = source(),
      duplicate = new Bone()
    duplicate.name = 'head'
    f.model.add(duplicate)
    await expect(
      prepareOwnedAvatarPair(
        { generation: 7, signal: new AbortController().signal },
        { load: () => f.model, mirror: false, halfLifeMs: 50, maxAgeMs: 250, head: alignment() },
      ),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(f.released()).toBe(1)
  })
})
