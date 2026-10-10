// FR-S-02/04·FR-M-07·FR-A-03: real native fake-camera/SDK/GLB, synthetic session gates only.
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import { createOwnedPlaybackResources } from '../../src/coaching/ownedPlaybackResources'
import { createCoachingSession } from '../../src/coaching/session'
import { closeCamera, openCamera } from '../../src/pose/camera'
import { createPoseLandmarker } from '../../src/pose/landmarker'
import type { OwnedPoseResult } from '../../src/pose/ownedPoseFrame'
import { createVideoPoseSource } from '../../src/pose/videoPoseSource'

export function mountPlaybackResourcesProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(1440, 900, false)
  const view = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  view.position.set(0, 0.8, 4)
  view.lookAt(0, 0.8, 0)
  const plane = new Mesh(new PlaneGeometry(0.01, 0.01), new MeshStandardMaterial())
  scene.add(plane)
  renderer.render(scene, view)
  plane.removeFromParent()
  plane.geometry.dispose()
  plane.material.dispose()
  renderer.render(scene, view)
  const baseline = { ...renderer.info.memory }
  const NativeFrame = globalThis.VideoFrame,
    frames: VideoFrame[] = [],
    streams: MediaStream[] = [],
    videos: HTMLVideoElement[] = []
  let frameCloses = 0,
    frameErrors = 0
  class TrackedFrame extends NativeFrame {
    constructor(input: CanvasImageSource, options?: VideoFrameInit)
    constructor(input: AllowSharedBufferSource, options: VideoFrameBufferInit)
    constructor(
      input: CanvasImageSource | AllowSharedBufferSource,
      options?: VideoFrameInit | VideoFrameBufferInit,
    ) {
      if (options && 'codedWidth' in options) super(input as AllowSharedBufferSource, options)
      else super(input as CanvasImageSource, options)
      frames.push(this)
    }
    close() {
      frameCloses++
      try {
        super.close()
      } catch (error) {
        frameErrors++
        throw error
      }
    }
  }
  globalThis.VideoFrame = TrackedFrame
  let closed = false,
    authenticated = true,
    holdNext = false,
    held = false,
    renderFrames = 0,
    nativeCalls = 0,
    nativeCloses = 0,
    detectorCloses = 0,
    cameraCloses = 0
  let releaseHeld: (() => void) | undefined,
    pair: Awaited<ReturnType<typeof prepareOwnedAvatarPair>> | undefined
  const failures: { type: 'error'; generation: number; reason: string }[] = []
  let session: ReturnType<typeof createCoachingSession>
  const actor = createOwnedPlaybackResources({
    camera: async (context) => {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.hidden = true
      document.body.append(video)
      videos.push(video)
      let stream: MediaStream
      try {
        stream = await openCamera(video, context.signal)
      } catch (error) {
        video.remove()
        throw error
      }
      streams.push(stream)
      let disposed = false
      const dispose = () => {
        if (disposed) return
        disposed = true
        context.signal.removeEventListener('abort', dispose)
        closeCamera(video, stream)
        video.remove()
        cameraCloses++
      }
      context.signal.addEventListener('abort', dispose, { once: true })
      if (context.signal.aborted) dispose()
      return { video, stream, dispose }
    },
    inference: async (context) => {
      // Fixture choice, not a release model decision. Results/images never leave browser memory.
      const native = await createPoseLandmarker('lite')
      let disposed = false
      const dispose = () => {
        if (disposed) return
        disposed = true
        context.signal.removeEventListener('abort', dispose)
        native.landmarker.close()
        detectorCloses++
      }
      context.signal.addEventListener('abort', dispose, { once: true })
      if (context.signal.aborted) {
        dispose()
        context.signal.throwIfAborted()
      }
      return {
        dispose,
        detect: (input: VideoFrame, at: number): OwnedPoseResult | Promise<OwnedPoseResult> => {
          nativeCalls++
          const result = native.landmarker.detectForVideo(input, at)
          const owned = {
            landmarks: result.landmarks,
            worldLandmarks: result.worldLandmarks,
            close: () => {
              try {
                result.close()
              } finally {
                nativeCloses++
              }
            },
          }
          if (!holdNext) return owned
          holdNext = false
          held = true
          return new Promise((resolve) => {
            releaseHeld = () => {
              held = false
              releaseHeld = undefined
              resolve(owned)
            }
          })
        },
      }
    },
    avatars: async (context) => {
      pair = await prepareOwnedAvatarPair(context, {
        mirror: true,
        halfLifeMs: 50,
        maxAgeMs: 250,
        load: async () => (await new GLTFLoader().loadAsync(`/${gender}.glb`)).scene,
      })
      const models = pair.models
      if (!models) throw new Error('Private resource diagnostic failed')
      models.forEach((model, index) => {
        model.position.x = index === 0 ? -0.75 : 0.75
        scene.add(model)
      })
      return pair
    },
    source: (context, camera, inference) =>
      createVideoPoseSource(context, {
        video: camera.video,
        stream: camera.stream,
        detect: inference.detect,
      }),
    scheduler: {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
    },
    render: () => {
      renderFrames++
      renderer.render(scene, view)
    },
    onFailure: (notice) => {
      failures.push(notice)
      if (session?.getSnapshot().state.generation === notice.generation)
        void session.end(notice.reason)
    },
  })
  session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-session-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'synthetic-hold', kind: 'hold', targetMs: 100 }],
    },
    ports: actor.ports,
    now: () => performance.now(),
    readGates: () => ({
      authenticated,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange: (snapshot) => {
      if (snapshot.state.status === 'running') actor.start(snapshot.state.generation)
    },
  })
  function snapshot() {
    const models = pair?.models
    return {
      resources: actor.getSnapshot(),
      session: {
        status: session.getSnapshot().state.status,
        generation: session.getSnapshot().state.generation,
        reason: session.getSnapshot().state.result?.reason ?? null,
        verifiedMs: session.getSnapshot().state.progress[0].verifiedMs,
      },
      closed,
      held,
      renderFrames,
      nativeCalls,
      nativeCloses,
      detectorCloses,
      cameraCloses,
      failures: [...failures],
      models: models?.length ?? 0,
      attached: models?.filter((model) => model.parent === scene).length ?? 0,
      framing:
        models?.map((model) => {
          const box = new Box3().setFromObject(model, true)
          return [box.min, box.max].every((point) => {
            const p = point.clone().project(view)
            return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z > -1 && p.z < 1
          })
        }) ?? [],
      cameras: streams.length,
      cameraLive: streams.some((stream) =>
        stream.getVideoTracks().some((track) => track.readyState === 'live'),
      ),
      tracksEnded: streams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === 'ended'),
      ),
      detached: videos.every((video) => video.srcObject === null),
      rawVideoHidden: videos.every((video) => video.hidden),
      frames: frames.length,
      frameCloses,
      frameErrors,
      allFramesClosed: frames.every((frame) => {
        try {
          const clone = frame.clone()
          clone.close()
          return false
        } catch (error) {
          return error instanceof DOMException && error.name === 'InvalidStateError'
        }
      }),
      memory: { ...renderer.info.memory },
      baseline,
      actualHuman: false,
      actualCamera: false,
      fakeCamera: true,
      syntheticGates: true,
      releaseAvatar: false,
    }
  }
  return Object.freeze({
    snapshot,
    start: async () => {
      await session.start()
      return snapshot()
    },
    pause: async () => {
      await session.pause()
      renderer.render(scene, view)
      return snapshot()
    },
    resume: async () => {
      await session.resume()
      return snapshot()
    },
    expire: async () => {
      authenticated = false
      await session.tick()
      renderer.render(scene, view)
      return snapshot()
    },
    holdNextResult: () => {
      holdNext = true
    },
    releaseHeldResult: () => releaseHeld?.(),
    close: async () => {
      if (!closed) {
        closed = true
        try {
          await session.end('page-hidden')
          await actor.close()
        } finally {
          renderer.render(scene, view)
          renderer.dispose()
          globalThis.VideoFrame = NativeFrame
        }
      }
      return snapshot()
    },
  })
}
