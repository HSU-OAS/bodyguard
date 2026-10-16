// FR-A-01/03·FR-M-07: real own GLB/animation with generated points, NOT webcam/clinical proof.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import type { Bone, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { blenderReferenceProgram } from './blenderReferenceProgram'
import { cloneEightWeightPair } from './eightWeightSkin'
import { createObservedComparison } from './observedComparison'
import { createReferencePlayback } from './referencePlayback'

let now = 100
const shaPose = (model: Object3D) => {
  const q: unknown[] = []
  model.traverse((n) => {
    if ((n as Bone).isBone) q.push([n.name, n.quaternion.toArray()])
  })
  return JSON.stringify(q)
}
beforeAll(() => {
  vi.stubGlobal('window', {})
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterAll(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it.each(['male', 'female'] as const)(
  '%s keeps observed and authored copies independent through rebind/stale/abort',
  async (gender) => {
    now = 100
    const fixture = await import('../../e2e/fixtures/workspaceAvatarSource')
    Object.assign(window.workspaceAvatarFixture, {
      angle: 0,
      headAngle: 0,
      handBend: 0,
      details: true,
      empty: false,
    })
    const sourceBytes = execFileSync(
      'git',
      [
        'show',
        `2be0ebebe731d4b2e44cd93f453ddbf76b6b581f:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${gender}-candidate.glb`,
      ],
      { maxBuffer: 16_000_000 },
    )
    const loader = new GLTFLoader()
    const source = (await loader.parseAsync(new Uint8Array(sourceBytes).buffer, '')).scene
    const animation = await loader.parseAsync(
      new Uint8Array(
        readFileSync(
          new URL(
            `../../../docs/review/blender-reference-content/animations/${gender}-neck-side.glb`,
            import.meta.url,
          ),
        ),
      ).buffer,
      '',
    )
    const original = shaPose(source),
      pair = cloneEightWeightPair(source),
      [guide, user] = pair.copies,
      userRest = shaPose(user),
      guideRest = shaPose(guide),
      abort = new AbortController()
    const observation = createObservedComparison(user, abort.signal)
    const reference = createReferencePlayback(guide, {
      context: { generation: 3, signal: abort.signal },
      program: blenderReferenceProgram('neck-side', animation),
    })
    const camera = fixture.createCameraPreparation({ allowed: () => true, onState: () => {} })
    await camera.start()
    camera.observe()
    expect(user.visible).toBe(false)
    expect(observation.begin(1)).toBe(true)
    window.workspaceAvatarFixture.angle = 0.6
    const first = camera.takeFrame()
    if (!first) throw new Error('Missing generated frame')
    expect(observation.observe(first)).toBe(true)
    observation.render(now, 1000)
    expect(user.visible).toBe(true)
    expect(shaPose(user)).not.toBe(userRest)
    expect(shaPose(guide)).toBe(guideRest)
    const beforeReference = shaPose(user)
    reference.update({
      generation: 3,
      sequence: 1,
      at: now,
      motionId: 'neck-side',
      version: 'blender-preview-v1',
      stepId: 'left',
      phase: 'holding',
      status: 'running',
    })
    reference.render(now, 0)
    reference.render(now + 500, 500)
    expect(shaPose(guide)).not.toBe(guideRest)
    expect(shaPose(user)).toBe(beforeReference)
    expect(observation.observe(first)).toBe(false)
    expect(observation.observe({ ...first, generation: 2, sequence: 99 })).toBe(false)
    expect(observation.align()).toBe(true)
    now += 10
    const alignment = camera.takeFrame()
    if (!alignment) throw new Error('Missing generated frame')
    observation.observe(alignment)
    observation.render(now, 10)
    now += 10
    window.workspaceAvatarFixture.headAngle = 0.35
    window.workspaceAvatarFixture.handBend = 0.6
    const detail = camera.takeFrame()
    if (!detail) throw new Error('Missing generated frame')
    const headBefore = user.getObjectByName('head')?.quaternion.clone(),
      fingerBefore = user.getObjectByName('finger2-2L')?.quaternion.clone()
    if (!headBefore || !fingerBefore) throw new Error('Missing authored detail bone')
    observation.observe(detail)
    observation.render(now, 1000)
    expect(user.getObjectByName('head')?.quaternion.angleTo(headBefore)).toBeGreaterThan(0.2)
    expect(user.getObjectByName('finger2-2L')?.quaternion.angleTo(fingerBefore)).toBeGreaterThan(
      0.1,
    )
    window.workspaceAvatarFixture.empty = true
    now += 10
    const empty = camera.takeFrame()
    if (!empty) throw new Error('Missing generated frame')
    observation.observe(empty)
    expect(observation.render(now, 10)).toBe('waiting')
    expect(user.visible).toBe(false)
    window.workspaceAvatarFixture.empty = false
    now += 10
    const recovered = camera.takeFrame()
    if (!recovered) throw new Error('Missing generated frame')
    observation.observe(recovered)
    observation.render(now, 10)
    expect(user.visible).toBe(true)
    now += 1001
    expect(observation.render(now, 1001)).toBe('waiting')
    expect(user.visible).toBe(false)
    observation.suspend()
    expect(shaPose(user)).toBe(userRest)
    expect(observation.begin(2)).toBe(true)
    expect(observation.observe(recovered)).toBe(false)
    expect(shaPose(source)).toBe(original)
    abort.abort()
    expect(observation.begin(3)).toBe(false)
    expect(observation.render(now, 0)).toBe('waiting')
    observation.dispose()
    reference.dispose()
    pair.dispose()
  },
)
