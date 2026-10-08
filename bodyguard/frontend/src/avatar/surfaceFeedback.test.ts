// FR-A-01/03·FR-M-07: synthetic observation/error envelopes, never clinical validation.
import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from 'three'
import { describe, expect, it } from 'vitest'
import { OBSERVED_LIMB_BINDINGS } from './directionalRig'
import { prepareOwnedAvatarPair } from './ownedAvatarPair'
import { copyFeedbackProgram } from './surfaceFeedback'

const program = () => ({
  motionId: 'fixture-not-release',
  version: 'test',
  regions: [
    { id: 'arm-left', bones: ['upperarm01L'] },
    { id: 'forearm-right', bones: ['lowerarm01R'] },
  ],
})
function fixture(withTrunk = false) {
  const scene = new Group(),
    names = [
      ...new Set(OBSERVED_LIMB_BINDINGS.flatMap((b) => [b.bone, b.anchor])),
      ...(withTrunk ? ['spine05', 'neck01'] : []),
    ]
  const bones = names.map((name) => {
    const bone = new Bone()
    bone.name = name
    return bone
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0.2, 0], 3))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 1, 2, 3, 0, 1, 2, 3], 4))
  if (withTrunk) geometry.getAttribute('skinIndex').setX(0, names.indexOf('spine05'))
  geometry.setAttribute(
    'skinWeight',
    new Float32BufferAttribute([0.4, 0.3, 0.2, 0.1, 0.4, 0.3, 0.2, 0.1], 4),
  )
  geometry.setAttribute('joints_1', new Uint16BufferAttribute([4, 5, 6, 7, 4, 5, 6, 7], 4))
  geometry.setAttribute(
    'weights_1',
    new Float32BufferAttribute([0.1, 0.05, 0.03, 0.02, 0.1, 0.05, 0.03, 0.02], 4),
  )
  const material = new MeshStandardMaterial(),
    mesh = new SkinnedMesh(geometry, material)
  for (const bone of bones) mesh.add(bone)
  for (const { bone, anchor } of OBSERVED_LIMB_BINDINGS) {
    const parent = bones[names.indexOf(bone)],
      child = bones[names.indexOf(anchor)]
    parent.add(child)
    child.position.y = -0.3
  }
  if (withTrunk) {
    const trunk = bones[names.indexOf('spine05')],
      neck = bones[names.indexOf('neck01')]
    trunk.add(neck)
    neck.position.y = 0.5
  }
  mesh.bind(new Skeleton(bones))
  scene.add(mesh)
  const abort = new AbortController()
  const options = {
    load: async () => scene,
    mirror: true,
    halfLifeMs: 50,
    maxAgeMs: 250,
    feedback: program(),
  }
  return {
    scene,
    mesh,
    geometry,
    material,
    abort,
    options,
    context: { generation: 1, signal: abort.signal },
  }
}
function pose(sequence = 1, at = 100, mode = 'single') {
  const image = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
  const world = Array.from({ length: 33 }, (_, i) => ({ x: i * 0.01, y: i * 0.02, z: i * 0.03 }))
  if (mode === 'crop') image[13].y = 2
  return {
    generation: 1,
    sequence,
    at,
    result:
      mode === 'none'
        ? { landmarks: [], worldLandmarks: [] }
        : mode === 'multiple'
          ? { landmarks: [image, image], worldLandmarks: [world, world] }
          : { landmarks: [image], worldLandmarks: [world] },
  }
}
function error(sequence = 1, at = 100) {
  return {
    generation: 1,
    sequence,
    at,
    motionId: 'fixture-not-release',
    version: 'test',
    errors: [{ regionId: 'arm-left', severity: 'deviation' as const }],
  }
}
function firstMesh(
  root: Group | NonNullable<Awaited<ReturnType<typeof prepareOwnedAvatarPair>>['models']>[number],
) {
  let found: SkinnedMesh | undefined
  root.traverse((node) => {
    if ((node as SkinnedMesh).isSkinnedMesh) found = node as SkinnedMesh
  })
  if (!found) throw new Error('Missing synthetic mesh')
  return found
}
describe('owned user surface feedback', () => {
  // FR-A-03/FR-M-07: aggregate observed axis only; never all spine/pelvis bones.
  it('copies only the explicit aggregate trunk region, rejecting unobserved structures', () => {
    const p = { ...program(), regions: [{ id: 'trunk', bones: ['spine05'] }] }
    const copied = copyFeedbackProgram(p)
    p.regions[0].bones[0] = 'spine04'
    expect(copied.regions[0].bones).toEqual(['spine05'])
    expect(Object.isFrozen(copied.regions[0].bones)).toBe(true)
    for (const bone of ['spine04', 'spine01', 'pelvisL', 'neck01', 'head'])
      expect(() =>
        copyFeedbackProgram({ ...p, regions: [{ id: 'trunk', bones: [bone] }] }),
      ).toThrow('Invalid avatar feedback')
    expect(() =>
      copyFeedbackProgram({
        ...p,
        regions: [{ id: 'trunk', bones: ['spine05', 'upperarm01L'] }],
      }),
    ).toThrow('Invalid avatar feedback')
  })
  it('requires enabled trunk before loading a trunk feedback source', async () => {
    const f = fixture(true)
    let loads = 0
    await expect(
      prepareOwnedAvatarPair(f.context, {
        ...f.options,
        feedback: { ...program(), regions: [{ id: 'trunk', bones: ['spine05'] }] },
        load: async () => {
          loads++
          return f.scene
        },
      }),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(loads).toBe(0)
  })
  it('keeps zero-influence submeshes neutral without rejecting a valid trunk model', async () => {
    const f = fixture(true),
      extra = f.mesh.clone(false)
    extra.geometry = f.geometry.clone()
    extra.geometry.getAttribute('skinIndex').setX(0, 0)
    f.scene.add(extra)
    const lease = await prepareOwnedAvatarPair(f.context, {
      ...f.options,
      trunk: true,
      feedback: { ...program(), regions: [{ id: 'trunk', bones: ['spine05'] }] },
    })
    lease.observe(pose())
    expect(
      lease.updateFeedback({
        ...error(),
        errors: [{ regionId: 'trunk', severity: 'deviation' }],
      }),
    ).toBe(true)
    expect(lease.render(100, 0).feedback?.activeRegionIds).toEqual(['trunk'])
    const masks: number[][] = []
    lease.models?.[1].traverse((node) => {
      const mesh = node as SkinnedMesh
      if (mesh.isSkinnedMesh)
        masks.push(Array.from(mesh.geometry.getAttribute('bodyguardFeedbackWeight').array))
    })
    expect(masks).toHaveLength(2)
    expect(masks[0][0]).toBe(1)
    expect(masks[1].every((value) => value === 0)).toBe(true)
    lease.dispose()
  })
  it('preserves relative influence across meshes instead of amplifying a tiny share', async () => {
    const f = fixture(true),
      extra = f.mesh.clone(false)
    extra.geometry = f.geometry.clone()
    extra.geometry.getAttribute('skinWeight').setX(0, 0.01)
    extra.geometry.getAttribute('skinWeight').setY(0, 0.69)
    f.scene.add(extra)
    const lease = await prepareOwnedAvatarPair(f.context, {
      ...f.options,
      trunk: true,
      feedback: { ...program(), regions: [{ id: 'trunk', bones: ['spine05'] }] },
    })
    lease.observe(pose())
    expect(
      lease.updateFeedback({
        ...error(),
        errors: [{ regionId: 'trunk', severity: 'deviation' }],
      }),
    ).toBe(true)
    lease.render(100, 0)
    const peaks: number[] = []
    lease.models?.[1].traverse((node) => {
      const mesh = node as SkinnedMesh
      if (mesh.isSkinnedMesh)
        peaks.push(mesh.geometry.getAttribute('bodyguardFeedbackWeight').getX(0))
    })
    expect(peaks[0]).toBe(1)
    expect(peaks[1]).toBeCloseTo(0.025, 5)
    lease.dispose()
  })
  for (const index of [11, 12, 23, 24])
    it(`removes aggregate trunk colour when required endpoint ${index} is hidden`, async () => {
      const f = fixture(true),
        p = { ...program(), regions: [{ id: 'trunk', bones: ['spine05'] }] }
      const sourceWeights = Array.from(f.geometry.getAttribute('skinWeight').array)
      const lease = await prepareOwnedAvatarPair(f.context, {
        ...f.options,
        trunk: true,
        feedback: p,
      })
      const currentError = (sequence: number, at: number) => ({
        ...error(sequence, at),
        errors: [{ regionId: 'trunk', severity: 'deviation' as const }],
      })
      lease.observe(pose())
      expect(lease.updateFeedback(currentError(1, 100))).toBe(true)
      expect(lease.render(100, 0).feedback?.activeRegionIds).toEqual(['trunk'])
      const models = lease.models
      if (!models) throw new Error('Missing synthetic pair')
      const user = firstMesh(models[1]),
        ref = firstMesh(models[0])
      // Relative colour prominence only; no change to skinning, region membership or verdict.
      expect(user.geometry.getAttribute('bodyguardFeedbackWeight').getX(0)).toBe(1)
      expect(ref.geometry.hasAttribute('bodyguardFeedbackWeight')).toBe(false)
      const cropped = pose(2, 120)
      cropped.result.landmarks[0][index].visibility = 0
      lease.observe(cropped)
      expect(lease.updateFeedback(currentError(2, 120))).toBe(false)
      expect(lease.render(120, 20).feedback?.activeRegionIds).toEqual([])
      expect(user.geometry.getAttribute('bodyguardFeedbackWeight').getX(0)).toBe(0)
      lease.observe(pose(3, 140))
      expect(lease.updateFeedback(currentError(3, 140))).toBe(true)
      expect(lease.render(140, 20).feedback?.activeRegionIds).toEqual(['trunk'])
      expect(lease.render(391, 251).feedback?.activeRegionIds).toEqual([])
      expect(Array.from(f.geometry.getAttribute('skinWeight').array)).toEqual(sourceWeights)
      f.abort.abort()
      expect(lease.updateFeedback(currentError(4, 400))).toBe(false)
      expect(lease.models).toBeNull()
      lease.dispose()
    })
  it('rejects sparse region configuration before requesting its source', async () => {
    const f = fixture()
    let loads = 0
    const regions = Array(1) as ReturnType<typeof program>['regions']
    await expect(
      prepareOwnedAvatarPair(f.context, {
        ...f.options,
        feedback: { ...program(), regions },
        load: async () => {
          loads++
          return f.scene
        },
      }),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(loads).toBe(0)
  })
  it('a reentrant newer observation/error cannot be overwritten by its older getter', async () => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options)
    lease.observe(pose())
    const older = {
      ...error(),
      get errors() {
        lease.observe(pose(2, 120))
        expect(
          lease.updateFeedback({
            ...error(2, 120),
            errors: [{ regionId: 'forearm-right', severity: 'attention' }],
          }),
        ).toBe(true)
        return error().errors
      },
    }
    expect(lease.updateFeedback(older)).toBe(false)
    expect(lease.render(120, 0).feedback?.activeRegionIds).toEqual(['forearm-right'])
    lease.dispose()
  })
  it('a reentrant disposal during an error getter cannot colour retained meshes', async () => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options)
    lease.observe(pose())
    expect(
      lease.updateFeedback({
        ...error(),
        get errors() {
          f.abort.abort()
          return error().errors
        },
      }),
    ).toBe(false)
    expect(lease.models).toBeNull()
    expect(lease.render(100, 0).feedback?.activeRegionIds).toEqual([])
    lease.dispose()
  })
  it('cleans new surface resources even when one disposal listener throws', async () => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options),
      models = lease.models
    if (!models) throw new Error('Missing pair')
    const mesh = firstMesh(models[1]),
      geometry = mesh.geometry,
      material = mesh.material as MeshStandardMaterial
    let attempts = 0
    geometry.addEventListener('dispose', () => {
      throw new Error('Private synthetic cleanup failure')
    })
    material.addEventListener('dispose', () => {
      attempts++
    })
    expect(() => lease.dispose()).toThrow('Resource cleanup failed')
    expect(attempts).toBe(1)
    expect(() => lease.dispose()).toThrow('Resource cleanup failed')
    expect(attempts).toBe(1)
  })
  it('defers a future capture to its original render stamp without losing its highlight', async () => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options)
    lease.render(90, 0)
    lease.observe(pose(1, 100))
    expect(lease.updateFeedback(error(1, 100))).toBe(true)
    expect(lease.render(99, 9).feedback?.activeRegionIds).toEqual([])
    expect(lease.render(100, 1).feedback?.activeRegionIds).toEqual(['arm-left'])
    lease.dispose()
  })
  it('a poisoned current observation cannot leave an old highlight visible', async () => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options)
    lease.observe(pose())
    lease.updateFeedback(error())
    lease.render(100, 0)
    const broken = {
      generation: 1,
      sequence: 2,
      at: 120,
      get result(): never {
        throw new Error('Private synthetic provider failure')
      },
    }
    expect(lease.observe(broken)).toBe(false)
    expect(lease.render(120, 20).feedback?.activeRegionIds).toEqual([])
    lease.dispose()
  })
  it('binds exact observed stamps, changes only user and preserves all eight weights', async () => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options),
      models = lease.models
    if (!models) throw new Error('Missing synthetic pair')
    const [reference, user] = models.map(firstMesh),
      refGeometry = reference.geometry,
      refMaterial = reference.material
    expect(lease.updateFeedback(error())).toBe(false)
    expect(lease.observe(pose())).toBe(true)
    expect(lease.updateFeedback(error())).toBe(true)
    expect(lease.render(100, 0).feedback?.activeRegionIds).toEqual(['arm-left'])
    expect(user.geometry).not.toBe(reference.geometry)
    expect(user.material).not.toBe(reference.material)
    expect(user.geometry.getAttribute('bodyguardFeedbackWeight').getX(0)).toBeCloseTo(0.32)
    expect(user.geometry.getAttribute('skinWeight').array).toEqual(
      refGeometry.getAttribute('skinWeight').array,
    )
    expect(user.geometry.getAttribute('skinWeight1').array).toEqual(
      refGeometry.getAttribute('skinWeight1').array,
    )
    expect(reference.geometry).toBe(refGeometry)
    expect(reference.material).toBe(refMaterial)
    expect(refGeometry.hasAttribute('bodyguardFeedbackWeight')).toBe(false)
    expect(f.geometry.hasAttribute('bodyguardFeedbackWeight')).toBe(false)
    lease.dispose()
  })
  it('includes extra weight influences without colouring an unobserved region', async () => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options)
    lease.observe(pose())
    expect(
      lease.updateFeedback({
        ...error(),
        errors: [{ regionId: 'forearm-right', severity: 'attention' }],
      }),
    ).toBe(true)
    lease.render(100, 0)
    const models = lease.models
    if (!models) throw new Error('Missing pair')
    expect(
      firstMesh(models[1]).geometry.getAttribute('bodyguardFeedbackWeight').getX(0),
    ).toBeCloseTo(0.1)
    lease.observe(pose(2, 120, 'crop'))
    expect(lease.updateFeedback(error(2, 120))).toBe(false)
    expect(lease.render(120, 20).feedback?.activeRegionIds).toEqual([])
    lease.dispose()
  })
  it.each(['none', 'multiple'])('new %s observation revokes old highlights', async (mode) => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options)
    lease.observe(pose())
    lease.updateFeedback(error())
    lease.observe(pose(2, 120, mode))
    expect(lease.render(120, 20).feedback?.activeRegionIds).toEqual([])
    expect(lease.updateFeedback(error(2, 120))).toBe(false)
    lease.dispose()
  })
  it('rejects old generation/version/sequence/stamp and expires without a normal-pose colour', async () => {
    const f = fixture(),
      lease = await prepareOwnedAvatarPair(f.context, f.options)
    lease.observe(pose())
    for (const patch of [{ generation: 2 }, { version: 'wrong' }, { sequence: 0 }, { at: 101 }])
      expect(lease.updateFeedback({ ...error(), ...patch })).toBe(false)
    lease.observe(pose(2, 120))
    expect(lease.updateFeedback(error(2, 120))).toBe(true)
    expect(lease.updateFeedback(error())).toBe(false)
    expect(lease.render(121, 1).feedback?.activeRegionIds).toEqual(['arm-left'])
    expect(lease.render(371, 250).feedback?.activeRegionIds).toEqual([])
    lease.dispose()
  })
  it('copies caller options/frames and blocks retained handles after abort', async () => {
    const f = fixture(),
      p = f.options.feedback,
      pending = prepareOwnedAvatarPair(f.context, f.options)
    p.regions[0].bones[0] = 'bad'
    const lease = await pending
    lease.observe(pose())
    const supplied = error()
    expect(lease.updateFeedback(supplied)).toBe(true)
    supplied.errors.length = 0
    expect(lease.render(100, 0).feedback?.activeRegionIds).toEqual(['arm-left'])
    const models = lease.models
    if (!models) throw new Error('Missing pair')
    const mesh = firstMesh(models[1]),
      geometry = mesh.geometry,
      material = mesh.material as MeshStandardMaterial
    let geometryDisposed = 0,
      materialDisposed = 0
    geometry.addEventListener('dispose', () => geometryDisposed++)
    material.addEventListener('dispose', () => materialDisposed++)
    f.abort.abort()
    expect(lease.updateFeedback(error(2, 120))).toBe(false)
    expect(lease.render(120, 20).feedback?.activeRegionIds).toEqual([])
    lease.dispose()
    lease.dispose()
    expect({ geometryDisposed, materialDisposed }).toEqual({
      geometryDisposed: 1,
      materialDisposed: 1,
    })
  })
  it('malformed configuration does not load and absent callers stay unchanged', async () => {
    const f = fixture()
    let loads = 0
    await expect(
      prepareOwnedAvatarPair(f.context, {
        ...f.options,
        load: async () => {
          loads++
          return f.scene
        },
        feedback: { ...program(), regions: [{ id: 'bad', bones: ['head'] }] },
      }),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(loads).toBe(0)
    const { feedback: _, ...plain } = f.options,
      lease = await prepareOwnedAvatarPair(f.context, plain)
    expect(lease.updateFeedback(error())).toBe(false)
    expect(lease.render(0, 0)).not.toHaveProperty('feedback')
    lease.dispose()
  })
})
