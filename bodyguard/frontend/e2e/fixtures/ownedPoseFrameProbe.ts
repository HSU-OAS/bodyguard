// FR-M-02/07·FR-A-01/03: actual pose SDK on generated blank input, synthetic positive movement.
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
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import { createOwnedPosePlayback } from '../../src/avatar/ownedPosePlayback'
import { createPoseLandmarker } from '../../src/pose/landmarker'
import { createOwnedPoseFrame, type OwnedPoseResult } from '../../src/pose/ownedPoseFrame'
import { createVideoPoseSource } from '../../src/pose/videoPoseSource'
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
const turns = (model: Object3D) => {
  const values: number[][] = []
  model.traverse((node) => {
    if ((node as Bone).isBone) values.push(node.quaternion.toArray())
  })
  // Remains browser memory only, never returned or logged.
  return JSON.stringify(values)
}
export async function mountPoseFrameProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const abort = new AbortController(),
    context = { generation: 1, signal: abort.signal }
  // Non-personal generated input. Never mounted, exported, recorded or returned.
  const blank = new OffscreenCanvas(640, 480)
  const drawing = blank.getContext('2d')
  if (!drawing) throw new Error('Private pose diagnostic failed')
  drawing.fillStyle = '#888888'
  drawing.fillRect(0, 0, 640, 480)
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(1440, 900, false)
  const camera = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  camera.position.set(0, 0.8, 4)
  camera.lookAt(0, 0.8, 0)
  const plane = new Mesh(new PlaneGeometry(0.01, 0.01), new MeshStandardMaterial())
  scene.add(plane)
  try {
    renderer.render(scene, camera)
  } catch {
    renderer.dispose()
    throw new Error('Private pose diagnostic failed')
  } finally {
    plane.removeFromParent()
    plane.geometry.dispose()
    plane.material.dispose()
  }
  renderer.render(scene, camera)
  const baseline = { ...renderer.info.memory }
  let pair: Awaited<ReturnType<typeof prepareOwnedAvatarPair>> | undefined
  let native: Awaited<ReturnType<typeof createPoseLandmarker>> | undefined
  let source: ReturnType<typeof createOwnedPoseFrame<OffscreenCanvas>> | undefined
  let videoSource: ReturnType<typeof createVideoPoseSource> | undefined
  let playback: ReturnType<typeof createOwnedPosePlayback> | undefined
  let playbackSynthetic = false,
    holdNext = false,
    held = false
  let releaseHeld: (() => void) | undefined
  let renderFrames = 0,
    movingFrames = 0,
    previousTurns = ''
  let closed = false,
    sequence = 0,
    at = 0,
    mode: 'synthetic' | 'native' = 'synthetic'
  let nativeCalls = 0,
    nativeCloses = 0,
    syntheticCalls = 0,
    syntheticCloses = 0,
    detectorCloses = 0
  let reference: Object3D | undefined, user: Object3D | undefined
  let restReference = '',
    restUser = ''
  let state = { status: 'untracked', tracked: 0, total: 8 }
  const restPoints = new Map<number, Vector3>()
  async function close() {
    if (!closed) {
      closed = true
      try {
        await playback?.dispose()
      } finally {
        abort.abort()
        try {
          try {
            await videoSource?.dispose()
          } finally {
            await source?.dispose()
          }
        } finally {
          try {
            pair?.dispose()
          } finally {
            try {
              if (native) {
                native.landmarker.close()
                detectorCloses++
              }
            } finally {
              try {
                renderer.render(scene, camera)
              } finally {
                renderer.dispose()
              }
            }
          }
        }
      }
    }
    state = pair?.render(performance.now(), 0) ?? state
    return snapshot()
  }
  function snapshot() {
    const models = pair?.models
    return {
      state,
      closed,
      nativeCalls,
      nativeCloses,
      syntheticCalls,
      syntheticCloses,
      detectorCloses,
      playback: playback?.getSnapshot() ?? null,
      renderFrames,
      movingFrames,
      held,
      models: models?.length ?? 0,
      attached: models?.filter((model) => model.parent === scene).length ?? 0,
      referenceUnchanged: !!reference && turns(reference) === restReference,
      userChanged: !!user && turns(user) !== restUser,
      framing:
        models?.map((model) => {
          const box = new Box3().setFromObject(model, true)
          return [box.min, box.max].every((point) => {
            const p = point.clone().project(camera)
            return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z > -1 && p.z < 1
          })
        }) ?? [],
      memory: { ...renderer.info.memory },
      baseline,
      delegate: native?.delegate,
      actualCamera: false,
      actualHuman: false,
      releaseAvatar: false,
    }
  }
  function synthetic(): OwnedPoseResult {
    syntheticCalls++
    const image: Point[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 1,
    }))
    const world: Point[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
    const origin = restPoints.get(11)
    if (!origin) throw new Error('Private pose diagnostic failed')
    const angle = playbackSynthetic && syntheticCalls > 1 ? -Math.PI / 12 : Math.PI / 12
    const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle)
    for (const [index, rest] of restPoints) {
      const p = rest.clone()
      if (index === 13 || index === 15) p.sub(origin).applyQuaternion(turn).add(origin)
      world[index] = { x: -p.x, y: -p.y, z: -p.z }
    }
    return {
      landmarks: [image],
      worldLandmarks: [world],
      close() {
        syntheticCloses++
      },
    }
  }
  function deferredResult(result: OwnedPoseResult) {
    if (!holdNext) return result
    holdNext = false
    held = true
    return new Promise<OwnedPoseResult>((resolve) => {
      releaseHeld = () => {
        held = false
        releaseHeld = undefined
        resolve(result)
      }
    })
  }
  function startPlayback(kind: 'synthetic' | 'video') {
    const selectedSource = kind === 'video' ? videoSource : source
    if (closed || playback || !pair || !selectedSource)
      throw new Error('Private playback diagnostic failed')
    playbackSynthetic = kind === 'synthetic'
    mode = 'synthetic'
    previousTurns = user ? turns(user) : ''
    playback = createOwnedPosePlayback({
      context,
      source: selectedSource,
      avatars: pair,
      scheduler: {
        request: (callback) => requestAnimationFrame(callback),
        cancel: (handle) => cancelAnimationFrame(handle),
      },
      render() {
        renderFrames++
        if (!playback) throw new Error('Private playback diagnostic failed')
        state = playback.getSnapshot().state
        if (user) {
          const current = turns(user)
          if (current !== previousTurns) movingFrames++
          previousTurns = current
        }
        renderer.render(scene, camera)
      },
    })
    return playback.start()
  }
  async function read(next: 'synthetic' | 'native', duplicate = false) {
    if (closed || !source || !pair)
      return { ...snapshot(), delivered: false, stampsPreserved: false }
    mode = next
    if (!duplicate) {
      sequence++
      at = Math.max(performance.now(), at + 1)
    }
    const original = { generation: context.generation, sequence, at }
    const frame = await source.read()
    const delivered = !!frame && pair.observe(frame)
    state = pair.render(performance.now(), 0)
    renderer.render(scene, camera)
    return {
      ...snapshot(),
      delivered,
      stampsPreserved:
        !!frame &&
        frame.generation === original.generation &&
        frame.sequence === original.sequence &&
        frame.at === original.at,
      persons: frame?.result.landmarks.length ?? null,
    }
  }
  async function attachVideo(video: HTMLVideoElement, stream: MediaStream) {
    if (closed || !native) throw new Error('Private pose diagnostic failed')
    await videoSource?.dispose()
    videoSource = createVideoPoseSource(context, {
      video,
      stream,
      detect: (input, timestamp) => {
        if (!native) throw new Error('Private pose diagnostic failed')
        nativeCalls++
        const result = native.landmarker.detectForVideo(input, timestamp)
        return deferredResult({
          landmarks: result.landmarks,
          worldLandmarks: result.worldLandmarks,
          close() {
            try {
              result.close()
            } finally {
              nativeCloses++
            }
          },
        })
      },
    })
  }
  async function readVideo() {
    const frame = await videoSource?.read()
    const delivered = !!frame && !!pair?.observe(frame)
    state = pair?.render(performance.now(), 0) ?? state
    renderer.render(scene, camera)
    return { ...snapshot(), delivered, persons: frame?.result.landmarks.length ?? null }
  }
  try {
    pair = await prepareOwnedAvatarPair(context, {
      mirror: true,
      halfLifeMs: 50,
      maxAgeMs: 250,
      load: async () => (await new GLTFLoader().loadAsync(`/${gender}.glb`)).scene,
    })
    const models = pair.models
    if (!models) throw new Error('Private pose diagnostic failed')
    ;[reference, user] = models
    models.forEach((model, index) => {
      model.position.x = index === 0 ? -0.75 : 0.75
      scene.add(model)
    })
    restReference = turns(reference)
    restUser = turns(user)
    user.updateWorldMatrix(true, true)
    for (const [name, index] of joints) {
      const bone = user.getObjectByName(name)
      if (!bone) throw new Error('Private pose diagnostic failed')
      restPoints.set(index, bone.getWorldPosition(new Vector3()))
    }
    // Explicit fixture choice only; not a release model decision.
    native = await createPoseLandmarker('lite')
    source = createOwnedPoseFrame(context, {
      capture: () => {
        if (playbackSynthetic) {
          sequence++
          at = Math.max(performance.now(), at + 1)
        }
        return { generation: context.generation, sequence, at, input: blank }
      },
      detect: (input, timestamp) => {
        if (mode === 'synthetic') {
          const result = synthetic()
          if (playbackSynthetic && syntheticCalls === 3) holdNext = true
          return deferredResult(result)
        }
        if (!native) throw new Error('Private pose diagnostic failed')
        nativeCalls++
        const result = native.landmarker.detectForVideo(input, timestamp)
        return {
          landmarks: result.landmarks,
          worldLandmarks: result.worldLandmarks,
          close() {
            try {
              result.close()
            } finally {
              nativeCloses++
            }
          },
        }
      },
    })
    state = pair.render(performance.now(), 0)
    renderer.render(scene, camera)
    return Object.freeze({
      read,
      snapshot,
      close,
      attachVideo,
      readVideo,
      disposeVideo: async () => {
        await videoSource?.dispose()
      },
      startPlayback,
      holdNextResult: () => {
        holdNext = true
      },
      releaseHeldResult: () => releaseHeld?.(),
      stopPlayback: async () => {
        await playback?.dispose()
        return snapshot()
      },
    })
  } catch {
    await close()
    throw new Error('Private pose diagnostic failed')
  }
}
