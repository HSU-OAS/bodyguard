// FR-A-01/03·FR-M-07: actual professional GLBs/rig, mathematical capture only; not people.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { type Bone, type Object3D, type SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { shrugCriteria, shrugFrame } from '../../e2e/fixtures/shrugCandidate'
import { cloneEightWeightPair } from './eightWeightSkin'
import { createObservedComparison } from './observedComparison'
import { createObservedShoulderElevation } from './observedShoulderElevation'

let now = 100
beforeAll(() => vi.spyOn(performance, 'now').mockImplementation(() => now))
afterAll(() => vi.restoreAllMocks())
function attributes(root: Object3D) {
  const rows: unknown[] = []
  root.traverse((n) => {
    if ((n as SkinnedMesh).isSkinnedMesh)
      for (const name of Object.keys((n as SkinnedMesh).geometry.attributes).sort()) {
        const a = (n as SkinnedMesh).geometry.getAttribute(name).array
        rows.push([
          name,
          createHash('sha256')
            .update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))
            .digest('hex'),
        ])
      }
  })
  return JSON.stringify(rows)
}
const pose = (root: Object3D) => {
  const rows: unknown[] = []
  root.traverse((n) => {
    if ((n as Bone).isBone)
      rows.push([n.name, n.position.toArray(), n.scale.toArray(), n.quaternion.toArray()])
  })
  return JSON.stringify(rows)
}
it.each(['male', 'female'] as const)(
  '%s independently raises both/one shoulder only after explicit fresh neutral alignment; preserves source/guide/geometry',
  async (gender) => {
    now = 100
    const bytes = execFileSync(
      'git',
      [
        'show',
        `2be0ebebe731d4b2e44cd93f453ddbf76b6b581f:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${gender}-candidate.glb`,
      ],
      { maxBuffer: 16000000 },
    )
    const source = (await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '')).scene,
      sourcePose = pose(source),
      original = attributes(source),
      pair = cloneEightWeightPair(source),
      [guide, user] = pair.copies,
      userOriginal = attributes(user),
      guidePose = pose(guide),
      rest = pose(user),
      abort = new AbortController(),
      observed = createObservedComparison(user, abort.signal, shrugCriteria())
    let seq = 0
    const point = (name: string) => {
      user.updateMatrixWorld(true)
      const node = user.getObjectByName(name)
      if (!node) throw new Error('Missing preserved bone')
      return node.getWorldPosition(new Vector3())
    }
    const send = (rise: number, right = rise, empty = false) => {
      now += 10
      const f = shrugFrame(rise, ++seq, now)
      f.result.landmarks[0][12].y += (rise - right) / 480
      f.result.worldLandmarks = [f.result.landmarks[0].map((p) => ({ ...p }))]
      if (empty) {
        f.result.landmarks = []
        f.result.worldLandmarks = []
      }
      expect(observed.observe(f)).toBe(true)
      observed.render(now, 1000)
      return f
    }
    expect(observed.begin(7)).toBe(true)
    const before = user.getObjectByName('clavicleL')?.quaternion.clone()
    send(40)
    if (!before) throw new Error('Missing preserved clavicle')
    expect(user.getObjectByName('clavicleL')?.quaternion.toArray()).toEqual(before.toArray())
    expect(observed.align()).toBe(true)
    send(40)
    expect(observed.getCoverage()?.projectedRegions).toEqual([])
    send(0)
    const low = [point('upperarm01L'), point('upperarm01R')]
    expect(observed.getCoverage()?.projectedRegions).toEqual(['shoulder-line'])
    send(40)
    const high = [point('upperarm01L'), point('upperarm01R')]
    expect(high[0].y - low[0].y).toBeGreaterThan(0.04)
    expect(high[1].y - low[1].y).toBeGreaterThan(0.04)
    expect(observed.getCoverage()?.bones).not.toContain('clavicleL')
    expect(observed.align()).toBe(true)
    expect(observed.getCoverage()).toBeNull()
    send(40)
    expect(observed.getCoverage()?.projectedRegions).toEqual([])
    send(0)
    send(40, 0)
    expect(point('upperarm01L').y - low[0].y).toBeGreaterThan(0.04)
    expect(point('upperarm01R').y).toBeCloseTo(low[1].y, 5)
    send(0)
    expect(point('upperarm01L').y).toBeCloseTo(low[0].y, 5)
    send(40, 40, true)
    expect(observed.getCoverage()).toBeNull()
    expect(user.visible).toBe(false)
    send(40)
    expect(user.visible).toBe(true)
    now += 121
    observed.render(now, 121) // Display's existing input bound is1000, candidate colour uses its tighter profile.
    now += 1000
    observed.render(now, 1000)
    expect(user.visible).toBe(false)
    observed.suspend()
    expect(pose(user)).toBe(rest)
    expect(observed.begin(8)).toBe(true)
    expect(observed.observe(shrugFrame(40, 1, now))).toBe(false)
    expect(pose(source)).toBe(sourcePose)
    expect(pose(guide)).toBe(guidePose)
    expect(attributes(user)).toBe(userOriginal)
    expect(attributes(source)).toBe(original)
    abort.abort()
    expect(observed.begin(9)).toBe(false)
    observed.dispose()
    pair.dispose()
  },
)
it('rejects missing authored bones rather than inventing a rig', () => {
  expect(() =>
    createObservedShoulderElevation(
      { traverse() {}, updateWorldMatrix() {} } as never,
      { generation: 7, signal: new AbortController().signal },
      shrugCriteria(),
      true,
    ),
  ).toThrow()
})
