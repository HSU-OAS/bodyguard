// FR-A-01/03·FR-M-07: synthetic directions test actual hierarchy math, not medical accuracy.
import { Bone, Group, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createDirectionalRig, observedLimbDirections } from './directionalRig'

function rig() {
  const model = new Group()
  const parent = new Bone()
  parent.name = 'parent'
  parent.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 0.47)
  const arm = new Bone()
  arm.name = 'arm'
  arm.position.set(0.2, 0.7, 0)
  arm.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 0.23)
  const middle = new Bone()
  middle.name = 'middle'
  middle.position.set(0, 0.2, 0)
  const elbow = new Bone()
  elbow.name = 'elbow'
  elbow.position.set(0, 0.3, 0)
  const wrist = new Bone()
  wrist.name = 'wrist'
  wrist.position.set(0, 0.4, 0)
  model.add(parent)
  parent.add(arm)
  arm.add(middle)
  middle.add(elbow)
  elbow.add(wrist)
  model.updateMatrixWorld(true)
  return { model, arm, elbow, wrist }
}
function driver(model: Group, signal = new AbortController().signal) {
  return createDirectionalRig(model, {
    context: { generation: 1, signal },
    bindings: [
      { bone: 'arm', anchor: 'elbow' },
      { bone: 'elbow', anchor: 'wrist' },
    ],
    halfLifeMs: 50,
    maxAgeMs: 250,
  })
}
function direction(a: Bone, b: Bone) {
  a.updateWorldMatrix(true, true)
  return b.getWorldPosition(new Vector3()).sub(a.getWorldPosition(new Vector3())).normalize()
}
function send(
  d: ReturnType<typeof driver>,
  directions: Record<string, readonly number[]>,
  sequence = 1,
  at = 100,
) {
  return d.push({ generation: 1, sequence, at, directions })
}

