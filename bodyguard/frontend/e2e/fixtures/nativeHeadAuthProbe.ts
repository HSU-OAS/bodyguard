// FR-U-04/FR-S-02/04·FR-R-03/NFR-07/08: TEST ONLY native/account composition.
import { FaceLandmarker, GestureRecognizer, PoseLandmarker } from '@mediapipe/tasks-vision'
import { createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  type Bone,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { AuthProvider, useAuth } from '../../src/auth'
import type { HandDisplayAlignment } from '../../src/avatar/observedHandRig'
import type { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import type { ReferenceProgram } from '../../src/avatar/referencePlayback'
import { createNativePlaybackResources } from '../../src/coaching/nativePlaybackResources'
import { useRecordedCoaching } from '../../src/coaching/useRecordedCoaching'
import type { CoachingState, ObservationClass } from '../../src/stretch/progression'
import { nativeReferenceProgram } from './nativeReferenceProgram'

type Hook = ReturnType<typeof useRecordedCoaching>
type Session = NonNullable<ReturnType<Hook['getSession']>>
type Actor = Pick<
  ReturnType<typeof createNativePlaybackResources>,
  'close' | 'getSnapshot' | 'synchronize'
>
export function mountNativeHeadAuthProbe(
  canvas: HTMLCanvasElement,
  gender: 'male' | 'female',
  handAlignment?: HandDisplayAlignment,
  withReference = false,
) {
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
    faceCalls = 0,
    faceDetectorCloses = 0,
    handCalls = 0,
    handDetectorCloses = 0,
    nativeHandsMax = 0,
    nativeFacesMax = 0,
    sameInput = true,
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
  let currentReference: ReferenceProgram | undefined
  let oldState: CoachingState | null = null,
    referenceRest = '',
    userRest = '',
    markedReference = ''
  const turns = (model: NonNullable<typeof pair>['models']) =>
    model?.map((root) => {
      const rotations: number[][] = []
      root.traverse((node) => {
        if ((node as Bone).isBone) rotations.push((node as Bone).quaternion.toArray())
      })
      return JSON.stringify(rotations)
    }) ?? []
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
  // TEST ONLY wrappers call actual SDK methods. Holding the returned final JS result
  // simulates an async cancellation boundary, not the native SDK's latency contract.
  const bodyDetect = PoseLandmarker.prototype.detectForVideo,
    bodyClose = PoseLandmarker.prototype.close,
    faceDetect = FaceLandmarker.prototype.detectForVideo,
    faceClose = FaceLandmarker.prototype.close,
    handDetect = GestureRecognizer.prototype.recognizeForVideo,
    handClose = GestureRecognizer.prototype.close,
    bodyStamps = new WeakMap<VideoFrame, number>(),
    media = navigator.mediaDevices,
    camera = media.getUserMedia.bind(media),
    descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject')
  if (!descriptor?.get || !descriptor.set) throw new Error('Owned media descriptor required')
  const setter = descriptor.set
  media.getUserMedia = async (constraints) => {
    const stream = await camera(constraints)
    streams.push(stream)
    return stream
  }
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    ...descriptor,
    set(value) {
      const before = descriptor.get?.call(this)
      if (this instanceof HTMLVideoElement && value && !videos.includes(this)) videos.push(this)
      setter.call(this, value)
      if (this instanceof HTMLVideoElement && before && value === null) cameraCloses++
    },
  })
  Object.defineProperty(PoseLandmarker.prototype, 'detectForVideo', {
    configurable: true,
    writable: true,
    value(this: PoseLandmarker, input: VideoFrame, at: number) {
      nativeCalls++
      bodyStamps.set(input, at)
      const result = bodyDetect.call(this, input, at, {})
      nativePeopleMax = Math.max(nativePeopleMax, result.landmarks.length)
      const release = result.close.bind(result)
      result.close = () => {
        nativeCloses++
        release()
      }
      return result
    },
  })
  Object.defineProperty(PoseLandmarker.prototype, 'close', {
    configurable: true,
    writable: true,
    value(this: PoseLandmarker) {
      detectorCloses++
      return bodyClose.call(this)
    },
  })
  Object.defineProperty(FaceLandmarker.prototype, 'detectForVideo', {
    configurable: true,
    writable: true,
    value(this: FaceLandmarker, input: VideoFrame, at: number) {
      faceCalls++
      sameInput = sameInput && bodyStamps.get(input) === at
      const result = faceDetect.call(this, input, at)
      nativeFacesMax = Math.max(nativeFacesMax, result.faceLandmarks.length)
      if (!holdNext || handAlignment) return result
      holdNext = false
      held = true
      return new Promise((resolve) => {
        releaseHeld = () => {
          held = false
          releaseHeld = undefined
          resolve(result)
        }
      })
    },
  })
  Object.defineProperty(FaceLandmarker.prototype, 'close', {
    configurable: true,
    writable: true,
    value(this: FaceLandmarker) {
      faceDetectorCloses++
      return faceClose.call(this)
    },
  })
  Object.defineProperty(GestureRecognizer.prototype, 'recognizeForVideo', {
    configurable: true,
    writable: true,
    value(this: GestureRecognizer, input: VideoFrame, at: number) {
      handCalls++
      sameInput = sameInput && bodyStamps.get(input) === at
      const result = handDetect.call(this, input, at)
      nativeHandsMax = Math.max(nativeHandsMax, result.landmarks.length)
      if (!holdNext) return result
      holdNext = false
      held = true
      return new Promise((resolve) => {
        releaseHeld = () => {
          held = false
          releaseHeld = undefined
          resolve(result)
        }
      })
    },
  })
  Object.defineProperty(GestureRecognizer.prototype, 'close', {
    configurable: true,
    writable: true,
    value(this: GestureRecognizer) {
      handDetectorCloses++
      return handClose.call(this)
    },
  })
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
    const reference = withReference ? await nativeReferenceProgram(gender) : undefined
    currentReference = reference
    const actor = createNativePlaybackResources({
      model: 'lite',
      mirror: true,
      halfLifeMs: 50,
      maxAgeMs: 250,
      head: {
        bone: 'head',
        matrixLayout: 'column-major',
        cameraReference: [0, 0, 0, 1],
        sceneFromCamera: [0, 0, 0, 1],
      },
      ...(handAlignment ? { hands: handAlignment } : {}),
      ...(reference ? { reference } : {}),
      loadAvatar: async () =>
        (await new GLTFLoader().loadAsync(`/__private-native-${gender}.glb`)).scene,
      scheduler: {
        request: (callback) => requestAnimationFrame(callback),
        cancel: (handle) => cancelAnimationFrame(handle),
      },
      render(ownedPair) {
        pair = ownedPair
        if (!pair.models) throw new Error('Private native fixture unavailable')
        if (pair.models[0].parent !== scene) {
          const [ref, user] = turns(pair.models)
          referenceRest = ref
          userRest = user
          markedReference = ref
        }
        pair.models.forEach((model, index) => {
          if (model.parent !== scene) {
            model.position.x = index === 0 ? -0.75 : 0.75
            scene.add(model)
          }
        })
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
          maxFrameAgeMs: withReference ? 1000 : 100,
          maxFrameGapMs: withReference ? 5000 : 200,
          steps: [{ id: 'synthetic-hold', kind: 'hold', targetMs: withReference ? 2000 : 100 }],
        },
        readGates: () => ({
          authenticated: true,
          motionValidated: true,
          referenceAvatarReady: true,
          userAvatarReady: true,
        }),
        onChange(snapshot) {
          if (withReference) actor.synchronize(snapshot.state)
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
    const [ref, user] = turns(models ?? null)
    let referenceTargetError: number | null = null
    const phase = session?.getSnapshot().state.phase
    const clip = phase ? currentReference?.steps[0].clips[phase] : undefined
    if (models && clip) {
      referenceTargetError = 0
      for (const track of clip.tracks) {
        const node = models[0].getObjectByName(track.name.replace(/\.quaternion$/, '')) as Bone
        const expected = new Quaternion()
          .fromArray(track.values, track.values.length - 4)
          .normalize()
        referenceTargetError = Math.max(referenceTargetError, node.quaternion.angleTo(expected))
      }
    }
    return {
      auth: auth?.state.status ?? 'unmounted',
      hook: hook?.state.status ?? 'unmounted',
      owned: Boolean(hook?.getSession()),
      resources: currentActor?.getSnapshot() ?? null,
      actors: actors.map((actor) => actor.getSnapshot()),
      session: session?.getSnapshot().state.status ?? null,
      sessionGeneration: session?.getSnapshot().state.generation ?? null,
      verifiedMs: session?.getSnapshot().state.progress[0].verifiedMs ?? 0,
      phase: session?.getSnapshot().state.phase ?? null,
      referenceConfigured: withReference,
      referenceMoved: Boolean(ref && ref !== referenceRest),
      userUnchanged: Boolean(user && user === userRest),
      referenceFrozen: Boolean(ref && ref === markedReference),
      referenceTargetError,
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
      faceCalls,
      faceDetectorCloses,
      nativeFacesMax,
      handCalls,
      handDetectorCloses,
      nativeHandsMax,
      sameInput,
      productionAdapter: true,
      heldStage: held ? (handAlignment ? 'hands' : 'face') : null,
      handsConfigured: Boolean(handAlignment),
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
    pause: () => session?.pause(),
    tick: () => session?.tick(),
    async observe(classification: ObservationClass) {
      const state = session?.getSnapshot().state
      if (!state) return
      // Independent synthetic progression input, never the blank SDK result.
      return session?.observe({
        generation: state.generation,
        sequence: state.lastSequence + 1,
        sampledAt: performance.now(),
        personCount: 1,
        stepId: 'synthetic-hold',
        classification,
      })
    },
    markReference() {
      markedReference = turns(pair?.models ?? null)[0] ?? ''
    },
    oldCommand: () => (oldState ? (currentActor?.synchronize(oldState) ?? false) : false),
    beginOldActions() {
      staleActions = Promise.all([session?.resume(), session?.save()]).then(() => undefined)
    },
    finishOldActions: () => staleActions,
    refresh: () => auth?.refresh(),
    signOut: () => auth?.signOut(),
    holdNextResult() {
      oldState = session?.getSnapshot().state ?? null
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
          media.getUserMedia = camera
          Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', descriptor)
          PoseLandmarker.prototype.detectForVideo = bodyDetect
          PoseLandmarker.prototype.close = bodyClose
          FaceLandmarker.prototype.detectForVideo = faceDetect
          FaceLandmarker.prototype.close = faceClose
          GestureRecognizer.prototype.recognizeForVideo = handDetect
          GestureRecognizer.prototype.close = handClose
        }
      }
      return snapshot()
    },
  })
}
