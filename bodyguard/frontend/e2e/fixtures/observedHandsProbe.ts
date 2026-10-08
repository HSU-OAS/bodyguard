// Actual owned A37 GLB/WebGL, explicitly generated observations; no camera or SDK.
import {
  type Bone,
  Color,
  DirectionalLight,
  HemisphereLight,
  Matrix4,
  type Object3D,
  OrthographicCamera,
  Quaternion,
  Scene,
  type SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HAND_RIG_BINDINGS, type HandObservation } from '../../src/avatar/observedHandRig'
import type { PoseRigFrame } from '../../src/avatar/observedPoseRig'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'

type Mode =
  | 'open'
  | 'bend'
  | 'turn'
  | 'tip-crop'
  | 'one'
  | 'none'
  | 'duplicate'
  | 'palm-crop'
  | 'body-multiple'
  | 'expire'
type Lengths = Record<string, number>
const sides = ['left', 'right'] as const
export async function mountHandsProbe(
  canvas: HTMLCanvasElement,
  gender: 'male' | 'female',
  lengths: Lengths,
) {
  const loaded = await new GLTFLoader().loadAsync(`/${gender}.glb`)
  loaded.scene.updateWorldMatrix(true, true)
  function bone(model: Object3D, name: string): Bone {
    const value = model.getObjectByName(name) as Bone | undefined
    if (!value?.isBone) throw new Error('Private hand fixture unavailable')
    return value
  }
  const allBones = (model: Object3D) => {
    const values: Bone[] = []
    model.traverse((n) => {
      if ((n as Bone).isBone) values.push(n as Bone)
    })
    return values
  }
  const shape = (model: Object3D) =>
    JSON.stringify(allBones(model).map((b) => [b.name, b.position.toArray(), b.scale.toArray()]))
  const turns = (model: Object3D) =>
    JSON.stringify(allBones(model).map((b) => b.quaternion.toArray()))
  const original = turns(loaded.scene),
    originalShape = shape(loaded.scene)
  const rests = new Map<string, Vector3>(),
    wristRest = new Map<string, Quaternion>()
  const restHands = sides.map((side) => {
    const suffix = side === 'left' ? 'L' : 'R',
      wrist = bone(loaded.scene, `wrist${suffix}`)
    wristRest.set(side, wrist.getWorldQuaternion(new Quaternion()).normalize())
    const points = Array.from({ length: 21 }, () => new Vector3())
    points[0] = wrist.getWorldPosition(new Vector3())
    for (const binding of HAND_RIG_BINDINGS.filter((b) => b.side === side)) {
      const segment = bone(loaded.scene, binding.bone)
      points[binding.from] = segment.getWorldPosition(new Vector3())
      if (binding.to % 4 === 0) {
        const name = binding.bone.replace(/([LR])$/, '.$1'),
          length = lengths[name]
        if (!Number.isFinite(length) || length <= 0)
          throw new Error('Private authored hand length unavailable')
        points[binding.to] = new Vector3(0, length, 0).applyMatrix4(segment.matrixWorld)
      }
    }
    return { side, points }
  })
  const palm = (points: readonly Vector3[]) => {
    const y = points[9].clone().sub(points[0]).normalize()
    const z = points[5].clone().sub(points[17]).cross(y).normalize(),
      x = y.clone().cross(z).normalize()
    return new Quaternion()
      .setFromRotationMatrix(new Matrix4().makeBasis(x, y, z))
      .normalize()
      .toArray()
  }
  const references = Object.fromEntries(restHands.map((h) => [h.side, palm(h.points)])) as Record<
    'left' | 'right',
    number[]
  >
  const abort = new AbortController()
  const lease = await prepareOwnedAvatarPair(
    { generation: 1, signal: abort.signal },
    {
      load: () => loaded.scene,
      mirror: false,
      halfLifeMs: 30,
      maxAgeMs: 250,
      hands: { cameraReferences: references, sceneFromCamera: [0, 0, 0, 1] },
      head: { bone: 'head', cameraReference: [0, 0, 0, 1], sceneFromCamera: [0, 0, 0, 1] },
    },
  )
  const models = lease.models
  if (!models) throw new Error('Private owned hand models unavailable')
  const [reference, user] = models,
    referenceRest = turns(reference),
    userShape = shape(user)
  const handNames = new Set([...HAND_RIG_BINDINGS.map((b) => b.bone), 'wristL', 'wristR'])
  const handTurns = () =>
    JSON.stringify(
      allBones(user)
        .filter((b) => handNames.has(b.name))
        .map((b) => b.quaternion.toArray()),
    )
  const distalTurns = () =>
    JSON.stringify(
      HAND_RIG_BINDINGS.filter((b) => b.to % 4 === 0).map((b) =>
        bone(user, b.bone).quaternion.toArray(),
      ),
    )
  const boneIndex = new Map([
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
  ] as const)
  for (const [name] of boneIndex)
    rests.set(name, bone(loaded.scene, name).getWorldPosition(new Vector3()))
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(1440, 900, false)
  const camera = new OrthographicCamera(-1.65, 1.65, 1.05, -1.05, 0.1, 10)
  camera.position.set(0, 0.85, 4)
  camera.lookAt(0, 0.85, 0)
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  models.forEach((m, i) => {
    m.position.x = i ? 0.75 : -0.75
    scene.add(m)
  })
  let ticks = 0
  let mode: Mode = 'open',
    sequence = 0,
    closed = false,
    handle = 0,
    marked = '',
    previous = performance.now()
  let state = lease.render(0, 0),
    bendBaseline = '',
    distalBaseline = ''
  let expected = new Map<string, Vector3>(),
    expectedWrist = new Map<string, Quaternion>()
  function result(): PoseRigFrame['result'] {
    const image = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
    const world = image.map(() => ({ x: 0, y: 0, z: 0 }))
    for (const [name, index] of boneIndex) {
      const p = rests.get(name)
      if (!p) throw new Error('Private body fixture unavailable')
      world[index] = { x: p.x, y: -p.y, z: -p.z }
    }
    const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), mode === 'turn' ? 0.45 : 0)
    const bend = mode === 'bend' ? 0.35 : 0
    expected = new Map()
    expectedWrist = new Map()
    let hands: HandObservation[] = restHands.map(({ side, points }) => {
      const moved = points.map((p) => p.clone()),
        origin = points[0]
      for (let digit = 0; digit < 5; digit++) {
        const base = 1 + digit * 4
        moved[base].sub(origin).applyQuaternion(turn).add(origin)
        for (let joint = 1; joint <= 3; joint++) {
          const direction = points[base + joint].clone().sub(points[base + joint - 1])
          direction
            .applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), bend * joint))
            .applyQuaternion(turn)
          moved[base + joint].copy(moved[base + joint - 1]).add(direction)
        }
      }
      for (const b of HAND_RIG_BINDINGS.filter((b) => b.side === side))
        expected.set(b.bone, moved[b.to].clone().sub(moved[b.from]).normalize())
      const wrist = wristRest.get(side)
      if (!wrist) throw new Error('Private wrist unavailable')
      expectedWrist.set(side, turn.clone().multiply(wrist))
      const landmarks = moved.map(() => ({ x: 0.5, y: 0.5, z: 0 }))
      if (mode === 'tip-crop' && side === 'left') landmarks[4].x = 2
      if (mode === 'palm-crop') landmarks[0].x = 2
      return { side, landmarks, worldLandmarks: moved.map((p) => ({ x: p.x, y: -p.y, z: -p.z })) }
    })
    if (mode === 'none') hands = []
    if (mode === 'one') hands = hands.slice(0, 1)
    if (mode === 'duplicate') hands = [hands[0], hands[0]]
    return {
      landmarks: mode === 'body-multiple' ? [image, image] : [image],
      worldLandmarks: mode === 'body-multiple' ? [world, world] : [world],
      headOrientation: [0, 0, 0, 1],
      hands,
    }
  }
  function feed(now: number, delta: number) {
    ticks++
    if (mode !== 'expire') {
      sequence++
      if (!lease.observe({ generation: 1, sequence, at: now, result: result() }))
        throw new Error('Private hand frame rejected')
    }
    state = lease.render(now, delta)
    renderer.render(scene, camera)
  }
  feed(previous, 0)
  bendBaseline = handTurns()
  distalBaseline = distalTurns()
  function frame() {
    if (closed) return
    const now = performance.now()
    feed(now, now - previous)
    previous = now
    handle = requestAnimationFrame(frame)
  }
  handle = requestAnimationFrame(frame)
  function snapshot() {
    user.updateWorldMatrix(true, true)
    let maxDirectionError = 0,
      maxWristError = 0
    for (const binding of HAND_RIG_BINDINGS) {
      if (
        (mode === 'tip-crop' && binding.bone === 'finger1-3L') ||
        (mode === 'one' && binding.side === 'right')
      )
        continue
      const actual = new Vector3(0, 1, 0).applyQuaternion(
        bone(user, binding.bone).getWorldQuaternion(new Quaternion()).normalize(),
      )
      const direction = expected.get(binding.bone)
      if (direction) maxDirectionError = Math.max(maxDirectionError, actual.distanceTo(direction))
    }
    for (const side of sides) {
      if (mode === 'one' && side === 'right') continue
      const expectedRotation = expectedWrist.get(side),
        actual = bone(user, side === 'left' ? 'wristL' : 'wristR')
          .getWorldQuaternion(new Quaternion())
          .normalize()
      if (expectedRotation)
        maxWristError = Math.max(maxWristError, actual.angleTo(expectedRotation))
    }
    const framing = models.map((model) => {
      const ends = ['head', 'footL', 'footR'].map((name) =>
        bone(model, name).getWorldPosition(new Vector3()).project(camera),
      )
      return ends.every((p) => Math.abs(p.x) < 1 && Math.abs(p.y) < 1)
    })
    const eightWeights = models.every((m) => {
      let found = 0
      m.traverse((n) => {
        const mesh = n as SkinnedMesh
        if (
          mesh.isSkinnedMesh &&
          mesh.geometry.getAttribute('skinIndex1') &&
          mesh.geometry.getAttribute('skinWeight1')
        )
          found++
      })
      return found > 0
    })
    return {
      mode,
      ticks,
      sequence,
      state,
      independent: allBones(reference).every((b) => !allBones(user).includes(b)),
      sourceUnchanged: turns(loaded.scene) === original && shape(loaded.scene) === originalShape,
      referenceUnchanged: turns(reference) === referenceRest,
      shapeUnchanged: shape(user) === userShape,
      handMoved: handTurns() !== bendBaseline,
      distalMoved: distalTurns() !== distalBaseline,
      freeze: handTurns() === marked,
      maxDirectionError,
      maxWristError,
      framing,
      eightWeights,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      synthetic: true,
      actualCamera: false,
      actualSDK: false,
      releaseAvatar: false,
    }
  }
  return Object.freeze({
    snapshot,
    markFrozen() {
      marked = handTurns()
      return { ticks }
    },
    setMode(next: Mode) {
      if (closed) throw new Error('Private hand probe closed')
      mode = next
      marked = handTurns()
      const now = performance.now()
      feed(now, 0)
      previous = now
      return { sequence }
    },
    close() {
      if (closed) return
      closed = true
      cancelAnimationFrame(handle)
      abort.abort()
      lease.dispose()
      state = lease.render(performance.now(), 0)
      renderer.dispose()
    },
  })
}