describe('directional rig', () => {
  it('solves parent/rest axes and descendant endpoints without changing lengths', () => {
    const { model, arm, elbow, wrist } = rig()
    const before = [arm.position.clone(), elbow.position.clone(), wrist.position.clone()]
    const d = driver(model)
    expect(send(d, { arm: [1, 0, 0], elbow: [0, 0, 1] })).toBe(true)
    d.render(100, 0)
    expect(direction(arm, elbow).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-6)
    expect(direction(elbow, wrist).distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-6)
    expect([arm.position, elbow.position, wrist.position]).toEqual(before)
    expect(arm.scale.toArray()).toEqual([1, 1, 1])
  })
  it('sorts child bindings behind parents', () => {
    const { model, arm, elbow, wrist } = rig()
    const d = createDirectionalRig(model, {
      context: { generation: 1, signal: new AbortController().signal },
      bindings: [
        { bone: 'elbow', anchor: 'wrist' },
        { bone: 'arm', anchor: 'elbow' },
      ],
      halfLifeMs: 50,
      maxAgeMs: 250,
    })
    send(d, { arm: [0, 0, 1], elbow: [1, 0, 0] })
    d.render(100, 0)
    expect(direction(arm, elbow).z).toBeCloseTo(1)
    expect(direction(elbow, wrist).x).toBeCloseTo(1)
  })
  it('retains the original generation and refuses nonfinite runtime transforms', () => {
    const { model, arm } = rig()
    const context = { generation: 1, signal: new AbortController().signal }
    const d = createDirectionalRig(model, {
      context,
      bindings: [{ bone: 'arm', anchor: 'elbow' }],
      halfLifeMs: 50,
      maxAgeMs: 250,
    })
    context.generation = 2
    expect(send(d, { arm: [1, 0, 0] })).toBe(true)
    const before = arm.quaternion.toArray()
    model.position.z = NaN
    expect(d.render(100, 16).tracked).toBe(0)
    expect(arm.quaternion.toArray()).toEqual(before)
  })
  it('never combines a partial observation with the old frame', () => {
    const { model, arm, elbow } = rig()
    const d = driver(model)
    send(d, { arm: [1, 0, 0], elbow: [0, 0, 1] })
    d.render(100, 0)
    const frozen = elbow.quaternion.clone()
    send(d, { arm: [0, 1, 0] }, 2, 110)
    expect(d.render(110, 10)).toEqual({ status: 'partial', tracked: 1, total: 2 })
    expect(elbow.quaternion.toArray()).toEqual(frozen.toArray())
    expect(arm.quaternion).not.toEqual(new Quaternion())
  })
  it('rejects malformed, stale, future-render and foreign-generation observations', () => {
    const { model } = rig()
    const d = driver(model)
    expect(d.push({ generation: 2, sequence: 1, at: 100, directions: { arm: [1, 0, 0] } })).toBe(
      false,
    )
    expect(send(d, { arm: [NaN, 0, 0] })).toBe(false)
    expect(send(d, { arm: [0, 0, 0] })).toBe(false)
    expect(send(d, { missing: [1, 0, 0] })).toBe(false)
    expect(send(d, { arm: [1, 0, 0] })).toBe(true)
    expect(send(d, { arm: [0, 1, 0] })).toBe(false)
    expect(send(d, { arm: [0, 1, 0] }, 2, 99)).toBe(false)
    expect(d.render(99, 16).status).toBe('untracked')
    expect(d.render(351, 16).status).toBe('untracked')
  })
  it('freezes expired/aborted/closed rendering and never restores neutral', () => {
    const { model, arm } = rig()
    const abort = new AbortController()
    const d = driver(model, abort.signal)
    send(d, { arm: [1, 0, 0] })
    d.render(100, 0)
    const shown = arm.quaternion.clone()
    expect(d.render(351, 16).tracked).toBe(0)
    expect(arm.quaternion.toArray()).toEqual(shown.toArray())
    abort.abort()
    expect(send(d, { arm: [0, 1, 0] }, 2, 400)).toBe(false)
    d.dispose()
    d.dispose()
    expect(d.render(400, 16).status).toBe('closed')
    expect(arm.quaternion.toArray()).toEqual(shown.toArray())
  })
  it('accepts a still-fresh observation arriving after an intervening render', () => {
    const { model } = rig()
    const d = driver(model)
    expect(d.render(120, 16).status).toBe('untracked')
    expect(send(d, { arm: [1, 0, 0] }, 1, 110)).toBe(true)
    expect(d.render(130, 10).tracked).toBe(1)
  })
  it('interpolates with a frame-rate independent explicit half-life', () => {
    const a = rig()
    const b = rig()
    const da = driver(a.model)
    const db = driver(b.model)
    send(da, { arm: [1, 0, 0] })
    send(db, { arm: [1, 0, 0] })
    da.render(100, 0)
    db.render(100, 0)
    send(da, { arm: [0, 1, 0] }, 2, 110)
    send(db, { arm: [0, 1, 0] }, 2, 110)
    da.render(160, 50)
    db.render(135, 25)
    db.render(160, 25)
    expect(a.arm.quaternion.angleTo(b.arm.quaternion)).toBeLessThan(1e-6)
  })
  it('keeps two models independent and copies the provider input', () => {
    const a = rig()
    const b = rig()
    const before = b.arm.quaternion.clone()
    const d = driver(a.model)
    const target = [1, 0, 0]
    send(d, { arm: target })
    target[0] = 0
    target[1] = 1
    d.render(100, 0)
    expect(direction(a.arm, a.elbow).x).toBeCloseTo(1)
    expect(b.arm.quaternion.toArray()).toEqual(before.toArray())
  })
  it('rejects unsupported rigs rather than falling back to primitives', () => {
    const a = rig()
    a.arm.scale.x = -1
    expect(() => driver(a.model)).toThrow()
    const b = rig()
    b.arm.name = 'missing'
    expect(() => driver(b.model)).toThrow()
    const c = rig()
    const duplicate = new Bone()
    duplicate.name = 'arm'
    c.arm.add(duplicate)
    expect(() => driver(c.model)).toThrow()
  })
  it('solves nonuniform ancestor scales without changing authored transforms', () => {
    const { model, arm, elbow, wrist } = rig()
    model.scale.set(2, 3, 0.7)
    arm.scale.set(1, 1.2, 0.8)
    const scale = arm.scale.toArray()
    const d = driver(model)
    send(d, { arm: [1, 1, 1], elbow: [-1, 2, 1] })
    d.render(100, 0)
    expect(direction(arm, elbow).angleTo(new Vector3(1, 1, 1).normalize())).toBeLessThan(1e-6)
    expect(direction(elbow, wrist).angleTo(new Vector3(-1, 2, 1).normalize())).toBeLessThan(1e-6)
    expect(arm.scale.toArray()).toEqual(scale)
  })
})

describe('observed limb directions', () => {
  const image = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
  const world = () => Array.from({ length: 33 }, (_, i) => ({ x: i * 0.1, y: i * 0.2, z: i * 0.3 }))
  it('uses the existing same-frame trust mask and explicit mirror coordinate conversion', () => {
    const directions = observedLimbDirections(image(), world(), true)
    expect(Object.keys(directions)).toHaveLength(8)
    directions.upperarm01L.forEach((value, index) => {
      expect(value).toBeCloseTo([-0.2, -0.4, -0.6][index], 12)
    })
    expect(directions.upperleg01R).toBeDefined()
  })
  it('omits cropped, invisible, missing and nonfinite endpoints without inventing other joints', () => {
    const i = image()
    const w = world()
    i[13].x = 2
    i[24].visibility = 0
    w[16].z = NaN
    const d = observedLimbDirections(i, w, false)
    expect(d.upperarm01L).toBeUndefined()
    expect(d.lowerarm01L).toBeUndefined()
    expect(d.upperleg01R).toBeUndefined()
    expect(d.lowerarm01R).toBeUndefined()
    expect(d.head).toBeUndefined()
    expect(d.root).toBeUndefined()
    expect(observedLimbDirections(null, null, false)).toEqual({})
  })
})
