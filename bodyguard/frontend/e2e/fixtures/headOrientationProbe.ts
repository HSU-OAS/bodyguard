// FR-A-01/03·FR-M-02/07: private synthetic input and existing incomplete GLB, no camera/API.
import {
  type Bone,
  Box3,
  Color,
  DirectionalLight,
  Euler,
  HemisphereLight,
  Matrix4,
  OrthographicCamera,
  Quaternion,
  Scene,
  type SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { cloneEightWeightPair } from '../../src/avatar/eightWeightSkin'
import { createHeadOrientationRig } from '../../src/avatar/headOrientationRig'

function bones(model: Scene | ReturnType<typeof cloneEightWeightPair>['copies'][number]) {
  const values: Record<string, { position: number[]; scale: number[]; rotation: number[] }> = {}
  model.traverse((node) => {
    if ((node as Bone).isBone)
      values[node.name] = {
        position: node.position.toArray(),
        scale: node.scale.toArray(),
        rotation: node.quaternion.toArray(),
      }
  })
  return values
}
async function weights(model: Parameters<typeof cloneEightWeightPair>[0]) {
  const values: Array<Promise<string>> = []
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
      const array = attribute.array
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength).slice()
      values.push(
        crypto.subtle
          .digest('SHA-256', bytes)
          .then((b) => [...new Uint8Array(b)].map((n) => n.toString(16).padStart(2, '0')).join('')),
      )
    }
  })
  return Promise.all(values)
}
export async function mountHeadProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const loaded = await new GLTFLoader().loadAsync(`/${gender}.glb`)
  const sourceBones = JSON.stringify(bones(loaded.scene))
  const sourceWeights = JSON.stringify(await weights(loaded.scene))
  const pair = cloneEightWeightPair(loaded.scene)
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(1440, 900, false)
  const camera = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  camera.position.set(0, 0.8, 4)
  camera.lookAt(0, 0.8, 0)
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  pair.copies.forEach((model, i) => {
    model.position.x = i === 0 ? -0.75 : 0.75
    scene.add(model)
  })
  const before = pair.copies.map((model) => bones(model))
  const beforeWeights = await Promise.all(pair.copies.map(weights))
  const aborts = pair.copies.map(() => new AbortController())
  const drivers = pair.copies.map((model, i) =>
    createHeadOrientationRig(model, {
      context: { generation: 1, signal: aborts[i].signal },
      bone: 'head',
      matrixLayout: 'column-major',
      mirror: false,
      cameraReference: [0, 0, 0, 1],
      sceneFromCamera: [0, 0, 0, 1],
      halfLifeMs: 50,
      maxAgeMs: 250,
    }),
  )
  const heads = pair.copies.map((model) => model.getObjectByName('head') as Bone)
  // Three's decomposition under Float32 scale noise can return a non-unit quaternion.
  // Normalize measurement quaternions for angle comparisons; authored scales stay unchanged.
  const rest = heads.map((head) => head.getWorldQuaternion(new Quaternion()).normalize())
  const target = [new Euler(0.18, 0.4, 0.2), new Euler(-0.15, -0.3, -0.18)].map((e) =>
    new Quaternion().setFromEuler(e),
  )
  const face = (q: Quaternion) => ({
    faceLandmarks: [Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))],
    facialTransformationMatrixes: [
      {
        rows: 4,
        columns: 4,
        data: new Matrix4().compose(new Vector3(), q, new Vector3(1, 1, 1)).toArray(),
      },
    ],
  })
  let sequence = 0,
    frames = 0,
    handle = 0,
    closed = false,
    moving = false,
    last = performance.now()
  const states = drivers.map((d) => d.render(0, 0))
  function feed(now: number, delta: number) {
    sequence++
    drivers.forEach((d, i) => {
      if (
        !d.push({
          generation: 1,
          sequence,
          at: now,
          result: face(moving ? target[i] : new Quaternion()),
        })
      )
        throw new Error('Private head frame rejected')
      states[i] = d.render(now, delta)
    })
    renderer.render(scene, camera)
  }
  feed(last, 0)
  function tick(now: number) {
    if (closed) return
    // A queued RAF timestamp can precede the long GLB setup's initial observation.
    // Skip that tick; never re-stamp the older frame as fresh or stop the animation.
    if (now <= last) {
      handle = requestAnimationFrame(tick)
      return
    }
    feed(now, now - last)
    last = now
    frames++
    handle = requestAnimationFrame(tick)
  }
  handle = requestAnimationFrame(tick)
  async function snapshot() {
    const current = pair.copies.map((model) => bones(model))
    return {
      frames,
      closed,
      states,
      sourceUnchanged:
        sourceBones === JSON.stringify(bones(loaded.scene)) &&
        sourceWeights === JSON.stringify(await weights(loaded.scene)),
      otherBonesUnchanged: current.every((list, i) =>
        Object.entries(list).every(([name, value]) =>
          name === 'head'
            ? JSON.stringify([value.position, value.scale]) ===
              JSON.stringify([before[i][name].position, before[i][name].scale])
            : JSON.stringify(value) === JSON.stringify(before[i][name]),
        ),
      ),
      weightsUnchanged:
        JSON.stringify(beforeWeights) ===
        JSON.stringify(await Promise.all(pair.copies.map(weights))),
      independent:
        heads[0] !== heads[1] &&
        pair.copies[0].getObjectByName('neck01') !== pair.copies[1].getObjectByName('neck01'),
      errors: heads.map((head, i) =>
        head
          .getWorldQuaternion(new Quaternion())
          .normalize()
          .angleTo((moving ? target[i] : new Quaternion()).clone().multiply(rest[i]).normalize()),
      ),
      framing: pair.copies.map((model) => {
        const b = new Box3().setFromObject(model, true),
          points: Vector3[] = []
        for (const x of [b.min.x, b.max.x])
          for (const y of [b.min.y, b.max.y])
            for (const z of [b.min.z, b.max.z]) points.push(new Vector3(x, y, z).project(camera))
        return points.every((p) => Math.abs(p.x) < 1 && Math.abs(p.y) < 1)
      }),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }
  }
  return Object.freeze({
    snapshot,
    ready: () =>
      frames >= 60 &&
      heads.every(
        (head, i) =>
          head
            .getWorldQuaternion(new Quaternion())
            .normalize()
            .angleTo(target[i].clone().multiply(rest[i]).normalize()) < 0.0001,
      ),
    start: () => {
      moving = true
    },
    revoke: async () => {
      cancelAnimationFrame(handle)
      const frozen = heads.map((head) => head.quaternion.toArray()),
        now = performance.now()
      sequence++
      drivers.forEach((d, i) => {
        d.push({ generation: 1, sequence, at: now, result: null })
        states[i] = d.render(now, 16)
      })
      renderer.render(scene, camera)
      return {
        states,
        frozen:
          JSON.stringify(frozen) === JSON.stringify(heads.map((head) => head.quaternion.toArray())),
      }
    },
    close: () => {
      if (closed) return
      closed = true
      cancelAnimationFrame(handle)
      aborts.forEach((a) => {
        a.abort()
      })
      drivers.forEach((d) => {
        d.dispose()
      })
      const stopped = drivers.map((d) => d.render(performance.now(), 16))
      pair.dispose()
      loaded.scene.traverse((node) => {
        const mesh = node as SkinnedMesh
        if (!mesh.isSkinnedMesh) return
        mesh.skeleton.dispose()
        mesh.geometry.dispose()
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose()
      })
      renderer.dispose()
      return stopped
    },
  })
}
