// FR-U-04/FR-S-02/04·FR-R-03/NFR-07/08: TEST ONLY native/account composition.
import { createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
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
import { AuthProvider, useAuth } from '../../src/auth'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import { createOwnedPlaybackResources } from '../../src/coaching/ownedPlaybackResources'
import { useRecordedCoaching } from '../../src/coaching/useRecordedCoaching'
import { closeCamera, openCamera } from '../../src/pose/camera'
import { createPoseLandmarker } from '../../src/pose/landmarker'
import type { OwnedPoseResult } from '../../src/pose/ownedPoseFrame'
import { createVideoPoseSource } from '../../src/pose/videoPoseSource'

type Hook = ReturnType<typeof useRecordedCoaching>
type Session = NonNullable<ReturnType<Hook['getSession']>>
type Actor = Pick<ReturnType<typeof createOwnedPlaybackResources>, 'close' | 'getSnapshot'>
export function mountNativeAuthProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
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
  const NativeFrame = globalThis.VideoFrame
  const frames: VideoFrame[] = [],
    streams: MediaStream[] = [],
    videos: HTMLVideoElement[] = []
  const actors: Actor[] = []
  let frameCloses = 0,
    frameErrors = 0,
    renderFrames = 0,
    nativeCalls = 0,
    nativeCloses = 0,
    detectorCloses = 0,
    cameraCloses = 0,
    nativePeopleMax = 0,
    closed = false,
    holdNext = false,
    held = false,
    prepared = false,
    prepareFinished = true
  let releaseHeld: (() => void) | undefined,
    recordId: string | null = null
  let hook: Hook | null = null,
    auth: ReturnType<typeof useAuth> | null = null,
    session: Session | null = null,
    currentActor: Actor | null = null,
    pendingPreparation: Promise<void> | null = null,
    staleActions: Promise<void> | null = null,
    pair: Awaited<ReturnType<typeof prepareOwnedAvatarPair>> | undefined
  const failures: { generation: number; reason: string }[] = []
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
  function View() {
    const latestHook = useRecordedCoaching(),
      latestAuth = useAuth()
    useLayoutEffect(() => {
      hook = latestHook
      auth = latestAuth
    })
    return null
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  root.render(createElement(AuthProvider, null, createElement(View)))
  async function prepare() {
    if (closed || !hook || auth?.state.status !== 'ready') return
    prepared = false
    prepareFinished = false
    let ownedSession: Session | null = null
    const nextId = crypto.randomUUID()
    const actor = createOwnedPlaybackResources({
      async camera(context) {
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
      async inference(context) {
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
          detect(input: VideoFrame, at: number): OwnedPoseResult | Promise<OwnedPoseResult> {
            nativeCalls++
            const result = native.landmarker.detectForVideo(input, at)
            nativePeopleMax = Math.max(nativePeopleMax, result.landmarks.length)
            const owned = {
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
      async avatars(context) {
        pair = await prepareOwnedAvatarPair(context, {
          mirror: true,
          halfLifeMs: 50,
          maxAgeMs: 250,
          load: async () =>
            (await new GLTFLoader().loadAsync(`/__private-native-${gender}.glb`)).scene,
        })
        if (!pair.models) throw new Error('Private native fixture unavailable')
        pair.models.forEach((model, index) => {
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
      render() {
        renderFrames++
        renderer.render(scene, view)
      },
      onFailure(notice) {
        failures.push({ generation: notice.generation, reason: notice.reason })
        if (ownedSession?.getSnapshot().state.generation === notice.generation)
          void ownedSession.end(notice.reason)
      },
    })
    currentActor = actor
    actors.push(actor)
    try {
      ownedSession = await hook.prepare({
        ownedResources: actor,
        ports: actor.ports,
        recordId: nextId,
        readClockPair: () => ({ monotonicMs: performance.now(), utc: new Date().toISOString() }),
        plan: {
          motionId: 'fixture-not-release',
          version: 'synthetic-session-only',
          source: 'direct',
          maxFrameAgeMs: 100,
          maxFrameGapMs: 200,
          steps: [{ id: 'synthetic-hold', kind: 'hold', targetMs: 100 }],
        },
        readGates: () => ({
          authenticated: true,
          motionValidated: true,
          referenceAvatarReady: true,
          userAvatarReady: true,
        }),
        onChange(snapshot) {
          if (snapshot.state.status === 'running') actor.start(snapshot.state.generation)
        },
      })
      if (ownedSession) {
        session = ownedSession
        prepared = true
        recordId = nextId
      } else await actor.close()
    } finally {
      prepareFinished = true
    }
  }
  function snapshot() {
    const models = pair?.models
    return {
      auth: auth?.state.status ?? 'unmounted',
      hook: hook?.state.status ?? 'unmounted',
      owned: Boolean(hook?.getSession()),
      resources: currentActor?.getSnapshot() ?? null,
      actors: actors.map((actor) => actor.getSnapshot()),
      session: session?.getSnapshot().state.status ?? null,
      sessionGeneration: session?.getSnapshot().state.generation ?? null,
      verifiedMs: session?.getSnapshot().state.progress[0].verifiedMs ?? 0,
      record: session?.getRecordSnapshot().status ?? null,
      recordId,
      prepared: prepared && Boolean(hook?.getSession()),
      prepareFinished,
      closed,
      held,
      renderFrames,
      nativeCalls,
      nativeCloses,
      nativePeopleMax,
      detectorCloses,
      cameraCloses,
      failures: [...failures],
      models: models?.length ?? 0,
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
      syntheticMotionGates: true,
      releaseAvatar: false,
    }
  }
  return Object.freeze({
    snapshot,
    prepare,
    beginPrepare() {
      pendingPreparation = prepare()
    },
    finishPrepare: () => pendingPreparation,
    start: () => session?.start(),
    stop: () => session?.end('user-stop'),
    save: () => session?.save(),
    resume: () => session?.resume(),
    beginOldActions() {
      staleActions = Promise.all([session?.resume(), session?.save()]).then(() => undefined)
    },
    finishOldActions: () => staleActions,
    refresh: () => auth?.refresh(),
    signOut: () => auth?.signOut(),
    holdNextResult() {
      holdNext = true
    },
    releaseHeldResult: () => releaseHeld?.(),
    unmount() {
      root.unmount()
      host.remove()
    },
    async close() {
      if (!closed) {
        closed = true
        root.unmount()
        host.remove()
        releaseHeld?.()
        try {
          await hook?.cancel()
          await Promise.all(actors.map((actor) => actor.close()))
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
