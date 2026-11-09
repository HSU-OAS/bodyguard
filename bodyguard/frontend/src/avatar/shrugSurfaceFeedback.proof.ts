// FR-A-01/03·FR-M-07: actual preserved GLBs/eight-weight vertices + mathematical frames only.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { type Object3D, type SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { shrugCriteria, shrugFrame } from '../../e2e/fixtures/shrugCandidate'
import { createShrugCandidateClassifier } from '../stretch/shrugCandidateClassifier'
import { cloneEightWeightPair } from './eightWeightSkin'
import { createNeckSurfaceFeedback } from './neckSurfaceFeedback'
import { createObservedComparison } from './observedComparison'
import type { FeedbackFrame } from './surfaceFeedback'

let now = 100
beforeAll(() => vi.spyOn(performance, 'now').mockImplementation(() => now))
afterAll(() => vi.restoreAllMocks())
const sha = (b: ArrayBufferView) =>
  createHash('sha256')
    .update(new Uint8Array(b.buffer, b.byteOffset, b.byteLength))
    .digest('hex')
function mesh(root: Object3D) {
  const found: SkinnedMesh[] = []
  root.traverse((n) => {
    if ((n as SkinnedMesh).isSkinnedMesh) found.push(n as SkinnedMesh)
  })
  if (found.length !== 1) throw new Error('Unexpected preserved model')
  return found[0]
}
function vertices(root: Object3D) {
  root.updateMatrixWorld(true)
  const m = mesh(root),
    out = new Float64Array(m.geometry.getAttribute('position').count * 3),
    v = new Vector3()
  for (let i = 0; i < out.length / 3; i++) {
    m.getVertexPosition(i, v)
    out.set(v.toArray(), i * 3)
  }
  return sha(out)
}
const attrs = (root: Object3D) =>
  Object.fromEntries(
    ['position', 'normal', 'skinIndex', 'skinWeight', 'skinIndex1', 'skinWeight1'].map((n) => [
      n,
      sha(mesh(root).geometry.getAttribute(n).array),
    ]),
  )
it.each(['male', 'female'] as const)(
  '%s same-frame shoulder colour never changes any skinned vertex/weight, guide or missing coverage',
  async (gender) => {
    now = 100
    const b = execFileSync(
        'git',
        [
          'show',
          `2be0ebebe731d4b2e44cd93f453ddbf76b6b581f:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${gender}-candidate.glb`,
        ],
        { maxBuffer: 16000000 },
      ),
      source = (await new GLTFLoader().parseAsync(new Uint8Array(b).buffer, '')).scene,
      pair = cloneEightWeightPair(source),
      [guide, user] = pair.copies,
      original = attrs(user),
      guideOriginal = attrs(guide),
      abort = new AbortController(),
      ctx = { generation: 7, signal: abort.signal },
      criteria = shrugCriteria(),
      observed = createObservedComparison(user, abort.signal, criteria),
      control = createNeckSurfaceFeedback(user, ctx, criteria, 'shoulder-shrug'),
      classifier = createShrugCandidateClassifier(criteria, 7)
    let seq = 0
    const send = (rise = 0, right = rise, hide = false) => {
      now += 10
      const f = shrugFrame(rise, ++seq, now)
      f.result.landmarks[0][12].y += (rise - right) / 480
      f.result.worldLandmarks = [f.result.landmarks[0].map((p) => ({ ...p }))]
      if (hide) f.result.landmarks[0][23].visibility = 0
      Object.assign(f.result, { headOrientation: [0, 0, 0, 1] })
      expect(observed.observe(f)).toBe(true)
      control.observe(f)
      const d = classifier.classify(f, now, { stepId: 'both', phase: 'seeking-target' })
      if (!d) throw new Error('Missing generated decision')
      const map = {
        'shrug-head': 'head-position',
        'shrug-trunk': 'trunk',
        'shrug-arms': 'shoulder-line',
        'shrug-asymmetry': 'shoulder-line',
        'shrug-range': 'shoulder-line',
      } as const
      const frame: FeedbackFrame = {
        generation: 7,
        sequence: f.sequence,
        at: f.at,
        motionId: 'shoulder-shrug',
        version: criteria.version,
        errors: d.errors.map((code) => ({ regionId: map[code], severity: 'deviation', code })),
      }
      control.update(frame)
      observed.render(now, 1000)
      return frame
    }
    expect(observed.begin(7)).toBe(true)
    observed.align()
    send()
    control.render(now, observed.getCoverage())
    send(40, 0)
    const before = vertices(user),
      guideBefore = vertices(guide)
    expect(control.render(now, observed.getCoverage()).activeRegionIds).toEqual(['shoulder-line'])
    expect(vertices(user)).toBe(before)
    expect(vertices(guide)).toBe(guideBefore)
    expect(attrs(user)).toEqual(original)
    expect(attrs(guide)).toEqual(guideOriginal)
    send(40, 0, true)
    expect(control.render(now, observed.getCoverage()).activeRegionIds).toEqual([])
    observed.dispose()
    control.dispose()
    pair.dispose()
    abort.abort()
  },
)
