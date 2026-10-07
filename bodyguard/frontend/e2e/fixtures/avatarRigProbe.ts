// FR-A-01/03/04·NFR-07: real GLB/Three rendering, synthetic limb directions only. No camera/API.
import {
  type Bone,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  Quaternion,
  Scene,
  type SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDirectionalRig } from '../../src/avatar/directionalRig'
import { cloneEightWeightPair } from '../../src/avatar/eightWeightSkin'

const bindings = [
  ['upperarm01L', 'lowerarm01L'],
  ['lowerarm01L', 'wristL'],
  ['upperarm01R', 'lowerarm01R'],
  ['lowerarm01R', 'wristR'],
  ['upperleg01L', 'lowerleg01L'],
  ['lowerleg01L', 'footL'],
  ['upperleg01R', 'lowerleg01R'],
  ['lowerleg01R', 'footR'],
].map(([bone, anchor]) => ({ bone, anchor }))

export async function mountRigProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const loaded = await new GLTFLoader().loadAsync(`/${gender}.glb`)
  const sourceTurns: number[][] = []
  loaded.scene.traverse((node) => {
    if ((node as Bone).isBone) sourceTurns.push(node.quaternion.toArray())
  })
  const pair = cloneEightWeightPair(loaded.scene)
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  // Canvas pixels are never read/exported by the product; this private synthetic fixture has no people.
  renderer.setSize(1440, 900, false)
  renderer.setPixelRatio(1)
  const camera = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  camera.position.set(0, 0.8, 4)
  camera.lookAt(0, 0.8, 0)
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  const aborts = pair.copies.map(() => new AbortController())
  const drivers = pair.copies.map((model, i) =>
    createDirectionalRig(model, {
      context: { generation: 1, signal: aborts[i].signal },
      bindings,
      halfLifeMs: 50,
      maxAgeMs: 250,
    }),
  )
  pair.copies.forEach((model, index) => {
    model.position.x = index === 0 ? -0.75 : 0.75
    scene.add(model)
  })
  const points = (index: number, bone: string, anchor: string) => {
    const a = pair.copies[index].getObjectByName(bone) as Bone
    const b = pair.copies[index].getObjectByName(anchor) as Bone
    pair.copies[index].updateMatrixWorld(true)
    return b.getWorldPosition(new Vector3()).sub(a.getWorldPosition(new Vector3())).normalize()
  }
  const restDirections = pair.copies.map((_, index) =>
    Object.fromEntries(bindings.map(({ bone, anchor }) => [bone, points(index, bone, anchor)])),
  )
  const bones = pair.copies.map((model) => {
    const list: Bone[] = []
    model.traverse((node) => {
      if ((node as Bone).isBone) list.push(node as Bone)
    })
    return list
  })
  if (bones[0].some((bone) => bones[1].includes(bone))) throw new Error('Shared avatar bones')
  let sequence = 0
  let handle = 0
  let closed = false
  const states = drivers.map((d) => d.render(0, 0))
  let maximumError = 0
  let moved = false
  let targets: Record<string, number[]>[] = []
  const pose = (angle: number) =>
    restDirections.map((directions, index) =>
      Object.fromEntries(
        Object.entries(directions).map(([name, direction]) => {
          const turn = new Quaternion().setFromAxisAngle(
            new Vector3(0, 0, 1),
            (index === 0 ? 1 : -1) * angle,
          )
          return [
            name,
            name === 'upperarm01L' || name === 'lowerarm01L'
              ? direction.clone().applyQuaternion(turn).toArray()
              : direction.toArray(),
          ]
        }),
      ),
    )
  function feed(angle: number, now: number) {
    targets = pose(angle)
    sequence++
    drivers.forEach((driver, index) => {
      if (!driver.push({ generation: 1, sequence, at: now, directions: targets[index] }))
        throw new Error('Rejected private frame')
      states[index] = driver.render(now, 16)
    })
  }
  feed(0, 0)
  renderer.render(scene, camera)
  let previous = performance.now()
  function frame(now: number) {
    if (closed) return
    const delta = now - previous
    previous = now
    if (moved) {
      const angle = ((Math.sin(now / 700) + 1) * Math.PI) / 36
      targets = pose(angle)
      sequence++
      drivers.forEach((driver, index) => {
        driver.push({ generation: 1, sequence, at: now, directions: targets[index] })
        states[index] = driver.render(now, delta)
      })
    }
    renderer.render(scene, camera)
    handle = requestAnimationFrame(frame)
  }
  handle = requestAnimationFrame(frame)
  function snapshot() {
    const currentSource: number[][] = []
    loaded.scene.traverse((node) => {
      if ((node as Bone).isBone) currentSource.push(node.quaternion.toArray())
    })
    const eightWeightMeshes: number[] = pair.copies.map((model) => {
      let count = 0
      model.traverse((node) => {
        if (
          (node as SkinnedMesh).isSkinnedMesh &&
          (node as SkinnedMesh).geometry.hasAttribute('skinWeight1')
        )
          count++
      })
      return count
    })
    const framing = pair.copies.map((model) => {
      const bounds = new Box3().setFromObject(model, true)
      const projected = []
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            projected.push(new Vector3(x, y, z).project(camera))
      return { inside: projected.every((point) => Math.abs(point.x) < 1 && Math.abs(point.y) < 1) }
    })
    return {
      framing,
      states,
      sourceUnchanged: JSON.stringify(sourceTurns) === JSON.stringify(currentSource),
      independent: true,
      eightWeightMeshes,
      sequence,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      maxDirectionError: maximumError,
      closed,
    }
  }
  function settle() {
    moved = false
    feed(Math.PI / 12, performance.now())
    const at = performance.now()
    drivers.forEach((driver, index) => {
      states[index] = driver.render(at, 500)
      for (const { bone, anchor } of bindings)
        maximumError = Math.max(
          maximumError,
          points(index, bone, anchor).angleTo(new Vector3(...targets[index][bone])),
        )
    })
    renderer.render(scene, camera)
    return snapshot()
  }
  return Object.freeze({
    snapshot,
    start: () => {
      moved = true
    },
    settle,
    close: () => {
      if (closed) return
      closed = true
      cancelAnimationFrame(handle)
      aborts.forEach((a) => {
        a.abort()
      })
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
