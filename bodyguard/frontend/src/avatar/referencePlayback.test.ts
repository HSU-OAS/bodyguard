// FR-S-03/04, FR-A-01/02: authored/synthetic tests, not correct-stretch or camera evidence.
import {
  AnimationClip,
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InterpolateBezier,
  InterpolateDiscrete,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
  VectorKeyframeTrack,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { advanceCoaching, type CoachingState, createCoaching } from '../stretch/progression'
import {
  copyReferenceProgram,
  createReferencePlayback,
  type ReferenceCue,
} from './referencePlayback'

function fixture() {
  const root = new Group(),
    bone = new Bone(),
    child = new Bone()
  bone.name = 'neck'
  child.name = 'head'
  child.position.y = 1
  bone.add(child)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 1, 0, 0], 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([0.5, 0.5, 0, 0], 4))
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial())
  mesh.add(bone)
  mesh.bind(new Skeleton([bone, child]))
  root.add(mesh)
  return { root, bone, child, mesh }
}
function clip(name: string, angle: number, position = 0, scale = 1) {
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle)
  return new AnimationClip(name, 1, [
    new QuaternionKeyframeTrack('neck.quaternion', [0, 1], [0, 0, 0, 1, ...q.toArray()]),
    new VectorKeyframeTrack('head.position', [0, 1], [0, 1, 0, position, 1, 0]),
    new VectorKeyframeTrack('head.scale', [0, 1], [1, 1, 1, scale, scale, scale]),
  ])
}
function program() {
  return {
    motionId: 'fixture-not-release',
    version: '1',
    blendMs: 100,
    maxAgeMs: 250,
    steps: [
      {
        id: 'left',
        clips: {
          'waiting-start': clip('prepare', 0),
          'seeking-target': clip('perform', 0.6, 0.2, 1.1),
          holding: clip('hold', 0.9, 0.3, 1.2),
          'waiting-return': clip('return', 0),
        },
      },
    ],
  }
}
function cue(
  sequence = 1,
  at = 0,
  phase: ReferenceCue['phase'] = 'seeking-target',
  status: ReferenceCue['status'] = 'running',
): ReferenceCue {
  return {
    generation: 1,
    sequence,
    at,
    motionId: 'fixture-not-release',
    version: '1',
    stepId: 'left',
    phase,
    status,
  }
}
function setup() {
  const f = fixture(),
    abort = new AbortController(),
    p = program()
  const driver = createReferencePlayback(f.root, {
    context: { generation: 1, signal: abort.signal },
    program: p,
  })
  return { ...f, abort, p, driver }
}
function render(
  s: ReturnType<typeof setup>,
  now: number,
  delta: number,
  sequence: number,
  phase: ReferenceCue['phase'] = 'seeking-target',
) {
  expect(s.driver.update(cue(sequence, now, phase))).toBe(true)
  return s.driver.render(now, delta)
}
describe('private phase-aware reference display', () => {
  it('rejects native Bezier tracks without required tangent data', () => {
    const p = program()
    p.steps[0].clips.holding.tracks[1].setInterpolation(InterpolateBezier)
    expect(() => copyReferenceProgram(p)).toThrow('Invalid reference playback')
  })
  it('rejects out-of-domain original timestamps and overflowing clip duration', () => {
    const s = setup()
    expect(s.driver.update(cue(1, -1))).toBe(false)
    expect(s.driver.render(-1, 0).status).toBe('unavailable')
    const p = program()
    p.steps[0].clips.holding.duration = Number.MAX_VALUE
    expect(() => copyReferenceProgram(p)).toThrow('Invalid reference playback')
  })
  it('keeps the exact currently displayed quaternion on zero-time phase changes', () => {
    const s = setup()
    s.bone.quaternion.set(0, 0, Math.sin(0.1), Math.cos(0.1) + 1e-7)
    const before = s.bone.quaternion.clone()
    render(s, 0, 0, 1)
    expect(s.bone.quaternion.equals(before)).toBe(true)
  })
  it('retains actual GLTFLoader cubic spline interpolation in a private sampler', async () => {
    const json = {
      asset: { version: '2.0' },
      scenes: [{ nodes: [0] }],
      scene: 0,
      nodes: [{ name: 'neck' }],
      buffers: [{ byteLength: 104 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 8 },
        { buffer: 0, byteOffset: 8, byteLength: 96 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
        { bufferView: 1, componentType: 5126, count: 6, type: 'VEC4' },
      ],
      animations: [
        {
          channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
          samplers: [{ input: 0, output: 1, interpolation: 'CUBICSPLINE' }],
        },
      ],
    }
    const raw = new TextEncoder().encode(JSON.stringify(json)),
      jsonSize = Math.ceil(raw.length / 4) * 4
    const bytes = new Uint8Array(12 + 8 + jsonSize + 8 + 104),
      view = new DataView(bytes.buffer)
    view.setUint32(0, 0x46546c67, true)
    view.setUint32(4, 2, true)
    view.setUint32(8, bytes.length, true)
    view.setUint32(12, jsonSize, true)
    view.setUint32(16, 0x4e4f534a, true)
    bytes.fill(32, 20, 20 + jsonSize)
    bytes.set(raw, 20)
    const binaryOffset = 20 + jsonSize
    view.setUint32(binaryOffset, 104, true)
    view.setUint32(binaryOffset + 4, 0x004e4942, true)
    const samples = new Float32Array(bytes.buffer, binaryOffset + 8, 26)
    samples.set([
      0,
      1,
      ...Array(4).fill(0),
      0,
      0,
      0,
      1,
      ...Array(8).fill(0),
      0,
      0,
      Math.sin(0.3),
      Math.cos(0.3),
      ...Array(4).fill(0),
    ])
    const loaded = await new GLTFLoader().parseAsync(bytes.buffer, '')
    const f = fixture(),
      p = program(),
      clip = loaded.animations[0]
    p.steps[0].clips['seeking-target'] = clip
    const d = createReferencePlayback(f.root, {
      context: { generation: 1, signal: new AbortController().signal },
      program: p,
    })
    d.update(cue())
    d.render(0, 0)
    d.update(cue(2, 500))
    d.render(500, 500)
    expect(f.bone.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.3, 5)
  })
  it('follows actual progression phases without advancing progress from display frames', () => {
    const s = setup(),
      gates = {
        authenticated: true,
        motionValidated: true,
        referenceAvatarReady: true,
        userAvatarReady: true,
      }
    let state: CoachingState = createCoaching({
      motionId: 'fixture-not-release',
      version: '1',
      source: 'direct',
      maxFrameGapMs: 120,
      maxFrameAgeMs: 100,
      steps: [{ id: 'left', kind: 'hold', targetMs: 100 }],
    })
    state = advanceCoaching(state, { type: 'start', now: 0, gates }).state
    state = advanceCoaching(state, { type: 'ready', now: 0, generation: 1 }).state
    let sequence = 0
    const forward = () => {
      const before = JSON.stringify(state)
      s.driver.update({
        generation: state.generation,
        sequence: ++sequence,
        at: state.lastNow,
        motionId: state.plan.motionId,
        version: state.plan.version,
        stepId: state.plan.steps[state.stepIndex].id,
        status: state.status,
        phase: state.phase,
      })
      s.driver.render(state.lastNow, 0)
      expect(JSON.stringify(state)).toBe(before)
      return s.driver.snapshot()
    }
    expect(forward().phase).toBe('waiting-start')
    for (const [at, classification, phase] of [
      [1, 'start', 'seeking-target'],
      [2, 'target', 'holding'],
      [102, 'target', 'waiting-return'],
    ] as const) {
      state = advanceCoaching(state, {
        type: 'frame',
        generation: 1,
        sequence: state.lastSequence + 1,
        now: at,
        sampledAt: at,
        personCount: 1,
        stepId: 'left',
        classification,
      }).state
      expect(forward().phase).toBe(phase)
    }
    state = advanceCoaching(state, {
      type: 'frame',
      generation: 1,
      sequence: state.lastSequence + 1,
      now: 103,
      sampledAt: 103,
      personCount: 1,
      stepId: 'left',
      classification: 'returned',
    }).state
    expect(forward().status).toBe('ended')
    expect(state.progress[0].verifiedMs).toBe(100) // Only supplied classifications earned this.
  })
  it('plays all local TRS and clamps without auto-repeat or success', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    const mid = render(s, 500, 400, 3)
    expect(mid.phase).toBe('seeking-target')
    expect(s.bone.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.3, 5)
    expect(s.child.position.x).toBeCloseTo(0.1, 5)
    expect(s.child.scale.x).toBeCloseTo(1.05, 5)
    render(s, 1000, 500, 4)
    render(s, 1100, 100, 5)
    expect(s.bone.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.6, 5)
    expect(s.driver.snapshot().clipMs).toBe(1000)
    expect(Object.keys(s.driver.snapshot())).not.toContain('verifiedMs')
  })
  it('changes phase from current displayed pose, not a rest snap', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 200, 200, 2)
    const before = s.bone.quaternion.clone()
    render(s, 200, 0, 3, 'holding')
    expect(s.bone.quaternion.angleTo(before)).toBeLessThan(1e-7)
    render(s, 250, 50, 4, 'holding')
    expect(s.bone.quaternion.angleTo(before)).toBeGreaterThan(0)
    render(s, 1200, 950, 5, 'holding')
    expect(s.bone.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.9, 5)
    render(s, 1200, 0, 6, 'waiting-return')
    render(s, 2200, 1000, 7, 'waiting-return')
    expect(s.bone.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-6)
  })
  it('freezes on pause and skips the paused interval on resume', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    expect(s.driver.update(cue(3, 110, 'seeking-target', 'paused'))).toBe(true)
    const before = s.bone.quaternion.clone()
    expect(s.driver.render(120, 10).status).toBe('paused')
    expect(s.driver.render(2000, 1880).status).toBe('paused')
    expect(s.bone.quaternion.equals(before)).toBe(true)
    expect(s.driver.update(cue(4, 2000))).toBe(true)
    expect(s.driver.render(2000, 1880).clipMs).toBe(100)
    expect(render(s, 2100, 100, 5).clipMs).toBe(200)
  })
  it('expires then resumes without adding a stale gap', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    const q = s.bone.quaternion.clone()
    expect(s.driver.render(400, 300).status).toBe('stale')
    expect(s.bone.quaternion.equals(q)).toBe(true)
    expect(s.driver.update(cue(3, 450))).toBe(true)
    expect(s.driver.render(450, 350).clipMs).toBe(100)
  })
  it('rejects duplicate/old generation without disrupting current playback', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    expect(s.driver.update(cue(2, 100, 'holding'))).toBe(false)
    expect(s.driver.update({ ...cue(500, 100), generation: 2 })).toBe(false)
    expect(render(s, 200, 100, 3).clipMs).toBe(200)
  })
  it.each(['motionId', 'version', 'stepId', 'phase', 'status'] as const)(
    'invalid current %s freezes without replaying previous guide',
    (key) => {
      const s = setup()
      render(s, 0, 0, 1)
      render(s, 100, 100, 2)
      const q = s.bone.quaternion.clone()
      expect(s.driver.update({ ...cue(3, 110), [key]: 'unknown' } as ReferenceCue)).toBe(false)
      expect(s.driver.render(110, 10).status).toBe('unavailable')
      expect(s.bone.quaternion.equals(q)).toBe(true)
      expect(s.driver.update(cue(4, 120))).toBe(true)
      expect(s.driver.render(120, 20).clipMs).toBe(100)
    },
  )
  it('rejects future, backwards, nonfinite clocks and negative deltas', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    const q = s.bone.quaternion.clone()
    expect(s.driver.render(90, 0).status).toBe('unavailable')
    expect(s.driver.render(110, -1).status).toBe('unavailable')
    expect(s.driver.render(Number.NaN, 0).status).toBe('unavailable')
    expect(s.bone.quaternion.equals(q)).toBe(true)
    expect(s.driver.update(cue(3, 500))).toBe(true)
    expect(s.driver.render(120, 20).status).toBe('stale')
  })
  it('snapshots clips/arrays and does not share displayed poses between owners', () => {
    const p = program(),
      copy = copyReferenceProgram(p),
      f = fixture(),
      a = new AbortController()
    const d = createReferencePlayback(f.root, {
      context: { generation: 1, signal: a.signal },
      program: copy,
    })
    p.steps[0].clips['seeking-target'].tracks[0].values.fill(0)
    copy.steps[0].clips['seeking-target'].tracks[0].values.fill(0)
    d.update(cue())
    d.render(0, 0)
    d.update(cue(2, 200))
    d.render(200, 200)
    expect(f.bone.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.12, 5)
    const other = setup()
    expect(other.bone.quaternion.equals(new Quaternion())).toBe(true)
    expect(f.mesh.geometry.getAttribute('position').getX(0)).toBe(0)
  })
  it.each([
    'foreign.quaternion',
    'neck.material.opacity',
    'neck.quaternion[x]',
    '../head.position',
    'head.userData',
  ])('rejects non-owned or non-TRS track %s', (name) => {
    const s = fixture(),
      p = program()
    p.steps[0].clips.holding.tracks[0].name = name
    expect(() =>
      createReferencePlayback(s.root, {
        context: { generation: 1, signal: new AbortController().signal },
        program: p,
      }),
    ).toThrow('Invalid reference playback')
  })
  it('rejects duplicate tracks, duplicate step ids, malformed samples and empty clips', () => {
    for (const mutate of [
      (p: ReturnType<typeof program>) => p.steps.push(p.steps[0]),
      (p: ReturnType<typeof program>) =>
        p.steps[0].clips.holding.tracks.push(p.steps[0].clips.holding.tracks[0]),
      (p: ReturnType<typeof program>) => {
        p.steps[0].clips.holding.tracks[0].times[1] = -1
      },
      (p: ReturnType<typeof program>) => {
        p.steps[0].clips.holding.tracks[0].values[2] = Number.NaN
      },
      (p: ReturnType<typeof program>) => {
        p.steps[0].clips.holding.tracks = []
      },
      (p: ReturnType<typeof program>) => {
        p.blendMs = 0
      },
    ]) {
      const p = program()
      mutate(p)
      expect(() => copyReferenceProgram(p)).toThrow('Invalid reference playback')
    }
  })
  it('retains discrete interpolation from the supplied asset', () => {
    const s = fixture(),
      p = program(),
      abort = new AbortController()
    p.steps[0].clips['seeking-target'].tracks[1].setInterpolation(InterpolateDiscrete)
    const d = createReferencePlayback(s.root, {
      context: { generation: 1, signal: abort.signal },
      program: p,
    })
    d.update(cue())
    d.render(0, 0)
    d.update(cue(2, 500))
    d.render(500, 500)
    expect(s.child.position.x).toBe(0)
    expect(s.bone.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.3, 5)
  })
  it('rejects changed bone parent before mutating any other pose', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    const before = s.bone.quaternion.clone()
    s.mesh.add(s.child)
    expect(s.driver.render(200, 100).status).toBe('unavailable')
    expect(s.bone.quaternion.equals(before)).toBe(true)
  })
  it('accepts external scene placement but rejects duplicate and unbound bones', () => {
    const s = setup(),
      host = new Group()
    host.add(s.root)
    expect(render(s, 0, 0, 1).status).toBe('playing')
    for (const kind of ['duplicate', 'unbound']) {
      const f = fixture(),
        b = new Bone()
      b.name = 'neck'
      if (kind === 'duplicate') f.root.add(b)
      else f.mesh.skeleton.bones = []
      expect(() =>
        createReferencePlayback(f.root, {
          context: { generation: 1, signal: new AbortController().signal },
          program: program(),
        }),
      ).toThrow('Invalid reference playback')
    }
  })
  it('ends without resetting visible reference and blocks later input', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    const before = s.bone.quaternion.clone()
    expect(s.driver.update(cue(3, 110, 'seeking-target', 'ended'))).toBe(true)
    expect(s.driver.render(110, 10).status).toBe('ended')
    expect(s.bone.quaternion.equals(before)).toBe(true)
    expect(s.driver.update(cue(4, 120))).toBe(false)
  })
  it('abort/dispose rejects late and reentrant getters without pose changes', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    const before = s.bone.quaternion.clone()
    const input = {
      ...cue(3, 110),
      get stepId() {
        s.abort.abort()
        return 'left'
      },
    }
    expect(s.driver.update(input)).toBe(false)
    expect(s.driver.snapshot().status).toBe('closed')
    expect(s.bone.quaternion.equals(before)).toBe(true)
    s.driver.dispose()
    expect(s.driver.update(cue(4, 120))).toBe(false)
  })
  it('keeps closed status when an input getter aborts and then throws', () => {
    const s = setup()
    const input = {
      ...cue(),
      get stepId(): string {
        s.abort.abort()
        throw new Error('PRIVATE_REFERENCE_INPUT')
      },
    }
    expect(s.driver.update(input)).toBe(false)
    expect(s.driver.snapshot().status).toBe('closed')
  })
  it('detects changed skin binding before applying reference poses', () => {
    const s = setup()
    render(s, 0, 0, 1)
    render(s, 100, 100, 2)
    const before = s.bone.quaternion.clone()
    s.mesh.skeleton.bones.splice(0)
    expect(s.driver.render(200, 100).status).toBe('unavailable')
    expect(s.bone.quaternion.equals(before)).toBe(true)
  })
  it('rejects zero blended scale atomically even when each clip endpoint is invertible', () => {
    const f = fixture(),
      p = program(),
      abort = new AbortController()
    const track = p.steps[0].clips['seeking-target'].tracks[2]
    track.values.set([-1, -1, -1, -1, -1, -1])
    const d = createReferencePlayback(f.root, {
      context: { generation: 1, signal: abort.signal },
      program: p,
    })
    d.update(cue())
    d.render(0, 0)
    const before = f.bone.quaternion.clone()
    d.update(cue(2, 50))
    expect(d.render(50, 50).status).toBe('unavailable')
    expect(f.bone.quaternion.equals(before)).toBe(true)
    expect(f.child.scale.toArray()).toEqual([1, 1, 1])
  })
})
