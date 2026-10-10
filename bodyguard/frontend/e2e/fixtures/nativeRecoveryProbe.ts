// FR-U-04·FR-M-07·FR-S-04/NFR-08: private native adapter + real account composition.
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
import { createNativePlaybackResources } from '../../src/coaching/nativePlaybackResources'
import { useRecordedCoaching } from '../../src/coaching/useRecordedCoaching'

export function mountNativeRecoveryProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
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
  const baseline = { ...renderer.info.memory },
    NativeFrame = globalThis.VideoFrame,
    frames: VideoFrame[] = []
  let frameCloses = 0,
    renderFrames = 0,
    closed = false,
    prepareFinished = true
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
      super.close()
    }
  }
  globalThis.VideoFrame = TrackedFrame
  type Hook = ReturnType<typeof useRecordedCoaching>
  type Session = NonNullable<ReturnType<Hook['getSession']>>
  type Actor = ReturnType<typeof createNativePlaybackResources>
  let hook: Hook | null = null,
    auth: ReturnType<typeof useAuth> | null = null,
    session: Session | null = null,
    current: Actor | null = null
  let pair: Parameters<Parameters<typeof createNativePlaybackResources>[0]['render']>[0] | null =
    null
  let pendingPrepare: Promise<void> | null = null,
    pendingCancel: Promise<void> | null = null
  const actors: Actor[] = [],
    failures: { reason: string; generation: number }[] = []
  function View() {
    const h = useRecordedCoaching(),
      a = useAuth()
    useLayoutEffect(() => {
      hook = h
      auth = a
    })
    return null
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  root.render(createElement(AuthProvider, null, createElement(View)))
  async function prepare() {
    if (!hook || auth?.state.status !== 'ready' || closed) return
    prepareFinished = false
    let owned: Session | null = null
    const actor = createNativePlaybackResources({
      model: 'lite',
      inferenceThread: 'main', // Preserve this pre-existing main-thread recovery contract.
      mirror: true,
      halfLifeMs: 50,
      maxAgeMs: 250,
      loadAvatar: async () =>
        (await new GLTFLoader().loadAsync(`/__private-recovery-${gender}.glb`)).scene,
      scheduler: {
        request: (callback) => requestAnimationFrame(callback),
        cancel: (handle) => cancelAnimationFrame(handle),
      },
      render(value) {
        pair = value
        value.models?.forEach((model, index) => {
          if (model.parent !== scene) {
            model.position.x = index === 0 ? -0.75 : 0.75
            scene.add(model)
          }
        })
        renderFrames++
        renderer.render(scene, view)
      },
      onFailure(notice) {
        failures.push({ reason: notice.reason, generation: notice.generation })
        if (owned?.getSnapshot().state.generation === notice.generation)
          void owned.end(notice.reason)
      },
    })
    current = actor
    actors.push(actor)
    try {
      owned = await hook.prepare({
        ownedResources: actor,
        ports: actor.ports,
        recordId: crypto.randomUUID(),
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
        onChange: (snapshot) => {
          if (snapshot.state.status === 'running') actor.start(snapshot.state.generation)
        },
      })
      if (owned) session = owned
      else await actor.close()
    } finally {
      prepareFinished = true
    }
  }
  function snapshot() {
    const models = pair?.models
    return {
      auth: auth?.state.status,
      hook: hook?.state.status,
      owned: Boolean(hook?.getSession()),
      resources: current?.getSnapshot(),
      actors: actors.map((a) => a.getSnapshot()),
      session: session?.getSnapshot().state.status,
      reason: session?.getSnapshot().state.result?.reason ?? session?.getSnapshot().failure,
      verifiedMs: session?.getSnapshot().state.progress[0].verifiedMs ?? 0,
      renderFrames,
      frames: frames.length,
      frameCloses,
      allFramesClosed: frames.every((f) => {
        try {
          const c = f.clone()
          c.close()
          return false
        } catch (e) {
          return e instanceof DOMException && e.name === 'InvalidStateError'
        }
      }),
      models: models?.length ?? 0,
      framing:
        models?.map((model) => {
          const b = new Box3().setFromObject(model, true)
          return [b.min, b.max].every((point) => {
            const p = point.clone().project(view)
            return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z > -1 && p.z < 1
          })
        }) ?? [],
      memory: { ...renderer.info.memory },
      baseline,
      prepareFinished,
      failures: [...failures],
      closed,
      actualHuman: false,
      actualPhysicalCamera: false,
      syntheticMotionGates: true,
      releaseAvatar: false,
    }
  }
  return Object.freeze({
    snapshot,
    prepare,
    start: () => session?.start(),
    stop: () => session?.end('user-stop'),
    save: () => session?.save(),
    beginCancel() {
      pendingCancel = hook?.cancel() ?? Promise.resolve()
    },
    finishCancel: () => pendingCancel,
    beginPrepare() {
      pendingPrepare = prepare()
    },
    finishPrepare: () => pendingPrepare,
    async close() {
      if (!closed) {
        closed = true
        root.unmount()
        host.remove()
        try {
          await hook?.cancel()
          await Promise.all(actors.map((a) => a.close()))
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
