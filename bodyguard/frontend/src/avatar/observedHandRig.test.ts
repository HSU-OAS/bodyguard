// Generated observations, not actual webcam/clinical validation.
import { Bone, Group, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createOwnedPoseFrame } from '../pose/ownedPoseFrame'
import {
  copyHandAlignment,
  createObservedHandRig,
  HAND_RIG_BINDINGS,
  type HandObservation,
} from './observedHandRig'
import { createObservedPoseRig } from './observedPoseRig'

function fixture() {
  const model = new Group(),
    objects = new Map<string, Bone>()
  function bone(name: string, parent: Bone | Group = model) {
    const b = new Bone()
    b.name = name
    b.position.y = 0.04
    parent.add(b)
    objects.set(name, b)
    return b
  }
  for (const suffix of ['L', 'R']) {
    const shoulder = bone(`upperarm01${suffix}`),
      elbow = bone(`lowerarm01${suffix}`, shoulder)
    const forearm = bone(`lowerarm02${suffix}`, elbow),
      wrist = bone(`wrist${suffix}`, forearm)
    for (let digit = 1; digit <= 5; digit++) {
      let parent = digit === 1 ? wrist : bone(`metacarpal${digit - 1}${suffix}`, wrist)
      for (let joint = 1; joint <= 3; joint++)
        parent = bone(`finger${digit}-${joint}${suffix}`, parent)
    }
  }
  const head = bone('head')
  model.updateWorldMatrix(true, true)
  return { model, objects, head }
}
const alignment = () => ({
  cameraReferences: { left: [0, 0, 0, 1], right: [0, 0, 0, 1] },
  sceneFromCamera: [0, 0, 0, 1],
})
function hands(palmAngle = 0, bend = 0): HandObservation[] {
  return (['left', 'right'] as const).map((side) => {
    const palm = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), palmAngle)
    const points = Array.from({ length: 21 }, () => new Vector3())
    for (let digit = 0; digit < 5; digit++) {
      const from = 1 + digit * 4
      points[from].set(digit === 0 ? 0.09 : (2 - digit) * 0.04, digit === 0 ? 0.02 : 0.1, 0)
      for (let joint = 1; joint <= 3; joint++)
        points[from + joint]
          .copy(points[from + joint - 1])
          .add(
            new Vector3(0, 0.03, 0).applyQuaternion(
              new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), bend * joint),
            ),
          )
    }
    return {
      side,
      landmarks: points.map(() => ({ x: 0.5, y: 0.5, z: 0 })),
      worldLandmarks: points.map((point) => {
        const p = point.clone().applyQuaternion(palm)
        return { x: p.x, y: -p.y, z: -p.z }
      }),
    }
  })
}
function setup(mirror = false) {
  const f = fixture(),
    abort = new AbortController()
  const rig = createObservedHandRig(f.model, {
    context: { generation: 1, signal: abort.signal },
    ...alignment(),
    mirror,
    halfLifeMs: 50,
    maxAgeMs: 250,
  })
  return { ...f, abort, rig }
}
const send = (rig: ReturnType<typeof setup>['rig'], value = hands(), sequence = 1, at = 100) =>
  rig.push({ generation: 1, sequence, at, hands: value })
const localTurns = (f: ReturnType<typeof fixture>) =>
  [...f.objects.values()].map((b) => b.quaternion.toArray())
const axis = (b: Bone) =>
  new Vector3(0, 1, 0)
    .applyQuaternion(b.getWorldQuaternion(new Quaternion()).normalize())
    .normalize()
function body(value: HandObservation[], sequence = 1, at = 100) {
  const image = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
  const world = image.map(() => ({ x: 0, y: 0, z: 0 }))
  return {
    generation: 1,
    sequence,
    at,
    result: { landmarks: [image], worldLandmarks: [world], hands: value },
  }
}

