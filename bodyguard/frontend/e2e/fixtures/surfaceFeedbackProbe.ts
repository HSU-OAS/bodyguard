// FR-A-01/03·FR-M-07: authored avatar-only GPU readback, no camera/SDK/person data.
import {
  type Bone,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  type SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { PoseRigFrame } from '../../src/avatar/observedPoseRig'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import type { Point } from '../../src/posture/landmarks'

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
function turns(model: Object3D) {
  const values: number[][] = []
  model.traverse((node) => {
    if ((node as Bone).isBone) values.push(node.quaternion.toArray())
  })
  return JSON.stringify(values)
}
function attributes(model: Object3D) {
  const copies: {
    mesh: SkinnedMesh
    entries: [string, Uint8Array][]
    material: SkinnedMesh['material']
  }[] = []
  model.traverse((node) => {
    const mesh = node as SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    copies.push({
      mesh,
      entries: Object.entries(mesh.geometry.attributes).map(([name, value]) => [
        name,
        new Uint8Array(value.array.buffer, value.array.byteOffset, value.array.byteLength).slice(),
      ]),
      material: mesh.material,
    })
  })
  return () =>
    copies.every(
      ({ mesh, entries, material }) =>
        mesh.material === material &&
        Object.keys(mesh.geometry.attributes).length === entries.length &&
        entries.every(([name, bytes]) => {
          const value = mesh.geometry.getAttribute(name)
          if (!value) return false
          const actual = new Uint8Array(
            value.array.buffer,
            value.array.byteOffset,
            value.array.byteLength,
          )
          return actual.length === bytes.length && actual.every((value, i) => value === bytes[i])
        }),
    )
}
export async function mountSurfaceFeedbackProbe(
  canvas: HTMLCanvasElement,
  gender: 'male' | 'female',
) {
  const loaded = await new GLTFLoader().loadAsync(`/${gender}.glb`),
    sourceTurns = turns(loaded.scene),
    sourceSame = attributes(loaded.scene),
    abort = new AbortController()
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(1440, 900, false)
  renderer.setPixelRatio(1)
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  const camera = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  camera.position.set(0, 0.8, 4)
  camera.lookAt(0, 0.8, 0)
  const warm = new Mesh(new PlaneGeometry(0.01, 0.01), new MeshStandardMaterial())
  scene.add(warm)
  renderer.render(scene, camera)
  warm.removeFromParent()
  warm.geometry.dispose()
  warm.material.dispose()
  renderer.render(scene, camera)
  const baseline = { ...renderer.info.memory }
  const pair = await prepareOwnedAvatarPair(
    { generation: 1, signal: abort.signal },
    {
      load: async () => loaded.scene,
      mirror: true,
      halfLifeMs: 50,
      maxAgeMs: 250,
      feedback: {
        motionId: 'fixture-not-release',
        version: 'test',
        regions: [
          { id: 'arm-left', bones: ['upperarm01L'] },
          { id: 'leg-left', bones: ['upperleg01L'] },
        ],
      },
    },
  )
  const available = pair.models
  if (!available) throw new Error('Private surface fixture unavailable')
  const models = available
  const [reference, user] = models,
    referenceTurns = turns(reference),
    referenceSame = attributes(reference)
  reference.position.x = 0.75
  user.position.x = -0.75
  scene.add(reference, user)
  user.updateWorldMatrix(true, true)
  const rest = new Map(
    joints.map(([name, index]) => {
      const bone = user.getObjectByName(name) as Bone
      if (!bone?.isBone) throw new Error('Private surface fixture unavailable')
      return [index, bone.getWorldPosition(new Vector3())]
    }),
  )
  let sequence = 0,
    at = 100,
    now = 100,
    closed = false,
    state = pair.render(100, 0),
    lastAccepted = false
  function result(mode: string): PoseRigFrame['result'] {
    const image: Point[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 1,
      })),
      world: Point[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
    const origin = rest.get(11)
    if (!origin) throw new Error('Private surface fixture unavailable')
    const rotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      mode === 'moved' ? 0.35 : 0,
    )
    for (const [index, position] of rest) {
      const point = position.clone()
      if (index === 13 || index === 15) point.sub(origin).applyQuaternion(rotation).add(origin)
      world[index] = { x: -point.x, y: -point.y, z: -point.z }
    }
    if (mode === 'crop') image[13].y = 2
    if (mode === 'none') return { landmarks: [], worldLandmarks: [] }
    if (mode === 'multiple') return { landmarks: [image, image], worldLandmarks: [world, world] }
    return { landmarks: [image], worldLandmarks: [world] }
  }
  function feed(
    mode: string,
    severity: 'attention' | 'deviation' = 'deviation',
    regionId = 'arm-left',
  ) {
    sequence++
    at += 20
    now = at
    if (!pair.observe({ generation: 1, sequence, at, result: result(mode) }))
      throw new Error('Private surface observation rejected')
    lastAccepted = pair.updateFeedback({
      generation: 1,
      sequence,
      at,
      motionId: 'fixture-not-release',
      version: 'test',
      errors: mode === 'neutral' ? [] : [{ regionId, severity }],
    })
    state = pair.render(now, 20)
    renderer.render(scene, camera)
    return snapshot()
  }
  function pixels() {
    // Explicit test-only readback of authored mannequins. Export counts only, never pixels/pose.
    const gl = renderer.getContext(),
      bytes = new Uint8Array(1440 * 900 * 4)
    gl.readPixels(0, 0, 1440, 900, gl.RGBA, gl.UNSIGNED_BYTE, bytes)
    let left = 0,
      right = 0
    for (let pixel = 0; pixel < 1440 * 900; pixel++) {
      const i = pixel * 4
      if (bytes[i] > bytes[i + 1] + 10 && bytes[i] > bytes[i + 2] + 5) {
        if (pixel % 1440 < 720) left++
        else right++
      }
    }
    return { left, right, error: gl.getError() }
  }
  function snapshot() {
    const framing = models.map((model) => {
      const bounds = new Box3().setFromObject(model, true)
      const projected: Vector3[] = []
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            projected.push(new Vector3(x, y, z).project(camera))
      return projected.every((p) => Math.abs(p.x) < 1 && Math.abs(p.y) < 1)
    })
    return {
      closed,
      state,
      lastAccepted,
      sourceUnchanged: sourceSame() && turns(loaded.scene) === sourceTurns,
      referenceUnchanged: referenceSame() && turns(reference) === referenceTurns,
      userMoved: turns(user) !== referenceTurns,
      framing,
      redPixels: pixels(),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      memory: { ...renderer.info.memory },
      baseline,
    }
  }
  renderer.render(scene, camera)
  return Object.freeze({
    snapshot,
    feed,
    expire: () => {
      now = at + 251
      state = pair.render(now, 251)
      renderer.render(scene, camera)
      return snapshot()
    },
    recover: () => {
      at = now
      return feed('moved')
    },
    old: () => {
      lastAccepted = pair.updateFeedback({
        generation: 0,
        sequence,
        at,
        motionId: 'fixture-not-release',
        version: 'test',
        errors: [{ regionId: 'arm-left', severity: 'deviation' }],
      })
      return snapshot()
    },
    close: () => {
      if (!closed) {
        closed = true
        abort.abort()
        pair.dispose()
        state = pair.render(now, 0)
        renderer.render(scene, camera)
      }
      return snapshot()
    },
    disposeRenderer: () => renderer.dispose(),
  })
}
