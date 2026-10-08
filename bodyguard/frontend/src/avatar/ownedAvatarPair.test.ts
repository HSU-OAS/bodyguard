// FR-A-01/02/03·FR-M-07: owned synthetic objects, not webcam/clinical validation.
import {
  AnimationClip,
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Texture,
  Uint16BufferAttribute,
} from 'three'
import { describe, expect, it } from 'vitest'
import {
  createResourceController,
  ResourceCleanupError,
  type ResourceNotice,
} from '../coaching/resources'
import { OBSERVED_LIMB_BINDINGS } from './directionalRig'
import { HAND_RIG_BINDINGS } from './observedHandRig'
import { prepareOwnedAvatarPair } from './ownedAvatarPair'
import type { ReferenceProgram } from './referencePlayback'

function requireFixtureNode(model: Object3D, name: string) {
  const node = model.getObjectByName(name)
  if (!node) throw new Error('Fixture node unavailable')
  return node
}

function referenceProgram(): ReferenceProgram {
  const clips = Object.fromEntries(
    ['waiting-start', 'seeking-target', 'holding', 'waiting-return'].map((phase) => [
      phase,
      new AnimationClip(phase, 1, [
        new QuaternionKeyframeTrack(
          'upperarm01L.quaternion',
          [0, 1],
          [0, 0, 0, 1, 0, 0, Math.sin(0.3), Math.cos(0.3)],
        ),
      ]),
    ]),
  ) as ReferenceProgram['steps'][number]['clips']
  return {
    motionId: 'fixture-not-release',
    version: '1',
    blendMs: 100,
    maxAgeMs: 250,
    steps: [{ id: 'left', clips }],
  }
}

