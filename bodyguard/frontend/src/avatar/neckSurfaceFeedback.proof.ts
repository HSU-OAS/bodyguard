// FR-A-01/03·FR-M-07: actual preserved GLBs/eight-weight skin + mathematical frames, not people.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { BufferAttribute, type Object3D, type SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { criteria } from '../../e2e/fixtures/neckCandidate'
import { createNeckCandidateClassifier } from '../stretch/neckCandidateClassifier'
import { cloneEightWeightPair } from './eightWeightSkin'
import { createNeckSurfaceFeedback } from './neckSurfaceFeedback'
import { createObservedComparison } from './observedComparison'
import type { PoseRigFrame } from './observedPoseRig'
import { REVIEW_AVATAR_ASSETS } from './reviewAvatarAssets'
import type { FeedbackFrame } from './surfaceFeedback'

let now = 100
beforeAll(() => {
  vi.stubGlobal('window', {})
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterAll(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const sha = (value: ArrayBufferView) =>
  createHash('sha256')
    .update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    .digest('hex')
function mesh(model: Object3D) {
  const found: SkinnedMesh[] = []
  model.traverse((node) => {
    if ((node as SkinnedMesh).isSkinnedMesh) found.push(node as SkinnedMesh)
  })
  if (found.length !== 1) throw new Error('Unexpected preserved model')
  return found[0]
}
const geometry = (model: Object3D) =>
  Object.fromEntries(
    ['position', 'normal', 'skinIndex', 'skinWeight', 'skinIndex1', 'skinWeight1'].map((name) => [
      name,
      sha(mesh(model).geometry.getAttribute(name).array),
    ]),
  )
function vertices(model: Object3D) {
  model.updateMatrixWorld(true)
  const m = mesh(model),
    values = new Float64Array(m.geometry.getAttribute('position').count * 3),
    point = new Vector3()
  for (let i = 0; i < m.geometry.getAttribute('position').count; i++) {
    m.getVertexPosition(i, point)
    values[i * 3] = point.x
    values[i * 3 + 1] = point.y
    values[i * 3 + 2] = point.z
  }
  return values
}
it.each(['male', 'female'] as const)(
  '%s ties projected colour to exact current pose/head coverage, preserving every source attribute and skinned result',
  async (gender) => {
    now = 100
    const fixture = await import('../../e2e/fixtures/neckWorkspaceSource')
    Object.assign(window.neckWorkspaceFixture, { angle: 0, shoulder: 0, empty: false })
    const bytes = execFileSync(
      'git',
      [
        'show',
        `2be0ebebe731d4b2e44cd93f453ddbf76b6b581f:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${gender}-candidate.glb`,
      ],
      { maxBuffer: 16000000 },
    )
    const source = (await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '')).scene,
      original = source.getObjectByName(mesh(source).name),
      pair = cloneEightWeightPair(source),
      [guide, user] = pair.copies,
      before = geometry(user),
      sourceBefore = sha(mesh(source).geometry.getAttribute('position').array),
      abort = new AbortController(),
      context = { generation: 7, signal: abort.signal },
      camera = fixture.createVideoPoseSource(context),
      observation = createObservedComparison(user, abort.signal),
      control = createNeckSurfaceFeedback(user, context, criteria()),
      classifier = createNeckCandidateClassifier(criteria(), 7)
    const colours = () => {
      const value = mesh(user).geometry.getAttribute('bodyguardFeedbackWeight')
      if (!(value instanceof BufferAttribute)) throw new Error('Unexpected feedback attribute')
      return value
    }
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      REVIEW_AVATAR_ASSETS[gender].sha256,
    )
    let current: PoseRigFrame
    const observe = async (angle = 0, shoulder = 0, change?: (f: PoseRigFrame) => PoseRigFrame) => {
      now += 10
      Object.assign(window.neckWorkspaceFixture, { angle, shoulder })
      const next = await camera.read()
      if (!next) throw new Error('Missing mathematical frame')
      current = change ? change(next) : next
      expect(observation.observe(current)).toBe(true)
      control.observe(current)
      return current
    }
    const update = (): FeedbackFrame => {
      const d = classifier.classify(current, now, { stepId: 'left', phase: 'seeking-target' })
      if (!d) throw new Error('Missing candidate decision')
      return {
        generation: 7,
        sequence: d.sequence,
        at: d.sampledAt,
        motionId: 'neck-side',
        version: criteria().version,
        errors: d.errors.map((code) => ({
          regionId: code === 'neck-shoulder-line' ? 'shoulder-line' : 'head-position',
          severity: 'deviation',
          code,
        })),
      }
    }
    const render = () => {
      observation.render(now, 1000)
      return control.render(now, observation.getCoverage())
    }
    expect(original).toBeTruthy()
    expect(observation.begin(7)).toBe(true)
    await observe(0.4)
    expect(control.update(update())).toBe(true)
    expect(render().activeRegionIds).toEqual([]) // No head display alignment yet.
    expect(observation.align()).toBe(true)
    await observe()
    control.update(update())
    render()
    await observe(0.4)
    control.update(update())
    observation.render(now, 1000)
    const posed = sha(vertices(user)),
      guideBefore = geometry(guide)
    expect(control.render(now, observation.getCoverage()).activeRegionIds).toEqual([
      'head-position',
    ])
    const version = colours().version
    expect(Array.from(colours().array).some((value) => value > 0)).toBe(true)
    expect(sha(vertices(user))).toBe(posed)
    expect(geometry(user)).toEqual(before)
    expect(geometry(guide)).toEqual(guideBefore)
    expect(mesh(guide).geometry.hasAttribute('bodyguardFeedbackWeight')).toBe(false)
    await observe(0.4)
    control.update(update())
    render()
    expect(colours().version).toBe(version) // Stable error refresh must not rewrite all vertices.
    await observe(0, 0.2)
    control.update(update())
    expect(render().activeRegionIds).toEqual(['shoulder-line'])
    const neckPalette = mesh(user).skeleton.bones.map((b) => b.name),
      weights = mesh(user).geometry.getAttribute('skinWeight'),
      indices = mesh(user).geometry.getAttribute('skinIndex')
    let unrelated = 0
    for (let v = 0; v < colours().count; v++)
      if (colours().getX(v) === 0 && neckPalette[indices.getX(v)] === 'head' && weights.getX(v) > 0)
        unrelated++
    expect(unrelated).toBeGreaterThan(0)
    await observe(0.4, 0, (f) => ({ ...f, result: { ...f.result, headOrientation: null } }))
    control.update(update())
    expect(render().activeRegionIds).toEqual([])
    await observe(0.4, 0, (f) => ({
      ...f,
      result: {
        ...f.result,
        landmarks: [f.result.landmarks[0].map((p, i) => (i === 7 ? { ...p, visibility: 0 } : p))],
      },
    }))
    control.update(update())
    expect(render().activeRegionIds).toEqual([])
    await observe(0.4)
    const valid = update()
    control.update(valid)
    expect(render().activeRegionIds).toEqual(['head-position'])
    now += criteria().maxFrameAgeMs + 1
    expect(control.render(now, observation.getCoverage()).activeRegionIds).toEqual([])
    await observe(0, 0.2)
    const fresh = update()
    for (const patch of [
      { generation: 8 },
      { sequence: fresh.sequence - 1 },
      { at: fresh.at - 1 },
      { version: 'other' },
    ])
      expect(control.update({ ...fresh, ...patch })).toBe(false)
    expect(control.update(fresh)).toBe(true)
    render()
    const captured = await observe(0.4)
    const newer = update()
    expect(
      control.update({
        ...newer,
        get errors() {
          control.clear()
          return newer.errors
        },
      }),
    ).toBe(false)
    expect(render().activeRegionIds).toEqual([])
    now += 10
    const older: PoseRigFrame = { ...captured, sequence: captured.sequence + 1, at: now }
    now += 10
    const nested: PoseRigFrame = { ...captured, sequence: captured.sequence + 2, at: now }
    control.observe({
      ...older,
      get result(): never {
        observation.observe(nested)
        control.observe(nested)
        throw new Error('Controlled mathematical accessor failure')
      },
    })
    current = nested
    expect(control.update(update())).toBe(true)
    expect(render().activeRegionIds).toEqual(['head-position'])
    abort.abort()
    expect(control.update(newer)).toBe(false)
    control.dispose()
    observation.dispose()
    expect(mesh(user).geometry.hasAttribute('bodyguardFeedbackWeight')).toBe(false)
    expect(geometry(user)).toEqual(before)
    expect(sha(mesh(source).geometry.getAttribute('position').array)).toBe(sourceBefore)
    pair.dispose()
    await camera.dispose()
  },
)
