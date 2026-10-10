// FR-S-03/04, FR-A-01/02: private A37 + Blender fixture, no webcam/SDK/approved motion.
import {
  AnimationClip,
  type Bone,
  Color,
  DirectionalLight,
  HemisphereLight,
  type Object3D,
  OrthographicCamera,
  Quaternion,
  QuaternionKeyframeTrack,
  Scene,
  type SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import type { ReferenceCue, ReferenceProgram } from '../../src/avatar/referencePlayback'

type Sample = Readonly<{ seconds: number; bones: Record<string, readonly number[]> }>
type Authored = Readonly<{
  gender: string
  phases: Record<ReferenceCue['phase'], readonly Sample[]>
}>
export async function mountReferenceProbe(
  canvas: HTMLCanvasElement,
  gender: 'male' | 'female',
  authored: Authored,
) {
  if (authored.gender !== gender) throw new Error('Private reference fixture unavailable')
  const loaded = await new GLTFLoader().loadAsync(`/${gender}.glb`)
  function bone(model: Object3D, name: string) {
    const node = model.getObjectByName(name) as Bone | undefined
    if (!node?.isBone) throw new Error('Private reference fixture unavailable')
    return node
  }
  const bones = (model: Object3D) => {
    const list: Bone[] = []
    model.traverse((n) => {
      if ((n as Bone).isBone) list.push(n as Bone)
    })
    return list
  }
  const turns = (model: Object3D) => JSON.stringify(bones(model).map((b) => b.quaternion.toArray()))
  const shape = (model: Object3D) =>
    JSON.stringify(bones(model).map((b) => [b.position.toArray(), b.scale.toArray()]))
  const original = turns(loaded.scene),
    originalShape = shape(loaded.scene)
  const clips = Object.fromEntries(
    Object.entries(authored.phases).map(([phase, samples]) => {
      const tracks = Object.keys(samples[0].bones).map((raw) => {
        const name = raw.replaceAll('.', ''),
          rest = bone(loaded.scene, name).quaternion.clone()
        const values = samples.flatMap((sample) => {
          const basis = sample.bones[raw]
          if (basis?.length !== 4) throw new Error('Private reference fixture unavailable')
          return rest
            .clone()
            .multiply(new Quaternion().fromArray(basis).normalize())
            .normalize()
            .toArray()
        })
        return new QuaternionKeyframeTrack(
          `${name}.quaternion`,
          samples.map((s) => s.seconds),
          values,
        )
      })
      return [phase, new AnimationClip(phase, 1, tracks)]
    }),
  ) as ReferenceProgram['steps'][number]['clips']
  const program: ReferenceProgram = {
    motionId: 'fixture-not-release',
    version: '1',
    blendMs: 120,
    maxAgeMs: 250,
    steps: [{ id: 'left', clips }],
  }
  const abort = new AbortController(),
    lease = await prepareOwnedAvatarPair(
      { generation: 1, signal: abort.signal },
      {
        load: () => loaded.scene,
        mirror: false,
        halfLifeMs: 30,
        maxAgeMs: 250,
        reference: program,
      },
    )
  const loadedModels = lease.models
  if (!loadedModels) throw new Error('Private reference fixture unavailable')
  const models = [loadedModels[0], loadedModels[1]] as const
  const [reference, user] = models
  const userRest = turns(user),
    referenceRest = turns(reference),
    refShape = shape(reference),
    userShape = shape(user)
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(1440, 900, false)
  renderer.setPixelRatio(1)
  const scene = new Scene()
  scene.background = new Color('#f7faff')
  scene.add(new HemisphereLight('#ffffff', '#8999b4', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  const camera = new OrthographicCamera(-1.85, 1.85, 1.15, -1.15, 0.1, 10)
  camera.position.set(0, 0.86, 4)
  camera.lookAt(0, 0.86, 0)
  models.forEach((model, i) => {
    model.position.x = i ? 0.85 : -0.85
    scene.add(model)
  })
  let now = 0,
    sequence = 0,
    phase: ReferenceCue['phase'] = 'waiting-start',
    status: ReferenceCue['status'] = 'running',
    closed = false,
    marked = '',
    state = lease.render(0, 0)
  const cue = () => ({
    generation: 1,
    sequence: ++sequence,
    at: now,
    motionId: program.motionId,
    version: program.version,
    stepId: 'left',
    phase,
    status,
  })
  function feed(delta: number, send = true) {
    now += delta
    if (send && !lease.updateReference(cue())) throw new Error('Private reference cue rejected')
    state = lease.render(now, delta)
    renderer.render(scene, camera)
  }
  feed(0)
  function snapshot() {
    const framing = models.map((model) =>
      ['head', 'footL', 'footR']
        .map((name) => bone(model, name).getWorldPosition(new Vector3()).project(camera))
        .every((p) => Math.abs(p.x) < 1 && Math.abs(p.y) < 1),
    )
    const target = samplesTarget()
    let maxTargetError = 0
    for (const [raw, basis] of Object.entries(target.bones)) {
      const name = raw.replaceAll('.', ''),
        rest = bone(loaded.scene, name).quaternion.clone()
      const expected = rest.multiply(new Quaternion().fromArray(basis).normalize()).normalize()
      maxTargetError = Math.max(maxTargetError, bone(reference, name).quaternion.angleTo(expected))
    }
    return {
      phase,
      status,
      now,
      state,
      sourceUnchanged: turns(loaded.scene) === original && shape(loaded.scene) === originalShape,
      userUnchanged: turns(user) === userRest && shape(user) === userShape,
      shapeUnchanged: shape(reference) === refShape,
      referenceMoved: turns(reference) !== referenceRest,
      freeze: turns(reference) === marked,
      maxTargetError,
      framing,
      independent: bones(reference).every((b) => !bones(user).includes(b)),
      eightWeights: models.every((m) => {
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
      }),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      actualCamera: false,
      actualSDK: false,
      releaseAvatar: false,
      approvedMotion: false,
    }
  }
  function samplesTarget() {
    const last = authored.phases[phase].at(-1)
    if (!last) throw new Error('Private reference fixture unavailable')
    return last
  }
  return Object.freeze({
    snapshot,
    setPhase(next: ReferenceCue['phase']) {
      phase = next
      marked = turns(reference)
      feed(0)
      return snapshot()
    },
    advance(ms: number) {
      if (closed) throw new Error('Private reference fixture closed')
      let remaining = ms
      while (remaining > 0) {
        const delta = Math.min(100, remaining)
        feed(delta)
        remaining -= delta
      }
      return snapshot()
    },
    pause() {
      marked = turns(reference)
      status = 'paused'
      feed(0)
      return snapshot()
    },
    resume() {
      status = 'running'
      feed(0)
      return snapshot()
    },
    expire() {
      marked = turns(reference)
      feed(400, false)
      return snapshot()
    },
    wait(ms: number) {
      feed(ms, false)
      return snapshot()
    },
    mark() {
      marked = turns(reference)
      return snapshot()
    },
    close() {
      if (!closed) {
        closed = true
        abort.abort()
        lease.dispose()
        state = lease.render(now, 0)
        renderer.dispose()
      }
      return snapshot()
    },
  })
}
