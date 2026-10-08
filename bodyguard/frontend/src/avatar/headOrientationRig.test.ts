// FR-A-01/03·FR-M-02/07: synthetic display math, never clinical accuracy.
import { Bone, Group, Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createHeadOrientationRig, readHeadOrientation } from './headOrientationRig'

const axis = new Vector3(0, 1, 0)
const turn = (angle: number) => new Quaternion().setFromAxisAngle(axis, angle)
function face(q = new Quaternion(), row = false) {
  const m = new Matrix4().compose(new Vector3(0, 0, 0), q, new Vector3(2, 2, 2))
  if (row) m.transpose()
  return {
    faceLandmarks: [Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))],
    facialTransformationMatrixes: [{ rows: 4, columns: 4, data: m.toArray() }],
  }
}
function fixture() {
  const model = new Group(),
    neck = new Bone(),
    head = new Bone(),
    other = new Bone()
  head.name = 'head'
  neck.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 0.3)
  head.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 0.2)
  head.position.set(0, 0.4, 0)
  model.add(neck, other)
  neck.add(head)
  model.updateWorldMatrix(true, true)
  return { model, neck, head, other }
}
function driver(f = fixture(), baseline = new Quaternion(), mirror = false) {
  const abort = new AbortController()
  const d = createHeadOrientationRig(f.model, {
    context: { generation: 1, signal: abort.signal },
    bone: 'head',
    matrixLayout: 'column-major',
    mirror,
    cameraReference: baseline.toArray(),
    sceneFromCamera: new Quaternion().toArray(),
    halfLifeMs: 50,
    maxAgeMs: 250,
  })
  return { ...f, d, abort }
}
function send(d: ReturnType<typeof driver>['d'], q: Quaternion | null, sequence = 1, at = 100) {
  return d.push({ generation: 1, sequence, at, result: q ? face(q) : null })
}
const shown = (head: Bone) => head.getWorldQuaternion(new Quaternion())
function decoded(result: ReturnType<typeof face>, layout: 'column-major' | 'row-major') {
  const value = readHeadOrientation(result, layout)
  if (!value) throw new Error('Expected synthetic rotation')
  return new Quaternion().fromArray(value)
}