describe('optional reference display ownership', () => {
  it('copies before async load, drives only reference and returns bounded display status', async () => {
    const f = fixture(),
      c = context(),
      p = referenceProgram(),
      d = deferred<Group>()
    const supplied = { ...options(f.scene, () => d.promise), reference: p }
    const pending = prepareOwnedAvatarPair(c.context, supplied)
    p.steps[0].clips['seeking-target'].tracks[0].values.fill(0)
    supplied.reference = referenceProgram()
    d.resolve(f.scene)
    const lease = await pending
    const models = lease.models
    if (!models) throw new Error('Fixture models unavailable')
    const [reference, user] = models
    const cue = {
      generation: 1,
      sequence: 1,
      at: 0,
      motionId: 'fixture-not-release',
      version: '1',
      stepId: 'left',
      phase: 'seeking-target' as const,
      status: 'running' as const,
    }
    const sourceBefore = requireFixtureNode(f.scene, 'upperarm01L').quaternion.clone()
    const userBefore = requireFixtureNode(user, 'upperarm01L').quaternion.clone()
    expect(lease.updateReference(cue)).toBe(true)
    lease.render(0, 0)
    lease.updateReference({ ...cue, sequence: 2, at: 200 })
    const result = lease.render(200, 200)
    expect(result.reference?.status).toBe('playing')
    expect(
      requireFixtureNode(reference, 'upperarm01L').quaternion.angleTo(sourceBefore),
    ).toBeGreaterThan(0)
    expect(requireFixtureNode(user, 'upperarm01L').quaternion.equals(userBefore)).toBe(true)
    expect(requireFixtureNode(f.scene, 'upperarm01L').quaternion.equals(sourceBefore)).toBe(true)
    c.abort.abort()
    expect(lease.updateReference({ ...cue, sequence: 3, at: 210 })).toBe(false)
    expect(lease.render(210, 10).reference?.status).toBe('closed')
    expect(lease.models).toBeNull()
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
    lease.dispose()
  })
  it('does not load malformed reference configuration and keeps absent callers unchanged', async () => {
    const f = fixture(),
      p = referenceProgram()
    let loads = 0
    const bad = { ...p, steps: [] }
    await expect(
      prepareOwnedAvatarPair(context().context, {
        ...options(f.scene, async () => {
          loads++
          return f.scene
        }),
        reference: bad,
      }),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(loads).toBe(0)
    const lease = await prepareOwnedAvatarPair(context().context, options(f.scene))
    expect(lease.updateReference({} as never)).toBe(false)
    expect(lease.render(0, 0)).not.toHaveProperty('reference')
    lease.dispose()
  })
  it('rejects a non-bound reference track and cleans the fresh source and both copies', async () => {
    const f = fixture(),
      p = referenceProgram()
    p.steps[0].clips.holding.tracks[0].name = 'head.quaternion'
    await expect(
      prepareOwnedAvatarPair(context().context, { ...options(f.scene), reference: p }),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
  })
})

function fixture() {
  const scene = new Group()
  const names = [...new Set(OBSERVED_LIMB_BINDINGS.flatMap((b) => [b.bone, b.anchor]))]
  const bones = names.map((name) => {
    const bone = new Bone()
    bone.name = name
    return bone
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 1, 2, 3], 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([0.4, 0.3, 0.2, 0.1], 4))
  geometry.setAttribute('joints_1', new Uint16BufferAttribute([4, 5, 6, 7], 4))
  geometry.setAttribute('weights_1', new Float32BufferAttribute([0.1, 0.05, 0.03, 0.02], 4))
  const material = new MeshStandardMaterial()
  const mesh = new SkinnedMesh(geometry, material)
  for (const bone of bones) mesh.add(bone)
  for (const binding of OBSERVED_LIMB_BINDINGS) {
    const bone = bones.find((b) => b.name === binding.bone),
      anchor = bones.find((b) => b.name === binding.anchor)
    if (!bone || !anchor) throw new Error('Missing fixture bone')
    bone.add(anchor)
    anchor.position.y = -0.3
  }
  mesh.bind(new Skeleton(bones))
  scene.add(mesh)
  const count = { geometry: 0, material: 0, skeleton: 0 }
  geometry.addEventListener('dispose', () => {
    count.geometry++
  })
  material.addEventListener('dispose', () => {
    count.material++
  })
  mesh.skeleton.computeBoneTexture()
  mesh.skeleton.boneTexture?.addEventListener('dispose', () => {
    count.skeleton++
  })
  return { scene, mesh, geometry, material, count }
}
function options(scene: Group, load = async () => scene) {
  return { load, mirror: true, halfLifeMs: 50, maxAgeMs: 250 }
}
function context(generation = 1) {
  const abort = new AbortController()
  return { abort, context: { generation, signal: abort.signal } }
}
function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function withHands(f = fixture()) {
  const bones = [...f.mesh.skeleton.bones]
  function add(name: string, parent: Bone) {
    const bone = new Bone()
    bone.name = name
    bone.position.y = 0.03
    parent.add(bone)
    bones.push(bone)
    return bone
  }
  for (const suffix of ['L', 'R']) {
    const wrist = f.mesh.getObjectByName(`wrist${suffix}`) as Bone
    const forearm = add(`lowerarm02${suffix}`, wrist.parent as Bone)
    forearm.add(wrist)
    for (let digit = 1; digit <= 5; digit++) {
      let parent = digit === 1 ? wrist : add(`metacarpal${digit - 1}${suffix}`, wrist)
      for (let joint = 1; joint <= 3; joint++)
        parent = add(`finger${digit}-${joint}${suffix}`, parent)
    }
  }
  f.mesh.skeleton.bones = bones
  f.mesh.skeleton.calculateInverses()
  return f
}
const handAlignment = () => ({
  cameraReferences: { left: [0, 0, 0, 1], right: [0, 0, 0, 1] },
  sceneFromCamera: [0, 0, 0, 1],
})

describe('owned GLB avatar preparation', () => {
  it('copies optional hand alignment before a delayed source and disposes both owned hand rigs', async () => {
    const f = withHands(),
      c = context(),
      d = deferred<Group>(),
      supplied = handAlignment()
    let reads = 0
    const pending = prepareOwnedAvatarPair(c.context, {
      ...options(f.scene, () => d.promise),
      get hands() {
        reads++
        return supplied
      },
    })
    supplied.cameraReferences.left.fill(0)
    supplied.sceneFromCamera.fill(0)
    d.resolve(f.scene)
    const pair = await pending
    expect(reads).toBe(1)
    expect(pair.render(100, 0).hands?.total).toBe(32)
    for (const binding of HAND_RIG_BINDINGS)
      expect(pair.models?.[0].getObjectByName(binding.bone)).not.toBe(
        pair.models?.[1].getObjectByName(binding.bone),
      )
    pair.dispose()
    pair.dispose()
    expect(pair.render(110, 10).hands?.status).toBe('closed')
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
  })
  it('refuses invalid hand calibration before starting the owned loader', async () => {
    let calls = 0
    const f = withHands(),
      supplied = handAlignment()
    supplied.cameraReferences.left.length = 3
    await expect(
      prepareOwnedAvatarPair(context().context, {
        ...options(f.scene, async () => {
          calls++
          return f.scene
        }),
        hands: supplied,
      }),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(calls).toBe(0)
    expect(f.count.geometry).toBe(0)
  })
  it('rejects an unbound distal finger even when its bone node exists and cleans the source', async () => {
    const f = withHands()
    f.mesh.skeleton.bones = f.mesh.skeleton.bones.filter((b) => b.name !== 'finger1-3L')
    await expect(
      prepareOwnedAvatarPair(context().context, { ...options(f.scene), hands: handAlignment() }),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
  })
  it('returns distinct clones and owns source cleanup without changing its shape', async () => {
    const f = fixture(),
      c = context(),
      before = f.geometry.getAttribute('skinWeight').getX(0)
    const lease = await prepareOwnedAvatarPair(c.context, options(f.scene))
    const models = lease.models
    expect(models).not.toBeNull()
    expect(models?.[0]).not.toBe(models?.[1])
    expect(models?.[0].getObjectByName('upperarm01L')).not.toBe(
      models?.[1].getObjectByName('upperarm01L'),
    )
    expect(f.geometry.getAttribute('skinWeight').getX(0)).toBe(before)
    expect(f.count).toEqual({ geometry: 0, material: 0, skeleton: 0 })
    lease.dispose()
    lease.dispose()
    expect(lease.models).toBeNull()
    expect(lease.render(100, 0).status).toBe('closed')
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
  })
  it('does not start a loader for an already aborted or invalid generation', async () => {
    const f = fixture(),
      c = context()
    let calls = 0
    const opt = options(f.scene, async () => {
      calls++
      return f.scene
    })
    c.abort.abort()
    await expect(prepareOwnedAvatarPair(c.context, opt)).rejects.toThrow('Avatar asset unavailable')
    await expect(prepareOwnedAvatarPair(context(0).context, opt)).rejects.toThrow(
      'Avatar asset unavailable',
    )
    expect(calls).toBe(0)
    expect(f.count.geometry).toBe(0)
  })
  it('reclaims a late returned source without delivering models', async () => {
    const f = fixture(),
      c = context(),
      d = deferred<Group>()
    const pending = prepareOwnedAvatarPair(
      c.context,
      options(f.scene, () => d.promise),
    )
    const rejected = expect(pending).rejects.toThrow('Avatar asset unavailable')
    c.abort.abort()
    d.resolve(f.scene)
    await rejected
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
  })
  it('maps loader errors to a fixed message without retaining raw errors', async () => {
    const f = fixture()
    await expect(
      prepareOwnedAvatarPair(
        context().context,
        options(f.scene, async () => {
          throw new Error('PRIVATE_SOURCE_ERROR')
        }),
      ),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(f.count.geometry).toBe(0)
  })
  it('rejects a source alias without disposing another lease', async () => {
    const f = fixture(),
      c = context()
    const first = await prepareOwnedAvatarPair(c.context, options(f.scene))
    await expect(prepareOwnedAvatarPair(context(2).context, options(f.scene))).rejects.toThrow(
      'Avatar asset unavailable',
    )
    expect(first.models).not.toBeNull()
    expect(f.count.geometry).toBe(0)
    first.dispose()
    expect(f.count.geometry).toBe(1)
  })
  it("rejects a fresh scene with another lease's texture and reclaims only fresh handles", async () => {
    const first = fixture(),
      second = fixture(),
      texture = new Texture()
    let released = 0
    texture.addEventListener('dispose', () => {
      released++
    })
    first.material.map = texture
    const lease = await prepareOwnedAvatarPair(context().context, options(first.scene))
    second.material.map = texture
    await expect(prepareOwnedAvatarPair(context(2).context, options(second.scene))).rejects.toThrow(
      'Avatar asset unavailable',
    )
    expect(second.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
    expect(first.count).toEqual({ geometry: 0, material: 0, skeleton: 0 })
    expect(released).toBe(0)
    expect(lease.models).not.toBeNull()
    await expect(
      prepareOwnedAvatarPair(context(3).context, options(lease.models?.[0] as Group)),
    ).rejects.toThrow('Avatar asset unavailable')
    expect(lease.models).not.toBeNull()
    lease.dispose()
    expect(released).toBe(1)
  })
  it('detaches both owned models and closes observation on abort', async () => {
    const f = fixture(),
      c = context(),
      host = new Group()
    const lease = await prepareOwnedAvatarPair(c.context, options(f.scene))
    for (const model of lease.models ?? []) host.add(model)
    c.abort.abort()
    expect(host.children).toHaveLength(0)
    expect(lease.models).toBeNull()
    expect(
      lease.observe({
        generation: 1,
        sequence: 1,
        at: 100,
        result: { landmarks: [], worldLandmarks: [] },
      }),
    ).toBe(false)
    expect(lease.render(100, 0).status).toBe('closed')
    lease.dispose()
    expect(f.count.geometry).toBe(1)
  })
  it('cleans source and constructed clones when the authored rig has duplicate endpoints', async () => {
    const f = fixture()
    const duplicate = new Bone()
    duplicate.name = 'footL'
    f.scene.add(duplicate)
    const copies = { geometry: 0, material: 0 }
    const cloneGeometry = f.geometry.clone.bind(f.geometry)
    f.geometry.clone = () => {
      const copy = cloneGeometry()
      copy.addEventListener('dispose', () => {
        copies.geometry++
      })
      return copy
    }
    const cloneMaterial = f.material.clone.bind(f.material)
    f.material.clone = () => {
      const copy = cloneMaterial()
      copy.addEventListener('dispose', () => {
        copies.material++
      })
      return copy
    }
    await expect(prepareOwnedAvatarPair(context().context, options(f.scene))).rejects.toThrow(
      'Avatar asset unavailable',
    )
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
    expect(copies).toEqual({ geometry: 1, material: 1 })
  })
  it('does not prepare a meshless or unbound rig as a loaded body', async () => {
    for (const kind of ['empty-geometry', 'no-skinned-body', 'unbound-bones']) {
      const f = fixture()
      if (kind === 'empty-geometry')
        f.geometry.setAttribute('position', new Float32BufferAttribute([], 3))
      if (kind === 'no-skinned-body') {
        f.mesh.removeFromParent()
        f.scene.add(new Mesh(f.geometry, f.material), ...f.mesh.children)
      }
      if (kind === 'unbound-bones') f.mesh.skeleton.bones = []
      await expect(prepareOwnedAvatarPair(context().context, options(f.scene))).rejects.toThrow(
        'Avatar asset unavailable',
      )
      expect(f.count.geometry).toBe(1)
      expect(f.count.material).toBe(1)
      if (kind === 'no-skinned-body') f.mesh.skeleton.dispose()
    }
  })
  it('continues all cleanup and reports only a fixed cleanup failure', async () => {
    const f = fixture(),
      c = context()
    const lease = await prepareOwnedAvatarPair(c.context, options(f.scene))
    f.geometry.addEventListener('dispose', () => {
      throw new Error('PRIVATE_DISPOSE_ERROR')
    })
    expect(() => lease.dispose()).toThrow('Resource cleanup failed')
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
    expect(lease.models).toBeNull()
    expect(() => lease.dispose()).toThrow('Resource cleanup failed')
    expect(f.count.geometry).toBe(1)
  })
  it('reclaims a shared source texture once and is safe under reentrant disposal', async () => {
    const f = fixture(),
      texture = new Texture()
    f.material.map = texture
    f.material.roughnessMap = texture
    const lease = await prepareOwnedAvatarPair(context().context, options(f.scene))
    let textures = 0
    texture.addEventListener('dispose', () => {
      textures++
      lease.dispose()
    })
    lease.dispose()
    expect(textures).toBe(1)
    expect(f.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
    expect(lease.models).toBeNull()
  })
  it('quarantines the current controller when a cancelled native source fails cleanup', async () => {
    const old = fixture(),
      active = fixture(),
      d = deferred<Group>()
    const notices: ResourceNotice[] = []
    const disposed = { camera: 0, inference: 0 }
    let started!: () => void
    const loading = new Promise<void>((resolve) => {
      started = resolve
    })
    let activeLease: Awaited<ReturnType<typeof prepareOwnedAvatarPair>> | undefined
    const controller = createResourceController(
      {
        camera: async () => ({
          dispose() {
            disposed.camera++
          },
        }),
        inference: async () => ({
          dispose() {
            disposed.inference++
          },
        }),
        avatars: async (ctx) => {
          if (ctx.generation === 1) {
            started()
            return prepareOwnedAvatarPair(
              ctx,
              options(old.scene, () => d.promise),
            )
          }
          activeLease = await prepareOwnedAvatarPair(ctx, options(active.scene))
          return activeLease
        },
      },
      (notice) => {
        notices.push(notice)
      },
    )
    const pending = controller.run({ type: 'request-camera', generation: 1 })
    await loading
    await controller.run({ type: 'request-camera', generation: 2 })
    old.geometry.addEventListener('dispose', () => {
      throw new Error('PRIVATE_DISPOSE_ERROR')
    })
    d.resolve(old.scene)
    await pending
    await controller.run({ type: 'request-camera', generation: 3 })
    await controller.close()
    expect(notices).toEqual([
      { type: 'ready', generation: 2 },
      { type: 'error', generation: 1, reason: 'cleanup-error' },
    ])
    expect(activeLease?.models).toBeNull()
    expect(disposed).toEqual({ camera: 2, inference: 2 })
    expect(old.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
    expect(active.count).toEqual({ geometry: 1, material: 1, skeleton: 1 })
    expect(new ResourceCleanupError().message).toBe('Resource cleanup failed')
  })
})