describe('owned hand display', () => {
  it('normalizes accepted Float32 quaternion roundoff without changing the supplied calibration', () => {
    const supplied = alignment()
    supplied.sceneFromCamera[3] = 1.000005
    const copied = copyHandAlignment(supplied)
    expect(Math.hypot(...copied.sceneFromCamera)).toBe(1)
    expect(supplied.sceneFromCamera[3]).toBe(1.000005)
  })
  it('moves both wrists and all thirty segments including distal leaves; keeps shape and unrelated bones', () => {
    const f = setup(),
      pose = hands(0.4, 0.3),
      original = JSON.stringify(pose)
    const pq = [...f.objects.values()].map((b) => [b.position.toArray(), b.scale.toArray()])
    expect(send(f.rig, pose)).toBe(true)
    expect(f.rig.render(100, 0)).toEqual({ status: 'tracking', tracked: 32, total: 32 })
    for (const binding of HAND_RIG_BINDINGS) {
      const h = pose[binding.side === 'left' ? 0 : 1],
        a = h.worldLandmarks[binding.from],
        b = h.worldLandmarks[binding.to]
      const expected = new Vector3(b.x - a.x, -(b.y - a.y), -(b.z - a.z)).normalize()
      expect(axis(f.objects.get(binding.bone) as Bone).distanceTo(expected)).toBeLessThan(1e-6)
    }
    expect(
      f.objects
        .get('wristL')
        ?.quaternion.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.4)),
    ).toBeLessThan(1e-6)
    expect([...f.objects.values()].map((b) => [b.position.toArray(), b.scale.toArray()])).toEqual(
      pq,
    )
    expect(f.head.quaternion.toArray()).toEqual([0, 0, 0, 1])
    expect(JSON.stringify(pose)).toBe(original)
  })
  it('keeps anatomical names while explicitly mirroring palm roll and directions', () => {
    const f = setup(true)
    send(f.rig, hands(0.4, 0.3))
    f.rig.render(100, 0)
    expect(
      f.objects
        .get('wristL')
        ?.quaternion.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -0.4)),
    ).toBeLessThan(1e-6)
    expect(axis(f.objects.get('finger1-3L') as Bone).z).toBeGreaterThan(0)
  })
  it('copies alignment and input without automatically sampling neutral', () => {
    const f = fixture(),
      supplied = alignment()
    const rig = createObservedHandRig(f.model, {
      ...supplied,
      context: { generation: 1, signal: new AbortController().signal },
      mirror: false,
      halfLifeMs: 50,
      maxAgeMs: 250,
    })
    supplied.cameraReferences.left.fill(0)
    supplied.sceneFromCamera.fill(0)
    const value = hands(0.4, 0.3)
    send(rig, value)
    value[0].worldLandmarks.forEach((p) => {
      p.x = 0
      p.y = 0
      p.z = 0
    })
    expect(rig.render(100, 0).tracked).toBe(32)
    expect(
      f.objects
        .get('wristL')
        ?.quaternion.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.4)),
    ).toBeLessThan(1e-6)
  })
  it.each(['missing', 'duplicate', 'multiple', 'short', 'palm-crop', 'degenerate', 'nonfinite'])(
    'revokes new %s without resetting correct-looking hands',
    (kind) => {
      const f = setup()
      send(f.rig, hands(0.4, 0.3))
      f.rig.render(100, 0)
      const before = localTurns(f),
        value = hands()
      if (kind === 'missing') value.length = 0
      if (kind === 'duplicate') value[1] = value[0]
      if (kind === 'multiple') value.push(value[0])
      if (kind === 'short')
        value.forEach((h) => {
          ;(h.worldLandmarks as unknown[]).length = 20
        })
      if (kind === 'palm-crop')
        value.forEach((h) => {
          h.landmarks[0].x = 0
        })
      if (kind === 'degenerate')
        value.forEach((h) => {
          h.worldLandmarks.forEach((p) => {
            p.x = p.y = p.z = 0
          })
        })
      if (kind === 'nonfinite')
        value.forEach((h) => {
          h.worldLandmarks[0].x = NaN
        })
      expect(send(f.rig, value, 2, 110)).toBe(true)
      expect(f.rig.render(110, 10).tracked).toBe(0)
      expect(localTurns(f)).toEqual(before)
      send(f.rig, hands(), 3, 120)
      expect(f.rig.render(120, 10).tracked).toBe(32)
    },
  )
  it('keeps visible fingers only; clipped distal tip clears that single leaf', () => {
    const f = setup(),
      value = hands()
    value[0].landmarks[4].x = 2
    send(f.rig, value)
    expect(f.rig.render(100, 0)).toEqual({ status: 'partial', tracked: 31, total: 32 })
    expect(f.objects.get('finger1-3L')?.quaternion.toArray()).toEqual([0, 0, 0, 1])
  })
  it('does not read foreign/duplicate/reversed/stale payloads and does not restamp', () => {
    const f = setup()
    send(f.rig)
    f.rig.render(100, 0)
    const noRead = {
      get hands(): never {
        throw new Error('PRIVATE_HANDS')
      },
    }
    for (const stamp of [
      { generation: 2, sequence: 2, at: 110 },
      { generation: 1, sequence: 1, at: 110 },
      { generation: 1, sequence: 2, at: 100 },
    ])
      expect(
        f.rig.push(Object.defineProperties({ ...stamp }, Object.getOwnPropertyDescriptors(noRead))),
      ).toBe(false)
    expect(f.rig.render(351, 16).tracked).toBe(0)
    expect(send(f.rig, hands(), 2, 100)).toBe(false)
    expect(send(f.rig, hands(), 2, 400)).toBe(true)
  })
  it('reserves before external getter reentry so older input cannot replace newer hands', () => {
    const f = setup(),
      newest = hands(0.6, 0.4)
    expect(
      f.rig.push({
        generation: 1,
        sequence: 1,
        at: 100,
        get hands() {
          send(f.rig, newest, 2, 110)
          return hands()
        },
      }),
    ).toBe(false)
    expect(f.rig.render(110, 0).tracked).toBe(32)
    expect(
      f.objects
        .get('wristL')
        ?.quaternion.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.6)),
    ).toBeLessThan(1e-6)
  })
  it('aborts or fails external getter reads without exposing points or changing bones', () => {
    for (const fail of [false, true]) {
      const f = setup(),
        before = localTurns(f)
      expect(
        f.rig.push({
          generation: 1,
          sequence: 1,
          at: 100,
          get hands(): never {
            if (!fail) f.abort.abort()
            throw new Error('PRIVATE_HANDS')
          },
        }),
      ).toBe(false)
      expect(f.rig.render(100, 0).status).toBe('closed')
      expect(localTurns(f)).toEqual(before)
    }
  })
  it('freezes closed/expired observations; supports explicit half-life across frame rates', () => {
    const a = setup(),
      b = setup()
    for (const f of [a, b]) {
      send(f.rig)
      f.rig.render(100, 0)
      send(f.rig, hands(0.8, 0.4), 2, 110)
    }
    a.rig.render(160, 50)
    b.rig.render(135, 25)
    b.rig.render(160, 25)
    expect(
      a.objects
        .get('wristL')
        ?.quaternion.angleTo(b.objects.get('wristL')?.quaternion as Quaternion),
    ).toBeLessThan(1e-6)
    const before = localTurns(a)
    expect(a.rig.render(361, 16).tracked).toBe(0)
    expect(localTurns(a)).toEqual(before)
    a.abort.abort()
    a.rig.dispose()
    expect(send(a.rig, hands(), 3, 400)).toBe(false)
  })
  it('refuses invalid calibration, duplicate/missing/wrong hierarchy, nonuniform scale and later reparenting', () => {
    expect(() => copyHandAlignment({ ...alignment(), sceneFromCamera: [0, 1] })).toThrow(
      'Invalid hand avatar rig',
    )
    for (const change of ['missing', 'duplicate', 'parent', 'scale']) {
      const f = fixture(),
        bone = f.objects.get('finger1-3L') as Bone
      if (change === 'missing') bone.name = 'other'
      if (change === 'duplicate') {
        const dup = new Bone()
        dup.name = bone.name
        f.model.add(dup)
      }
      if (change === 'parent') f.model.add(bone)
      if (change === 'scale') f.model.scale.y = 2
      expect(() =>
        createObservedHandRig(f.model, {
          ...alignment(),
          context: { generation: 1, signal: new AbortController().signal },
          mirror: false,
          halfLifeMs: 50,
          maxAgeMs: 250,
        }),
      ).toThrow('Invalid hand avatar rig')
    }
    const f = setup()
    send(f.rig)
    f.model.add(f.objects.get('finger1-3L') as Bone)
    expect(f.rig.render(100, 0).tracked).toBe(0)
  })
  it('permits owned scene attachment and compensates later valid parent rotation', () => {
    const f = setup(),
      external = new Group()
    external.add(f.model)
    external.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.4)
    send(f.rig, hands(0.7, 0.3))
    expect(f.rig.render(100, 0).tracked).toBe(32)
    expect(
      (f.objects.get('wristL') as Bone)
        .getWorldQuaternion(new Quaternion())
        .angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.7)),
    ).toBeLessThan(1e-6)
  })
  it('shares one original body/head/hand stamp and rejects incomplete body without hand success', () => {
    const f = fixture(),
      abort = new AbortController()
    const rig = createObservedPoseRig(f.model, {
      context: { generation: 1, signal: abort.signal },
      bindings: [{ bone: 'upperarm01L', anchor: 'lowerarm01L' }],
      ...{ hands: alignment() },
      head: { bone: 'head', cameraReference: [0, 0, 0, 1], sceneFromCamera: [0, 0, 0, 1] },
      mirror: false,
      halfLifeMs: 50,
      maxAgeMs: 250,
    })
    expect(
      rig.observe({
        ...body(hands()),
        result: { ...body(hands()).result, headOrientation: [0, 0, 0, 1] },
      }),
    ).toBe(true)
    expect(rig.render(100, 0).hands?.tracked).toBe(32)
    const next = body(hands(), 2, 110)
    next.result.landmarks.push(next.result.landmarks[0])
    expect(rig.observe(next)).toBe(true)
    expect(rig.render(110, 10).hands?.tracked).toBe(0)
    expect(rig.render(110, 0).head?.tracked).toBe(0)
    abort.abort()
    expect(rig.render(120, 10).hands?.status).toBe('closed')
  })
  it('copies optional hands across the owned result boundary and closes native result exactly once', async () => {
    let closed = 0,
      reads = 0
    const value = hands(),
      f = body(value),
      abort = new AbortController()
    const source = createOwnedPoseFrame(
      { generation: 1, signal: abort.signal },
      {
        capture: () => ({ generation: 1, sequence: 1, at: 100, input: {} }),
        detect: () => ({
          ...f.result,
          get hands() {
            reads++
            return value
          },
          close() {
            closed++
          },
        }),
      },
    )
    const copied = await source.read()
    value[0].worldLandmarks[0].x = 99
    expect(copied?.result.hands?.[0].worldLandmarks[0].x).toBe(0)
    expect(Object.isFrozen(copied?.result.hands?.[0].worldLandmarks)).toBe(true)
    expect([closed, reads]).toEqual([1, 1])
    await source.dispose()
  })
  it('uses explicit camera reference and scene basis without inventing finger twist', () => {
    const f = fixture(),
      basis = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.5)
    const leaf = f.objects.get('finger1-3L') as Bone,
      authoredTwist = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.2)
    leaf.quaternion.copy(authoredTwist)
    const rig = createObservedHandRig(f.model, {
      ...alignment(),
      sceneFromCamera: basis.toArray(),
      context: { generation: 1, signal: new AbortController().signal },
      mirror: false,
      halfLifeMs: 50,
      maxAgeMs: 250,
    })
    const value = hands(0.4, 0.3)
    send(rig, value)
    rig.render(100, 0)
    const wrist = f.objects.get('wristL') as Bone
    const expected = basis
      .clone()
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.4))
      .multiply(basis.clone().invert())
    expect(wrist.quaternion.angleTo(expected)).toBeLessThan(1e-6)
    const h = value[0],
      a = h.worldLandmarks[3],
      b = h.worldLandmarks[4]
    const world = new Vector3(b.x - a.x, -(b.y - a.y), -(b.z - a.z))
      .normalize()
      .applyQuaternion(basis)
    expect(axis(leaf).distanceTo(world)).toBeLessThan(1e-6)
    const local = world
      .clone()
      .applyQuaternion((leaf.parent as Bone).getWorldQuaternion(new Quaternion()).invert())
    const target = new Quaternion()
      .setFromUnitVectors(new Vector3(0, 1, 0), local)
      .multiply(authoredTwist)
    expect(leaf.quaternion.angleTo(target)).toBeLessThan(1e-6)
  })
  it('keeps the complete body/head/hands update atomic when a hand getter reenters', () => {
    const f = fixture(),
      rig = createObservedPoseRig(f.model, {
        context: { generation: 1, signal: new AbortController().signal },
        bindings: [{ bone: 'upperarm01L', anchor: 'lowerarm01L' }],
        hands: alignment(),
        head: { bone: 'head', cameraReference: [0, 0, 0, 1], sceneFromCamera: [0, 0, 0, 1] },
        mirror: false,
        halfLifeMs: 50,
        maxAgeMs: 250,
      })
    const newer = body(hands(0.6, 0.3), 2, 110),
      older = body(hands(), 1, 100)
    Object.defineProperty(older.result, 'hands', {
      get: () => {
        expect(rig.observe(newer)).toBe(true)
        return hands()
      },
    })
    expect(rig.observe(older)).toBe(false)
    expect(rig.render(110, 0).hands?.tracked).toBe(32)
    expect(
      (f.objects.get('wristL') as Bone).quaternion.angleTo(
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.6),
      ),
    ).toBeLessThan(1e-6)
  })
})