describe('explicit head orientation', () => {
  it('uses declared storage even when translation is zero', () => {
    const q = turn(0.6)
    expect(decoded(face(q), 'column-major').angleTo(q)).toBeLessThan(1e-6)
    expect(decoded(face(q, true), 'row-major').angleTo(q)).toBeLessThan(1e-6)
    expect(decoded(face(q, true), 'column-major').angleTo(q)).toBeGreaterThan(1)
  })
  it('rejects malformed and non-similarity matrices', () => {
    for (const index of [0, 3, 8, 15])
      for (const bad of [NaN, Infinity]) {
        const r = face()
        r.facialTransformationMatrixes[0].data[index] = bad
        expect(readHeadOrientation(r, 'column-major')).toBeNull()
      }
    for (const mutate of [
      (m: number[]) => {
        m[3] = 0.1
      },
      (m: number[]) => {
        m[0] = -2
      },
      (m: number[]) => {
        m[0] = 3
      },
      (m: number[]) => {
        m[4] = 0.2
      },
      (m: number[]) => {
        m[15] = 0
      },
      (m: number[]) => {
        m[0] = 0
      },
    ]) {
      const r = face()
      mutate(r.facialTransformationMatrixes[0].data)
      expect(readHeadOrientation(r, 'column-major')).toBeNull()
    }
    const r = face()
    r.facialTransformationMatrixes[0].rows = 3
    expect(readHeadOrientation(r, 'column-major')).toBeNull()
    r.facialTransformationMatrixes[0].data.pop()
    expect(readHeadOrientation(r, 'column-major')).toBeNull()
  })
  it('does not choose the first of multiple or clipped faces', () => {
    const r = face()
    r.faceLandmarks.push(r.faceLandmarks[0])
    expect(readHeadOrientation(r, 'column-major')).toBeNull()
    r.faceLandmarks.length = 1
    r.faceLandmarks[0][1].x = -0.1
    expect(readHeadOrientation(r, 'column-major')).toBeNull()
    r.faceLandmarks[0].length = 10
    expect(readHeadOrientation(r, 'column-major')).toBeNull()
    expect(
      readHeadOrientation({ faceLandmarks: [], facialTransformationMatrixes: [] }, 'column-major'),
    ).toBeNull()
  })
  it('applies first observed turn instead of auto-neutralizing it', () => {
    const f = driver(),
      rest = shown(f.head)
    expect(send(f.d, turn(0.6))).toBe(true)
    expect(f.d.render(100, 0).tracked).toBe(1)
    expect(shown(f.head).angleTo(turn(0.6).multiply(rest))).toBeLessThan(1e-6)
  })
  it('copies explicit reference and preserves every authored non-head matrix', () => {
    const f = fixture(),
      rest = shown(f.head),
      baseline = turn(0.2)
    const before = [
      f.neck.quaternion.toArray(),
      f.head.position.toArray(),
      f.head.scale.toArray(),
      f.other.quaternion.toArray(),
    ]
    const { d } = driver(f, baseline)
    baseline.identity()
    send(d, turn(0.6))
    d.render(100, 0)
    expect(shown(f.head).angleTo(turn(0.4).multiply(rest))).toBeLessThan(1e-6)
    expect([
      f.neck.quaternion.toArray(),
      f.head.position.toArray(),
      f.head.scale.toArray(),
      f.other.quaternion.toArray(),
    ]).toEqual(before)
  })
  it('mirrors yaw and roll but not pitch', () => {
    for (const a of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
      const f = driver(fixture(), new Quaternion(), true),
        rest = shown(f.head)
      send(f.d, new Quaternion().setFromAxisAngle(a, 0.4))
      f.d.render(100, 0)
      const expected = new Quaternion().setFromAxisAngle(a, a.x ? 0.4 : -0.4).multiply(rest)
      expect(shown(f.head).angleTo(expected)).toBeLessThan(1e-6)
    }
  })
  it('uses camera to scene basis and compensates a later parent rotation', () => {
    const f = fixture(),
      rest = shown(f.head),
      basis = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.7)
    const d = createHeadOrientationRig(f.model, {
      context: { generation: 1, signal: new AbortController().signal },
      bone: 'head',
      matrixLayout: 'column-major',
      mirror: false,
      cameraReference: new Quaternion().toArray(),
      sceneFromCamera: basis.toArray(),
      halfLifeMs: 50,
      maxAgeMs: 250,
    })
    f.neck.quaternion.multiply(turn(0.2))
    send(d, turn(0.4))
    d.render(100, 0)
    const expected = basis
      .clone()
      .multiply(turn(0.4))
      .multiply(basis.clone().invert())
      .multiply(rest)
    expect(shown(f.head).angleTo(expected)).toBeLessThan(1e-6)
  })
  it('revokes a new missing observation without resetting the displayed pose', () => {
    const f = driver()
    send(f.d, turn(0.4))
    f.d.render(100, 0)
    const before = f.head.quaternion.toArray()
    send(f.d, null, 2, 110)
    expect(f.d.render(110, 10).tracked).toBe(0)
    expect(f.head.quaternion.toArray()).toEqual(before)
  })
  it('rejects foreign, repeated, reversed and stale stamps before reading result', () => {
    const f = driver()
    const foreign = {
      generation: 2,
      sequence: 1,
      at: 100,
      get result(): never {
        throw new Error('Must not read')
      },
    }
    expect(f.d.push(foreign)).toBe(false)
    send(f.d, turn(0.4))
    expect(send(f.d, turn(0.2))).toBe(false)
    expect(send(f.d, turn(0.2), 2, 99)).toBe(false)
    expect(f.d.render(99, 0).tracked).toBe(0)
    expect(f.d.render(351, 16).tracked).toBe(0)
    expect(send(f.d, turn(0.2), 2, 100)).toBe(false)
  })
  it('freezes expired, closed and aborted poses; never restores neutral', () => {
    const f = driver()
    send(f.d, turn(0.4))
    f.d.render(100, 0)
    const before = f.head.quaternion.toArray()
    f.d.render(351, 16)
    f.abort.abort()
    f.d.dispose()
    f.d.dispose()
    expect(send(f.d, turn(0.2), 2, 400)).toBe(false)
    expect(f.d.render(400, 16).status).toBe('closed')
    expect(f.head.quaternion.toArray()).toEqual(before)
  })
  it('has frame-rate independent explicit interpolation', () => {
    const a = driver(),
      b = driver()
    for (const f of [a, b]) {
      send(f.d, new Quaternion())
      f.d.render(100, 0)
      send(f.d, turn(0.8), 2, 110)
    }
    a.d.render(160, 50)
    b.d.render(135, 25)
    b.d.render(160, 25)
    expect(a.head.quaternion.angleTo(b.head.quaternion)).toBeLessThan(1e-6)
  })
  it('keeps separate rigs and does not change the source result', () => {
    const a = driver(),
      b = driver(),
      before = b.head.quaternion.toArray(),
      r = face(turn(0.4)),
      data = [...r.facialTransformationMatrixes[0].data]
    a.d.push({ generation: 1, sequence: 1, at: 100, result: r })
    r.facialTransformationMatrixes[0].data.fill(0)
    a.d.render(100, 0)
    expect(b.head.quaternion.toArray()).toEqual(before)
    expect(a.head.quaternion.toArray()).not.toEqual(before)
    expect(data.length).toBe(16)
  })
  it('rejects missing/duplicate bones and material nonuniform scales without normalizing them', () => {
    const f = fixture()
    f.model.scale.set(1, 2, 1)
    expect(() => driver(f)).toThrow()
    expect(f.model.scale.toArray()).toEqual([1, 2, 1])
    const duplicate = fixture(),
      head = new Bone()
    head.name = 'head'
    duplicate.model.add(head)
    expect(() => driver(duplicate)).toThrow()
    const missing = fixture()
    missing.head.name = 'other'
    expect(() => driver(missing)).toThrow()
  })
  it('refuses a new unsupported runtime matrix without rotating the head', () => {
    const f = driver(),
      before = f.head.quaternion.toArray()
    send(f.d, turn(0.4))
    f.neck.scale.y = 2
    expect(f.d.render(100, 0).tracked).toBe(0)
    expect(f.head.quaternion.toArray()).toEqual(before)
  })
  it('does not overwrite a reentrant newer observation with an older payload', () => {
    const f = driver(),
      rest = shown(f.head)
    const frame = {
      generation: 1,
      sequence: 1,
      at: 100,
      get result() {
        send(f.d, turn(0.8), 2, 110)
        return face(turn(0.2))
      },
    }
    expect(f.d.push(frame)).toBe(false)
    expect(f.d.render(110, 0).tracked).toBe(1)
    expect(shown(f.head).angleTo(turn(0.8).multiply(rest))).toBeLessThan(1e-6)
  })
  it('an abort during foreign payload access cannot revive the observation', () => {
    const f = driver(),
      before = f.head.quaternion.toArray()
    const frame = {
      generation: 1,
      sequence: 1,
      at: 100,
      get result() {
        f.abort.abort()
        return face(turn(0.2))
      },
    }
    expect(f.d.push(frame)).toBe(false)
    expect(f.d.render(100, 0).status).toBe('closed')
    expect(f.head.quaternion.toArray()).toEqual(before)
  })
  it('revokes a fresh malformed or throwing payload and cannot reuse its stamps', () => {
    const f = driver()
    send(f.d, turn(0.4))
    f.d.render(100, 0)
    const r = face()
    r.facialTransformationMatrixes[0].data[0] = NaN
    expect(f.d.push({ generation: 1, sequence: 2, at: 110, result: r })).toBe(true)
    expect(f.d.render(110, 0).tracked).toBe(0)
    expect(send(f.d, turn(0.8), 2, 110)).toBe(false)
    expect(
      f.d.push({
        generation: 1,
        sequence: 3,
        at: 120,
        get result(): never {
          throw new Error('Foreign value')
        },
      }),
    ).toBe(false)
    expect(f.d.render(120, 0).tracked).toBe(0)
  })
  it('rejects sparse, boundary-clipped and nonfinite face points', () => {
    const sparse = face()
    delete sparse.faceLandmarks[0][0]
    expect(readHeadOrientation(sparse, 'column-major')).toBeNull()
    for (const bad of [0, 1, NaN, Infinity]) {
      const r = face()
      r.faceLandmarks[0][0].x = bad
      expect(readHeadOrientation(r, 'column-major')).toBeNull()
    }
    const r = face()
    r.faceLandmarks[0][0].z = NaN
    expect(readHeadOrientation(r, 'column-major')).toBeNull()
  })
  it('copies the reference frame and accepts only numerical Float32 scale noise', () => {
    const f = fixture()
    f.model.scale.set(1, 0.99999994, 0.99999613)
    const scale = f.model.scale.toArray(),
      d = driver(f).d
    send(d, turn(0.4))
    expect(d.render(100, 0).tracked).toBe(1)
    expect(f.model.scale.toArray()).toEqual(scale)
  })
  it('rejects changed head scale or reparenting before changing its rotation', () => {
    for (const change of [
      (f: ReturnType<typeof driver>) => {
        f.head.scale.y = 2
      },
      (f: ReturnType<typeof driver>) => {
        new Bone().add(f.head)
      },
    ]) {
      const f = driver(),
        before = f.head.quaternion.toArray()
      send(f.d, turn(0.4))
      change(f)
      expect(f.d.render(100, 0).tracked).toBe(0)
      expect(f.head.quaternion.toArray()).toEqual(before)
    }
  })
  it('does not assume invalid display settings are calibrated', () => {
    const f = fixture()
    const options = {
      context: { generation: 1, signal: new AbortController().signal },
      bone: 'head',
      matrixLayout: 'column-major' as const,
      mirror: false,
      cameraReference: [0, 0, 0, 1],
      sceneFromCamera: [0, 0, 0, 1],
      halfLifeMs: 50,
      maxAgeMs: 250,
    }
    for (const bad of [
      [0, 0, 0, 0],
      [0, 0, 0, 2],
      [NaN, 0, 0, 1],
      [0, 0, 1],
    ])
      expect(() =>
        createHeadOrientationRig(f.model, { ...options, cameraReference: bad }),
      ).toThrow()
    expect(() => createHeadOrientationRig(f.model, { ...options, halfLifeMs: 0 })).toThrow()
    expect(() => createHeadOrientationRig(f.model, { ...options, maxAgeMs: Infinity })).toThrow()
  })
})
