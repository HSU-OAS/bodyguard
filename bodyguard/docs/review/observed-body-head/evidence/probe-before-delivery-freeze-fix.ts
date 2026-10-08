// FR-A-01/03·FR-M-01/02/07: private fake-camera/native miss and separate synthetic movement.
import {
  type Bone,
  Box3,
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
import { OBSERVED_LIMB_BINDINGS } from '../../src/avatar/directionalRig'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import { createBodyFaceVideoSource } from '../../src/pose/bodyFaceVideoSource'
import { closeCamera, openCamera } from '../../src/pose/camera'
import { createFaceLandmarker } from '../../src/pose/face'
import { createPoseLandmarker } from '../../src/pose/landmarker'

function bones(model: Object3D) {
  const list: Record<string, { position: number[]; scale: number[]; rotation: number[] }> = {}
  model.traverse((node) => {
    if ((node as Bone).isBone)
      list[node.name] = {
        position: node.position.toArray(),
        scale: node.scale.toArray(),
        rotation: node.quaternion.toArray(),
      }
  })
  return list
}
async function weights(model: Object3D) {
  const list: Promise<string>[] = []
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
      const a = attribute.array,
        bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength).slice()
      list.push(
        crypto.subtle
          .digest('SHA-256', bytes)
          .then((v) => [...new Uint8Array(v)].map((n) => n.toString(16).padStart(2, '0')).join('')),
      )
    }
  })
  return Promise.all(list)
}
type Mode = 'native' | 'synthetic' | 'missing-face' | 'multiple-body'
export async function mountObservedBodyHead(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const video = document.createElement('video')
  video.hidden = true
  video.muted = true
  video.playsInline = true
  const abort = new AbortController(),
    context = { generation: 1, signal: abort.signal }
  let stream: MediaStream | undefined,
    pose: Awaited<ReturnType<typeof createPoseLandmarker>> | undefined,
    face: Awaited<ReturnType<typeof createFaceLandmarker>> | undefined,
    pair: Awaited<ReturnType<typeof prepareOwnedAvatarPair>> | undefined,
    source: ReturnType<typeof createBodyFaceVideoSource> | undefined,
    renderer: WebGLRenderer | undefined
  let mode: Mode = 'native',
    closed = false,
    cleaned = false,
    raf = 0,
    frames = 0,
    last = 0,
    nativeBodies = 0,
    nativeFaces = 0,
    syntheticBodies = 0,
    syntheticFaces = 0,
    bodyCloses = 0,
    poseCloses = 0,
    faceCloses = 0,
    coherent = 0,
    delivered = 0,
    inputsClosed = 0,
    hold = false,
    pendingFace = false
  let borrowed: VideoFrame | undefined,
    borrowedAt = -Infinity,
    release: (() => void) | undefined
  let latestState: ReturnType<NonNullable<typeof pair>['render']> | undefined
  let closing: Promise<Awaited<ReturnType<typeof snapshot>>> | undefined
  let loaded: Object3D | undefined,
    models: NonNullable<NonNullable<typeof pair>['models']> | undefined
  let sourceBones = '',
    sourceWeights = '',
    referenceBones = '',
    beforeBones: ReturnType<typeof bones>[] = [],
    beforeWeights: string[][] = []
  const scene = new Scene(),
    camera = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  scene.background = new Color('#ffffff')
  camera.position.set(0, 0.8, 4)
  camera.lookAt(0, 0.8, 0)
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.35)
  let restHead = new Quaternion(),
    frozenHead: number[] | undefined
  function inputOpen() {
    if (!borrowed) return false
    try {
      const copied = borrowed.clone()
      copied.close()
      return true
    } catch {
      return false
    }
  }
  function syntheticBody() {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
    const worldLandmarks = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
    for (const [a, b, c, side] of [
      [11, 13, 15, 1],
      [12, 14, 16, -1],
      [23, 25, 27, 1],
      [24, 26, 28, -1],
    ]) {
      worldLandmarks[b] = { x: side * 0.18, y: 0.3, z: 0 }
      worldLandmarks[c] = { x: side * 0.2, y: 0.6, z: -0.08 }
      worldLandmarks[a] = { x: 0, y: 0, z: 0 }
    }
    return {
      landmarks: mode === 'multiple-body' ? [landmarks, landmarks] : [landmarks],
      worldLandmarks:
        mode === 'multiple-body' ? [worldLandmarks, worldLandmarks] : [worldLandmarks],
    }
  }
  function render(now: number, delta: number) {
    if (!pair || !renderer) return
    latestState = pair.render(now, delta)
    renderer.render(scene, camera)
  }
  function tick(now: number) {
    if (closed) return
    if (now > last) {
      render(now, now - last)
      last = now
      frames++
    }
    raf = requestAnimationFrame(tick)
  }
  async function snapshot() {
    const ownedModels = models
    const current = ownedModels?.map(bones) ?? []
    return {
      gender,
      closed,
      cleaned,
      frames,
      mode,
      latestState,
      nativeBodies,
      nativeFaces,
      syntheticBodies,
      syntheticFaces,
      bodyCloses,
      poseCloses,
      faceCloses,
      coherent,
      delivered,
      inputsClosed,
      pendingFace,
      inputOpen: inputOpen(),
      sourceUnchanged:
        !!loaded &&
        sourceBones === JSON.stringify(bones(loaded)) &&
        sourceWeights === JSON.stringify(await weights(loaded)),
      referenceUnchanged: !!models && referenceBones === JSON.stringify(bones(models[0])),
      weightsUnchanged:
        !!models &&
        JSON.stringify(beforeWeights) === JSON.stringify(await Promise.all(models.map(weights))),
      lengthsAndOtherBones: current.every((list, i) =>
        Object.entries(list).every(([name, value]) => {
          const original = beforeBones[i][name]
          const animated =
            i === 1 && (name === 'head' || OBSERVED_LIMB_BINDINGS.some((b) => b.bone === name))
          return (
            JSON.stringify(animated ? [value.position, value.scale] : value) ===
            JSON.stringify(animated ? [original.position, original.scale] : original)
          )
        }),
      ),
      headError: models
        ? (models[1].getObjectByName('head') as Bone)
            .getWorldQuaternion(new Quaternion())
            .normalize()
            .angleTo(turn.clone().multiply(restHead).normalize())
        : null,
      headFrozen:
        !!models &&
        !!frozenHead &&
        JSON.stringify((models[1].getObjectByName('head') as Bone).quaternion.toArray()) ===
          JSON.stringify(frozenHead),
      limbMovement:
        !!ownedModels &&
        OBSERVED_LIMB_BINDINGS.every(
          (b) =>
            JSON.stringify(
              (ownedModels[1].getObjectByName(b.bone) as Bone).quaternion.toArray(),
            ) !== JSON.stringify(beforeBones[1][b.bone].rotation),
        ),
      independent:
        !!models && models[0].getObjectByName('head') !== models[1].getObjectByName('head'),
      framing:
        models?.map((model) => {
          const b = new Box3().setFromObject(model, true),
            p: Vector3[] = []
          for (const x of [b.min.x, b.max.x])
            for (const y of [b.min.y, b.max.y])
              for (const z of [b.min.z, b.max.z]) p.push(new Vector3(x, y, z).project(camera))
          return p.every((v) => Math.abs(v.x) < 1 && Math.abs(v.y) < 1)
        }) ?? [],
      calls: renderer?.info.render.calls ?? 0,
      triangles: renderer?.info.render.triangles ?? 0,
      cameraLive: stream?.getVideoTracks().every((t) => t.readyState === 'live') ?? false,
      tracksEnded: stream?.getTracks().every((t) => t.readyState === 'ended') ?? false,
      videoDetached: video.srcObject === null,
      fakeCamera: true,
      actualHuman: false,
      identityVerified: false,
      nativePositiveHead: false,
      poseDelegate: pose?.delegate,
      faceDelegate: face?.delegate,
    }
  }
  async function teardown() {
    closed = true
    cancelAnimationFrame(raf)
    pair?.dispose()
    latestState = pair?.render(performance.now(), 0)
    await source?.dispose()
    abort.abort()
    try {
      if (pose) {
        pose.landmarker.close()
        poseCloses++
      }
    } finally {
      try {
        if (face) {
          face.landmarker.close()
          faceCloses++
        }
      } finally {
        if (stream) closeCamera(video, stream)
        renderer?.dispose()
        video.remove()
        cleaned = true
      }
    }
    return snapshot()
  }
  function close() {
    closing ??= teardown()
    return closing
  }
  try {
    stream = await openCamera(video, abort.signal)
    pose = await createPoseLandmarker('lite')
    face = await createFaceLandmarker()
    pair = await prepareOwnedAvatarPair(context, {
      async load() {
        loaded = (await new GLTFLoader().loadAsync(`/${gender}.glb`)).scene
        sourceBones = JSON.stringify(bones(loaded))
        sourceWeights = JSON.stringify(await weights(loaded))
        return loaded
      },
      mirror: false,
      halfLifeMs: 50,
      maxAgeMs: 1500,
      head: { bone: 'head', cameraReference: [0, 0, 0, 1], sceneFromCamera: [0, 0, 0, 1] },
    })
    models = pair.models ?? undefined
    if (!models) throw new Error()
    models.forEach((model, i) => {
      model.position.x = i === 0 ? -0.75 : 0.75
      scene.add(model)
    })
    beforeBones = models.map(bones)
    referenceBones = JSON.stringify(beforeBones[0])
    beforeWeights = await Promise.all(models.map(weights))
    restHead = (models[1].getObjectByName('head') as Bone)
      .getWorldQuaternion(new Quaternion())
      .normalize()
    renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(1440, 900, false)
    source = createBodyFaceVideoSource(context, {
      video,
      stream,
      matrixLayout: 'column-major',
      detectBody(frame, at) {
        borrowed = frame
        borrowedAt = at
        if (mode !== 'native') {
          syntheticBodies++
          return {
            ...syntheticBody(),
            close() {
              bodyCloses++
            },
          }
        }
        if (!pose) throw new Error()
        nativeBodies++
        const result = pose.landmarker.detectForVideo(frame, at)
        return {
          landmarks: result.landmarks,
          worldLandmarks: result.worldLandmarks,
          close() {
            result.close()
            bodyCloses++
          },
        }
      },
      async detectFace(frame, at) {
        if (frame === borrowed && at === borrowedAt) coherent++
        let result: Parameters<
          typeof import('../../src/avatar/headOrientationRig').readHeadOrientation
        >[0]
        if (mode === 'native') {
          if (!face) throw new Error()
          nativeFaces++
          result = face.landmarker.detectForVideo(frame, at)
        } else {
          syntheticFaces++
          result =
            mode === 'missing-face'
              ? { faceLandmarks: [], facialTransformationMatrixes: [] }
              : {
                  faceLandmarks: [Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))],
                  facialTransformationMatrixes: [
                    {
                      rows: 4,
                      columns: 4,
                      data: new Matrix4().makeRotationFromQuaternion(turn).toArray(),
                    },
                  ],
                }
        }
        if (hold) {
          hold = false
          pendingFace = true
          await new Promise<void>((r) => {
            release = r
          })
          pendingFace = false
          release = undefined
        }
        return result
      },
    })
    last = performance.now()
    render(last, 0)
    raf = requestAnimationFrame(tick)
    return Object.freeze({
      snapshot,
      close,
      counters: () => ({ frames, latestState, pendingFace, closed, cleaned }),
      holdNext: () => {
        hold = true
      },
      release: () => {
        release?.()
      },
      async next(nextMode: Mode) {
        mode = nextMode
        if (models) frozenHead = (models[1].getObjectByName('head') as Bone).quaternion.toArray()
        const observed = await source?.read()
        if (!inputOpen()) inputsClosed++
        const accepted = !!observed && !!pair?.observe(observed)
        if (accepted) delivered++
        if (!closed) {
          const now = performance.now()
          render(now, Math.max(0, now - last))
          last = now
        }
        return { accepted, ...(await snapshot()) }
      },
    })
  } catch {
    release?.()
    await close()
    throw new Error('Private observed body head fixture unavailable')
  }
}

