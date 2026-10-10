// FR-A-01/02/03·FR-M-07: real GLB/WebGL ownership, synthetic ports/points; not clinical readiness.
import {
  Bone,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  type Material,
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
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import { createResourceController, type ResourceNotice } from '../../src/coaching/resources'
import type { Point } from '../../src/posture/landmarks'

type Mode = 'valid' | 'invalid' | 'late' | 'late-cleanup-fault'
type Lease = Awaited<ReturnType<typeof prepareOwnedAvatarPair>>
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

export async function mountOwnedAvatarProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(1440, 900, false)
  renderer.setPixelRatio(1)
  const camera = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  camera.position.set(0, 0.8, 4)
  camera.lookAt(0, 0.8, 0)
  // Calibrate the caller-owned renderer's PBR LUT before loading any avatar. This plane
  // is not an avatar or preview; its own geometry/material are immediately reclaimed.
  const calibration = new Mesh(new PlaneGeometry(0.01, 0.01), new MeshStandardMaterial())
  scene.add(calibration)
  renderer.render(scene, camera)
  calibration.removeFromParent()
  calibration.geometry.dispose()
  calibration.material.dispose()
  renderer.render(scene, camera)
  const rendererBaseline = { ...renderer.info.memory }
  const turns = (model: Object3D) => {
    const values: number[][] = []
    model.traverse((node) => {
      if ((node as Bone).isBone) values.push(node.quaternion.toArray())
    })
    return JSON.stringify(values)
  }
  const records: {
    generation: number
    mode: Mode
    geometry: number
    material: number
    skeleton: number
    geometryTotal: number
    materialTotal: number
    skeletonTotal: number
    unchanged(): boolean
  }[] = []
  const notices: ResourceNotice[] = []
  const fakeDisposed = { camera: 0, inference: 0 }
  let generation = 0,
    sequence = 0,
    mode: Mode = 'valid',
    closed = false
  let active: Lease | undefined, reference: Object3D | undefined, user: Object3D | undefined
  let restReference = '',
    restUser = '',
    independent = false
  let state = { status: 'untracked', tracked: 0, total: 8 }
  let lateReady = false,
    finish: (() => void) | undefined,
    pending: Promise<void> | undefined
  let releaseEvent = false,
    clonesReleased = 0,
    cloneTotal = 0
  const restPoints = new Map<number, Vector3>()
  const controller = createResourceController(
    {
      camera: async () => ({
        dispose() {
          fakeDisposed.camera++
        },
      }),
      inference: async () => ({
        dispose() {
          fakeDisposed.inference++
        },
      }),
      avatars: async (context) => {
        const selected = mode
        const lease = await prepareOwnedAvatarPair(context, {
          mirror: true,
          halfLifeMs: 50,
          maxAgeMs: 250,
          load: async () => {
            const source = (await new GLTFLoader().loadAsync(`/${gender}.glb`)).scene
            const original = turns(source)
            const geometries = new Set<SkinnedMesh['geometry']>(),
              materials = new Set<Material>(),
              skeletons = new Set<SkinnedMesh['skeleton']>()
            source.traverse((node) => {
              const mesh = node as SkinnedMesh
              if (!mesh.isMesh) return
              geometries.add(mesh.geometry)
              for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
                materials.add(material)
              if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton)
            })
            const record = {
              generation: context.generation,
              mode: selected,
              geometry: 0,
              material: 0,
              skeleton: 0,
              geometryTotal: geometries.size,
              materialTotal: materials.size,
              skeletonTotal: skeletons.size,
              unchanged: () => turns(source) === original,
            }
            records.push(record)
            for (const geometry of geometries)
              geometry.addEventListener('dispose', () => {
                record.geometry++
              })
            for (const material of materials)
              material.addEventListener('dispose', () => {
                record.material++
              })
            for (const skeleton of skeletons) {
              skeleton.computeBoneTexture()
              skeleton.boneTexture?.addEventListener('dispose', () => {
                record.skeleton++
              })
            }
            if (selected === 'invalid') {
              const duplicate = new Bone()
              duplicate.name = 'footL'
              source.add(duplicate)
            }
            if (selected === 'late' || selected === 'late-cleanup-fault') {
              if (selected === 'late-cleanup-fault')
                for (const geometry of geometries)
                  geometry.addEventListener('dispose', () => {
                    throw new Error('PRIVATE_DISPOSE_ERROR')
                  })
              await new Promise<void>((resolve) => {
                finish = resolve
                lateReady = true
              })
            }
            return source
          },
        })
        active = lease
        const models = lease.models
        if (!models) throw new Error('Private avatar pair rejected')
        ;[reference, user] = models
        restReference = turns(reference)
        restUser = turns(user)
        const allBones = models.map((model) => {
          const bones = new Set<Object3D>()
          model.traverse((node) => {
            if ((node as Bone).isBone) bones.add(node)
          })
          return bones
        })
        independent = [...allBones[0]].every((bone) => !allBones[1].has(bone))
        const geometries = new Set<SkinnedMesh['geometry']>(),
          materials = new Set<Material>(),
          skeletons = new Set<SkinnedMesh['skeleton']>()
        for (const [index, model] of models.entries()) {
          model.position.x = index === 0 ? -0.75 : 0.75
          scene.add(model)
          model.traverse((node) => {
            const mesh = node as SkinnedMesh
            if (!mesh.isSkinnedMesh) return
            geometries.add(mesh.geometry)
            for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
              materials.add(mat)
            if (mesh.customDepthMaterial) materials.add(mesh.customDepthMaterial)
            skeletons.add(mesh.skeleton)
          })
        }
        for (const resource of [...geometries, ...materials]) {
          cloneTotal++
          resource.addEventListener('dispose', () => {
            clonesReleased++
          })
        }
        for (const skeleton of skeletons) {
          skeleton.computeBoneTexture()
          cloneTotal++
          skeleton.boneTexture?.addEventListener('dispose', () => {
            clonesReleased++
          })
        }
        user.updateWorldMatrix(true, true)
        restPoints.clear()
        for (const [name, index] of joints) {
          const bone = user.getObjectByName(name)
          if (!bone) throw new Error('Private avatar pair rejected')
          restPoints.set(index, bone.getWorldPosition(new Vector3()))
        }
        state = lease.render(performance.now(), 0)
        renderer.render(scene, camera)
        return lease
      },
    },
    (notice) => {
      notices.push(notice)
    },
  )
  function snapshot() {
    const models = active?.models
    const framing =
      models?.map((model) => {
        const bounds = new Box3().setFromObject(model, true)
        const points: Vector3[] = []
        for (const x of [bounds.min.x, bounds.max.x])
          for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z])
              points.push(new Vector3(x, y, z).project(camera))
        return points.every((point) => Math.abs(point.x) < 1 && Math.abs(point.y) < 1)
      }) ?? []
    return {
      gender,
      generation,
      closed,
      lateReady,
      models: models?.length ?? 0,
      independent,
      framing,
      state,
      userChanged: !!user && turns(user) !== restUser,
      referenceUnchanged: !!reference && turns(reference) === restReference,
      attached: scene.children.filter((child) => child === reference || child === user).length,
      sources: records.map(({ unchanged, ...record }) => ({ ...record, unchanged: unchanged() })),
      notices,
      fakeDisposed,
      clonesReleased,
      cloneTotal,
      releaseEvent,
      memory: { ...renderer.info.memory },
      rendererBaseline,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }
  }
  async function request(next: Mode = 'valid') {
    if (closed) return snapshot()
    mode = next
    generation++
    await controller.run({ type: 'request-camera', generation })
    state = active?.render(performance.now(), 0) ?? state
    renderer.render(scene, camera)
    return snapshot()
  }
  function move() {
    if (!active?.models) return snapshot()
    const image: Point[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 1,
    }))
    const world: Point[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
    const origin = restPoints.get(11)
    if (!origin) throw new Error('Private avatar pair rejected')
    const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 12)
    for (const [index, rest] of restPoints) {
      const point = rest.clone()
      if (index === 13 || index === 15) point.sub(origin).applyQuaternion(turn).add(origin)
      world[index] = { x: -point.x, y: -point.y, z: -point.z }
    }
    sequence++
    const now = performance.now()
    if (
      !active.observe({
        generation,
        sequence,
        at: now,
        result: { landmarks: [image], worldLandmarks: [world] },
      })
    )
      throw new Error('Private avatar pair rejected')
    state = active.render(now, 0)
    renderer.render(scene, camera)
    return snapshot()
  }
  await request()
  return Object.freeze({
    snapshot,
    request,
    move,
    startLate: (fault = false) => {
      lateReady = false
      pending = request(fault ? 'late-cleanup-fault' : 'late').then(() => {})
      return snapshot()
    },
    finishLate: async () => {
      finish?.()
      await pending
      return snapshot()
    },
    release: async () => {
      await controller.run({ type: 'release-resources', generation })
      releaseEvent = true
      state = active?.render(performance.now(), 0) ?? state
      renderer.render(scene, camera)
      return snapshot()
    },
    close: async () => {
      closed = true
      await controller.close()
      state = active?.render(performance.now(), 0) ?? state
      renderer.render(scene, camera)
      renderer.dispose()
      return snapshot()
    },
  })
}
