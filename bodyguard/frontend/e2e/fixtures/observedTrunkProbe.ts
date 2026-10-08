// FR-A-01/03·FR-M-07: real original GLB/WebGL; generated observations only.
import {
  type Bone,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  type Object3D,
  OrthographicCamera,
  Quaternion,
  Scene,
  type SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OBSERVED_LIMB_BINDINGS } from '../../src/avatar/directionalRig'
import type { PoseRigFrame } from '../../src/avatar/observedPoseRig'
import { OBSERVED_TRUNK_BINDING } from '../../src/avatar/observedTrunk'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'

type Mode = 'side' | 'forward' | 'hidden' | 'multiple' | 'recover' | 'expired'
const joints = [
  ['upperarm01L', 11],
  ['lowerarm01L', 13],
  ['wristL', 15],
  ['upperarm01R', 12],
  ['lowerarm01R', 14],
  ['wristR', 16],
  ['upperleg01L', 23],
  ['lowerleg01L', 25],
  ['footL', 27],
  ['upperleg01R', 24],
  ['lowerleg01R', 26],
  ['footR', 28],
] as const
function inventory(model: Object3D) {
  const rotations: Record<string, number[]> = {},
    transforms: Record<string, number[][]> = {}
  model.traverse((node) => {
    if ((node as Bone).isBone) {
      rotations[node.name] = node.quaternion.toArray()
      transforms[node.name] = [node.position.toArray(), node.scale.toArray()]
    }
  })
  return { rotations, transforms }
}
async function weights(model: Object3D) {
  const hashes: Promise<string>[] = []
  model.traverse((node) => {
    const mesh = node as SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    for (const name of [
      'skinWeight',
      'skinIndex',
      'skinWeight1',
      'skinIndex1',
      'weights_1',
      'joints_1',
    ]) {
      const attribute = mesh.geometry.getAttribute(name)
      if (!attribute) continue
      const a = attribute.array
      hashes.push(
        crypto.subtle
          .digest('SHA-256', new Uint8Array(a.buffer, a.byteOffset, a.byteLength).slice())
          .then((value) =>
            Array.from(new Uint8Array(value), (n) => n.toString(16).padStart(2, '0')).join(''),
          ),
      )
    }
  })
  return Promise.all(hashes)
}
export async function mountObservedTrunk(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const loaded = await new GLTFLoader().loadAsync(`/${gender}.glb`),
    sourceBefore = JSON.stringify(inventory(loaded.scene)),
    sourceWeights = JSON.stringify(await weights(loaded.scene)),
    abort = new AbortController()
  const lease = await prepareOwnedAvatarPair(
    { generation: 1, signal: abort.signal },
    {
      load: async () => loaded.scene,
      mirror: true,
      halfLifeMs: 50,
      maxAgeMs: 250,
      trunk: true,
    },
  )
  const suppliedModels = lease.models
  if (!suppliedModels) throw new Error('Fixture models unavailable')
  const models = suppliedModels
  const [reference, user] = models,
    referenceBefore = JSON.stringify(inventory(reference)),
    userBefore = inventory(user),
    weightsBefore = JSON.stringify(await weights(user)),
    scene = new Scene(),
    camera = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10),
    renderer = new WebGLRenderer({ canvas, antialias: true })
  scene.background = new Color('#ffffff')
  camera.position.set(0, 0.8, 4)
  camera.lookAt(0, 0.8, 0)
  renderer.setSize(1440, 900, false)
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  models.forEach((model, index) => {
    model.position.x = index === 0 ? -0.75 : 0.75
    scene.add(model)
  })
  const bone = (name: string) => {
    const node = user.getObjectByName(name) as Bone | undefined
    if (!node?.isBone) throw new Error('Fixture bone unavailable')
    return node
  }
  const rest = new Map(
      joints.map(([name, index]) => [index, bone(name).getWorldPosition(new Vector3())]),
    ),
    indexes = new Map<string, number>(joints)
  const leftHip = rest.get(23),
    rightHip = rest.get(24)
  if (!leftHip || !rightHip) throw new Error('Fixture hip unavailable')
  const hip = leftHip.clone().add(rightHip).multiplyScalar(0.5)
  let mode: Mode = 'side',
    sequence = 0,
    renderedFrames = 0,
    raf = 0,
    closed = false,
    previous = performance.now(),
    state = lease.render(0, 0),
    frozenTrunk = bone('spine05').quaternion.toArray().join(','),
    frozenPose = JSON.stringify(inventory(user).rotations)
  const expected = new Map<string, Vector3>()
  const direction = (from: string, to: string) => {
    user.updateWorldMatrix(true, true)
    return bone(to)
      .getWorldPosition(new Vector3())
      .sub(bone(from).getWorldPosition(new Vector3()))
      .normalize()
  }
  function result(): PoseRigFrame['result'] {
    const image = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })),
      world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 })),
      turn = new Quaternion().setFromAxisAngle(
        new Vector3(mode === 'forward' ? 1 : 0, 0, mode === 'forward' ? 0 : 1),
        mode === 'recover' ? -0.25 : 0.25,
      ),
      current = new Map<number, Vector3>()
    for (const [index, p] of rest) {
      const value = p.clone()
      if (index < 23) value.sub(hip).applyQuaternion(turn).add(hip)
      current.set(index, value)
      world[index] = { x: -value.x, y: -value.y, z: -value.z }
    }
    const shoulder = current
      .get(11)
      ?.clone()
      .add(current.get(12) ?? new Vector3())
      .multiplyScalar(0.5)
    if (!shoulder) throw new Error('Fixture shoulder unavailable')
    expected.set('spine05', shoulder.sub(hip).normalize())
    for (const binding of OBSERVED_LIMB_BINDINGS) {
      const a = current.get(indexes.get(binding.bone) ?? -1),
        b = current.get(indexes.get(binding.anchor) ?? -1)
      if (!a || !b) throw new Error('Fixture endpoints unavailable')
      expected.set(binding.bone, b.clone().sub(a).normalize())
    }
    if (mode === 'hidden') image[23].visibility = 0
    return {
      landmarks: mode === 'multiple' ? [image, image] : [image],
      worldLandmarks: mode === 'multiple' ? [world, world] : [world],
    }
  }
  function feed(now: number) {
    if (mode !== 'expired') {
      sequence++
      if (!lease.observe({ generation: 1, sequence, at: now, result: result() }))
        throw new Error('Fixture observation rejected')
    }
    state = lease.render(now, now - previous)
    previous = now
    renderer.render(scene, camera)
    renderedFrames++
  }
  feed(previous)
  function tick() {
    if (closed) return
    feed(performance.now())
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  function snapshot() {
    const current = inventory(user),
      stableNames = [
        'root',
        'pelvisL',
        'pelvisR',
        'spine04',
        'spine03',
        'spine02',
        'spine01',
        'neck01',
        'neck02',
        'neck03',
        'head',
      ],
      bindings = [...OBSERVED_LIMB_BINDINGS, OBSERVED_TRUNK_BINDING]
    return {
      state,
      mode,
      sequence,
      closed,
      sourceUnchanged: JSON.stringify(inventory(loaded.scene)) === sourceBefore,
      referenceUnchanged: JSON.stringify(inventory(reference)) === referenceBefore,
      positionsScalesPreserved:
        JSON.stringify(current.transforms) === JSON.stringify(userBefore.transforms),
      authoredAnatomyPreserved: stableNames.every(
        (name) =>
          current.rotations[name] !== undefined &&
          userBefore.rotations[name] !== undefined &&
          JSON.stringify(current.rotations[name]) === JSON.stringify(userBefore.rotations[name]),
      ),
      trunkChanged:
        JSON.stringify(current.rotations.spine05) !== JSON.stringify(userBefore.rotations.spine05),
      trunkFrozen: current.rotations.spine05.join(',') === frozenTrunk,
      poseFrozen: JSON.stringify(current.rotations) === frozenPose,
      maxDirectionError: Math.max(
        ...bindings.map((binding) =>
          direction(binding.bone, binding.anchor).angleTo(
            expected.get(binding.bone) ?? new Vector3(),
          ),
        ),
      ),
      fullBodyInside: models.every((model) => {
        const box = new Box3().setFromObject(model, true)
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              const q = new Vector3(x, y, z).project(camera)
              if (Math.abs(q.x) >= 1 || Math.abs(q.y) >= 1) return false
            }
        return true
      }),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }
  }
  return Object.freeze({
    peek: () => ({ sequence, state, mode, renderedFrames }),
    snapshot,
    markPose: () => {
      frozenPose = JSON.stringify(inventory(user).rotations)
      return renderedFrames
    },
    setMode(next: Mode) {
      mode = next
      frozenTrunk = bone('spine05').quaternion.toArray().join(',')
      frozenPose = JSON.stringify(inventory(user).rotations)
      feed(performance.now())
      return snapshot()
    },
    async preservedWeights() {
      return (
        weightsBefore === JSON.stringify(await weights(user)) &&
        sourceWeights === JSON.stringify(await weights(loaded.scene))
      )
    },
    close() {
      if (closed) return
      closed = true
      cancelAnimationFrame(raf)
      abort.abort()
      state = lease.render(performance.now(), 0)
      lease.dispose()
      renderer.dispose()
    },
  })
}
