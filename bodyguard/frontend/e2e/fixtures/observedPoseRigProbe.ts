// FR-A-01/03·FR-M-07: actual GLB/GPU; generated paired points, no camera/SDK/clinical rule.
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
import { cloneEightWeightPair } from '../../src/avatar/eightWeightSkin'
import { createObservedPoseRig, type PoseRigFrame } from '../../src/avatar/observedPoseRig'
import type { Point } from '../../src/posture/landmarks'

type Mode = 'single' | 'crop' | 'multiple' | 'mismatch' | 'none' | 'recover' | 'expire'
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

export async function mountObservedRigProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const loaded = await new GLTFLoader().loadAsync(`/${gender}.glb`)
  const turns = (model: Object3D) => {
    const value: number[][] = []
    model.traverse((node) => {
      if ((node as Bone).isBone) value.push(node.quaternion.toArray())
    })
    return JSON.stringify(value)
  }
  const original = turns(loaded.scene)
  const pair = cloneEightWeightPair(loaded.scene)
  const [reference, user] = pair.copies
  const referenceRest = turns(reference)
  const abort = new AbortController()
  const adapter = createObservedPoseRig(user, {
    context: { generation: 1, signal: abort.signal },
    bindings: OBSERVED_LIMB_BINDINGS,
    halfLifeMs: 50,
    maxAgeMs: 250,
    mirror: true,
  })
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(1440, 900, false)
  renderer.setPixelRatio(1)
  const camera = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  camera.position.set(0, 0.8, 4)
  camera.lookAt(0, 0.8, 0)
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  pair.copies.forEach((model, index) => {
    model.position.x = index === 0 ? -0.75 : 0.75
    scene.add(model)
  })
  user.updateWorldMatrix(true, true)
  function userBone(name: string): Bone {
    const bone = user.getObjectByName(name) as Bone | undefined
    if (!bone?.isBone) throw new Error('Missing private fixture bone')
    return bone
  }
  const restPoints = new Map(
    joints.map(([name, index]) => [index, userBone(name).getWorldPosition(new Vector3())]),
  )
  const restShoulder = restPoints.get(11)
  const restElbow = restPoints.get(13)
  if (!restShoulder || !restElbow) throw new Error('Missing private fixture arm')
  const restArmDirection = restElbow.clone().sub(restShoulder).normalize()
  const bones = pair.copies.map((model) => {
    const value: Bone[] = []
    model.traverse((node) => {
      if ((node as Bone).isBone) value.push(node as Bone)
    })
    return value
  })
  const independent = bones[0].every((bone) => !bones[1].includes(bone))
  const legTurns = () =>
    JSON.stringify(
      ['upperleg01L', 'lowerleg01L', 'upperleg01R', 'lowerleg01R'].map((name) =>
        userBone(name).quaternion.toArray(),
      ),
    )
  let mode: Mode = 'single'
  let angle = 0
  let sequence = 0
  let handle = 0
  let closed = false
  let previous = performance.now()
  let lastCapture = -Infinity
  let captureRegressed = false
  let markedPose = turns(user)
  let markedLegs = legTurns()
  let state = adapter.render(0, 0)
  const expectedDirections = new Map<string, Vector3>()
  const pointIndex = new Map<string, number>(joints)
  function boneDirection(bone: string, anchor: string) {
    user.updateWorldMatrix(true, true)
    return userBone(anchor)
      .getWorldPosition(new Vector3())
      .sub(userBone(bone).getWorldPosition(new Vector3()))
      .normalize()
  }

  function result(): PoseRigFrame['result'] {
    const image: Point[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 1,
    }))
    const world: Point[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
    const origin = restPoints.get(11)
    if (!origin) throw new Error('Missing private fixture shoulder')
    const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle)
    const expectedPoints = new Map<number, Vector3>()
    for (const [index, rest] of restPoints) {
      const point = rest.clone()
      if (index === 13 || index === 15) point.sub(origin).applyQuaternion(turn).add(origin)
      expectedPoints.set(index, point)
      world[index] = { x: -point.x, y: -point.y, z: -point.z }
    }
    for (const { bone, anchor } of OBSERVED_LIMB_BINDINGS) {
      const from = expectedPoints.get(pointIndex.get(bone) ?? -1)
      const to = expectedPoints.get(pointIndex.get(anchor) ?? -1)
      if (!from || !to) throw new Error('Missing private fixture endpoint')
      expectedDirections.set(bone, to.clone().sub(from).normalize())
    }
    if (mode === 'crop') for (const index of [25, 26, 27, 28]) image[index].y = 2
    if (mode === 'none') return { landmarks: [], worldLandmarks: [] }
    if (mode === 'multiple') return { landmarks: [image, image], worldLandmarks: [world, world] }
    if (mode === 'mismatch') return { landmarks: [image], worldLandmarks: [world, world] }
    return { landmarks: [image], worldLandmarks: [world] }
  }
  function feed(now: number, delta: number) {
    if (mode !== 'expire') {
      sequence++
      captureRegressed ||= now < lastCapture
      lastCapture = now
      if (!adapter.observe({ generation: 1, sequence, at: now, result: result() }))
        throw new Error('Private pose observation rejected')
    }
    state = adapter.render(now, delta)
    renderer.render(scene, camera)
  }
  feed(previous, 0)
  function frame() {
    if (closed) return
    // A newly generated synthetic result uses its capture clock. RAF's frame-start timestamp
    // may predate an intervening setMode/performance.now capture; it is not a provider stamp.
    const now = performance.now()
    feed(now, now - previous)
    previous = now
    handle = requestAnimationFrame(frame)
  }
  handle = requestAnimationFrame(frame)
  function snapshot() {
    const framing = pair.copies.map((model) => {
      const bounds = new Box3().setFromObject(model, true)
      const projected: Vector3[] = []
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            projected.push(new Vector3(x, y, z).project(camera))
      return { inside: projected.every((point) => Math.abs(point.x) < 1 && Math.abs(point.y) < 1) }
    })
    return {
      mode,
      state,
      sequence,
      closed,
      independent,
      framing,
      referenceUnchanged: turns(reference) === referenceRest,
      sourceUnchanged: turns(loaded.scene) === original,
      userChanged: turns(user) !== markedPose,
      missingLegsFrozen: legTurns() === markedLegs,
      poseFrozen: turns(user) === markedPose,
      userArmMoved:
        boneDirection('upperarm01L', 'lowerarm01L').angleTo(restArmDirection) > Math.PI / 24,
      maxDirectionError: Math.max(
        ...OBSERVED_LIMB_BINDINGS.map(({ bone, anchor }) => {
          const expected = expectedDirections.get(bone)
          if (!expected) throw new Error('Missing private fixture direction')
          return boneDirection(bone, anchor).angleTo(expected)
        }),
      ),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }
  }
  function setMode(next: Mode) {
    if (closed) return snapshot()
    mode = next
    if (next === 'single') angle = Math.PI / 12
    if (next === 'recover') angle = -Math.PI / 12
    markedPose = turns(user)
    markedLegs = legTurns()
    const now = performance.now()
    feed(now, now - previous)
    previous = now
    return snapshot()
  }
  return Object.freeze({
    peek: () => ({ mode, state, sequence, closed, captureRegressed }),
    snapshot,
    setMode,
    close: () => {
      if (closed) return
      closed = true
      cancelAnimationFrame(handle)
      abort.abort()
      adapter.dispose()
      state = adapter.render(performance.now(), 0)
      pair.dispose()
      loaded.scene.traverse((node) => {
        if (!(node as SkinnedMesh).isSkinnedMesh) return
        const mesh = node as SkinnedMesh
        mesh.geometry.dispose()
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          material.dispose()
      })
      renderer.dispose()
    },
  })
}
