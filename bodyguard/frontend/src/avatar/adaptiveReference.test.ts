// FR-S-03/04·FR-A-01/03: authored synthetic display, not validated correction content.
import {
  AnimationClip,
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from 'three'
import { describe, expect, it } from 'vitest'
import {
  copyReferenceProgram,
  createReferencePlayback,
  type ReferenceCue,
  type ReferenceProgram,
} from './referencePlayback'

function clip(name: string, angle: number) {
  return new AnimationClip(name, 1, [
    new QuaternionKeyframeTrack(
      'neck.quaternion',
      [0, 1],
      [0, 0, 0, 1, 0, 0, Math.sin(angle / 2), Math.cos(angle / 2)],
    ),
  ])
}
function program(): ReferenceProgram {
  return {
    motionId: 'synthetic',
    version: '1',
    blendMs: 100,
    maxAgeMs: 250,
    steps: [
      {
        id: 'left',
        clips: {
          'waiting-start': clip('start', 0),
          'seeking-target': clip('perform', 0.4),
          holding: clip('hold', 0.4),
          'waiting-return': clip('return', 0),
        },
        corrections: [
          {
            id: 'relax',
            errorCode: 'shoulder-raised',
            regionId: 'arm',
            phases: ['holding', 'seeking-target'],
            clip: clip('relax', -0.8),
          },
          {
            id: 'align',
            errorCode: 'arm-direction',
            regionId: 'arm',
            phases: ['holding'],
            clip: clip('align', 0.9),
          },
        ],
      },
    ],
  }
}
function setup(p = program()) {
  const root = new Group(),
    bone = new Bone()
  bone.name = 'neck'
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 0, 0, 0], 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0], 4))
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial())
  mesh.add(bone)
  mesh.bind(new Skeleton([bone]))
  root.add(mesh)
  const abort = new AbortController(),
    driver = createReferencePlayback(root, {
      context: { generation: 1, signal: abort.signal },
      program: p,
    })
  return { bone, root, driver, abort }
}
function cue(
  sequence: number,
  at: number,
  correction: ReferenceCue['correction'] = undefined,
  phase: ReferenceCue['phase'] = 'holding',
): ReferenceCue {
  return {
    generation: 1,
    sequence,
    at,
    motionId: 'synthetic',
    version: '1',
    stepId: 'left',
    phase,
    status: 'running',
    ...(correction ? { correction } : {}),
  }
}
describe('current-error authored reference display', () => {
  it('rejects ambiguous duplicate cause/region/phase mappings', () => {
    const p = program(),
      step = p.steps[0]
    const first = step.corrections?.[0]
    if (!first) throw new Error('Fixture correction missing')
    ;(step as { corrections: typeof step.corrections }).corrections = [
      first,
      { ...first, id: 'another-clip-for-same-error' },
    ]
    expect(() => copyReferenceProgram(p)).toThrow('Invalid reference playback')
  })
  it('does not replace a newer correction when an older input getter reenters or throws', () => {
    for (const throws of [false, true]) {
      const s = setup(),
        older = cue(99, 120, { id: 'relax', sampledAt: 120 })
      Object.defineProperty(older, 'phase', {
        get() {
          expect(s.driver.update(cue(2, 110, { id: 'align', sampledAt: 110 }))).toBe(true)
          if (throws) throw new Error('Foreign input')
          return 'holding'
        },
      })
      expect(s.driver.update(older)).toBe(false)
      expect(s.driver.snapshot()).toMatchObject({ status: 'playing', correctionId: 'align' })
    }
  })
  it('copies correction metadata and animation buffers before caller mutation', () => {
    const p = program(),
      copy = copyReferenceProgram(p),
      c = p.steps[0].corrections?.[0]
    if (!c) throw new Error('Fixture correction missing')
    ;(c as { id: string }).id = 'changed'
    c.clip.tracks[0].values.fill(0)
    expect(copy.steps[0].corrections?.[0].id).toBe('relax')
    expect(copy.steps[0].corrections?.[0].clip.tracks[0].values[3]).toBe(1)
    expect(Object.isFrozen(copy.steps[0].corrections)).toBe(true)
  })
  it.each([
    'empty-code',
    'duplicate-id',
    'duplicate-phase',
    'sparse',
    'invalid-clip',
    'too-many',
  ] as const)('rejects %s mapping before playback', (kind) => {
    const p = program(),
      step = p.steps[0] as {
        corrections: NonNullable<ReferenceProgram['steps'][number]['corrections']>
      }
    if (kind === 'empty-code') (step.corrections[0] as { errorCode: string }).errorCode = ' '
    if (kind === 'duplicate-id') step.corrections = [step.corrections[0], step.corrections[0]]
    if (kind === 'duplicate-phase')
      (step.corrections[0] as unknown as { phases: ReferenceCue['phase'][] }).phases = [
        'holding',
        'holding',
      ]
    if (kind === 'sparse') step.corrections = new Array(1)
    if (kind === 'invalid-clip') step.corrections[0].clip.tracks[0].values[0] = NaN
    if (kind === 'too-many')
      step.corrections = Array.from({ length: 33 }, (_, i) => ({
        ...step.corrections[0],
        id: String(i),
      }))
    expect(() => copyReferenceProgram(p)).toThrow('Invalid reference playback')
  })
  it('changes correction without a zero-time jump and does not restart the same clip', () => {
    const s = setup()
    expect(s.driver.update(cue(1, 0, { id: 'relax', sampledAt: 0 }))).toBe(true)
    s.driver.render(0, 0)
    s.driver.update(cue(2, 100, { id: 'relax', sampledAt: 100 }))
    s.driver.render(100, 100)
    expect(s.bone.quaternion.z).toBeLessThan(0)
    const before = s.bone.quaternion.clone()
    s.driver.update(cue(3, 100, { id: 'align', sampledAt: 100 }))
    s.driver.render(100, 0)
    expect(s.bone.quaternion.equals(before)).toBe(true)
    s.driver.update(cue(4, 200, { id: 'align', sampledAt: 200 }))
    s.driver.render(200, 100)
    expect(s.bone.quaternion.z).toBeGreaterThan(0)
    expect(s.driver.snapshot().correctionId).toBe('align')
    expect(s.driver.snapshot().clipMs).toBe(100)
    s.driver.update(cue(5, 250, { id: 'align', sampledAt: 250 }))
    s.driver.render(250, 50)
    expect(s.driver.snapshot().clipMs).toBe(150)
  })
  it('clears to the normal phase clip from the displayed pose', () => {
    const s = setup()
    s.driver.update(cue(1, 0, { id: 'relax', sampledAt: 0 }))
    s.driver.render(0, 0)
    s.driver.update(cue(2, 100, { id: 'relax', sampledAt: 100 }))
    s.driver.render(100, 100)
    const before = s.bone.quaternion.clone()
    s.driver.update(cue(3, 100))
    s.driver.render(100, 0)
    expect(s.bone.quaternion.equals(before)).toBe(true)
    expect(s.driver.snapshot().correctionId).toBe(null)
    s.driver.update(cue(4, 200))
    s.driver.render(200, 100)
    expect(s.bone.quaternion.angleTo(new Quaternion())).toBeCloseTo(0.04, 5)
  })
  it.each(['unknown', 'phase', 'future', 'expired'] as const)(
    'rejects %s correction without guessing another clip',
    (kind) => {
      const s = setup(),
        c = cue(
          1,
          300,
          {
            id: kind === 'unknown' ? 'unknown' : 'align',
            sampledAt: kind === 'future' ? 301 : kind === 'expired' ? 0 : 300,
          },
          kind === 'phase' ? 'waiting-return' : 'holding',
        )
      expect(s.driver.update(c)).toBe(false)
      expect(s.driver.snapshot().status).toBe('unavailable')
      expect(s.bone.quaternion.equals(new Quaternion())).toBe(true)
    },
  )
  it('expires from capture time even when later valid cue clocks arrive', () => {
    const s = setup()
    s.driver.update(cue(1, 0, { id: 'relax', sampledAt: 0 }))
    s.driver.render(0, 0)
    s.driver.update(cue(2, 240, { id: 'relax', sampledAt: 0 }))
    s.driver.render(240, 240)
    const before = s.bone.quaternion.clone()
    expect(s.driver.render(251, 11).status).toBe('stale')
    expect(s.bone.quaternion.equals(before)).toBe(true)
    s.abort.abort()
    expect(s.driver.snapshot().status).toBe('closed')
    expect(s.driver.update(cue(3, 252))).toBe(false)
  })
})
