// FR-M-01/02/07·FR-A-01/03/NFR-07/08: TEST ONLY. No body values or frame export.
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createNativePlaybackResources } from '../../src/coaching/nativePlaybackResources'

export function mountNativeContentionProbe(
  canvas: HTMLCanvasElement,
  gender: 'male' | 'female',
  thread: 'main' | 'worker',
) {
  const scene = new Scene()
  scene.background = new Color('#ffffff')
  scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
  const light = new DirectionalLight('#ffffff', 2)
  light.position.set(-2, 3, 3)
  scene.add(light)
  const view = new OrthographicCamera(-1.65, 1.65, 1.03, -1.03, 0.1, 10)
  view.position.set(0, 0.8, 4)
  view.lookAt(0, 0.8, 0)
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(1440, 900, false)
  renderer.render(scene, view)
  const abort = new AbortController()
  const context = Object.freeze({ generation: 1, signal: abort.signal })
  let state = 'idle',
    stage = 'idle',
    failure: string | null = null
  let epoch = 0,
    readyAt = 0,
    runningAt = 0,
    stopped = false
  let deliveries = 0,
    renders = 0,
    paired = false
  let firstMs: number | null = null,
    thirdMs: number | null = null
  let lastBeatRunning = false
  let heartbeat = 0,
    lastBeat = 0,
    maxGapMs = 0,
    runningMaxGapMs = 0
  let raf = 0,
    preparing: Promise<void> | undefined,
    closing: Promise<void> | undefined
  const stages: { stage: string; startMs: number; endMs: number | null }[] = []
  const beat = (now: number) => {
    if (stopped) return
    if (lastBeat) {
      const gap = now - lastBeat
      maxGapMs = Math.max(maxGapMs, gap)
      if (lastBeatRunning && state === 'running') runningMaxGapMs = Math.max(runningMaxGapMs, gap)
    }
    lastBeat = now
    lastBeatRunning = state === 'running'
    heartbeat++
    raf = requestAnimationFrame(beat)
  }
  const actor = createNativePlaybackResources({
    model: 'lite',
    inferenceThread: thread,
    mirror: true,
    halfLifeMs: 50,
    maxAgeMs: 250,
    head: {
      bone: 'head',
      matrixLayout: 'column-major',
      cameraReference: [0, 0, 0, 1],
      sceneFromCamera: [0, 0, 0, 1],
    },
    hands: {
      cameraReferences: { left: [0, 0, 0, 1], right: [0, 0, 0, 1] },
      sceneFromCamera: [0, 0, 0, 1],
    },
    feedback: {
      program: {
        motionId: 'timing-not-release',
        version: 'private-count-only',
        regions: [{ id: 'left-arm', bones: ['upperarm01L'] }],
      },
      evaluate() {
        deliveries++
        firstMs ??= performance.now() - runningAt
        if (deliveries === 3) thirdMs = performance.now() - runningAt
        return null // No positive classification, success, correction or timer.
      },
    },
    loadAvatar: async () =>
      (await new GLTFLoader().loadAsync(`/__private-native-${gender}.glb`)).scene,
    scheduler: {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle),
    },
    render(pair) {
      if (pair.models?.length !== 2) throw new Error('Private pair unavailable')
      pair.models.forEach((model, index) => {
        if (model.parent !== scene) {
          model.position.x = index === 0 ? -0.75 : 0.75
          scene.add(model)
        }
      })
      paired = true
      renderer.render(scene, view)
      renders++
    },
    onFailure(notice) {
      failure = notice.reason
      state = 'failed'
    },
  })
  async function prepare() {
    epoch = performance.now()
    state = 'preparing'
    raf = requestAnimationFrame(beat)
    try {
      for (const name of ['camera', 'inference', 'avatars'] as const) {
        stage = name
        const event = {
          stage: name,
          startMs: performance.now() - epoch,
          endMs: null as number | null,
        }
        stages.push(event)
        await actor.ports[name](context)
        event.endMs = performance.now() - epoch
        abort.signal.throwIfAborted()
      }
      readyAt = performance.now()
      runningAt = readyAt
      if (!actor.start(1)) throw new Error()
      state = 'running'
      stage = 'running'
    } catch {
      failure ??= abort.signal.aborted ? 'cancelled' : 'prepare-error'
      state = 'failed'
      await close()
    }
  }
  function snapshot() {
    return {
      state,
      stage,
      failure,
      thread,
      gender,
      deliveries,
      renders,
      paired,
      heartbeat,
      maxGapMs,
      runningMaxGapMs,
      firstMs,
      thirdMs,
      readyMs: readyAt ? readyAt - epoch : null,
      stages: stages.map((value) => ({ ...value })),
      resourceStatus: actor.getSnapshot().status,
      closed: stopped,
    }
  }
  function close() {
    if (closing) return closing
    stopped = true
    cancelAnimationFrame(raf)
    closing = (async () => {
      // Closing the bridge owns inference quiescence before aborting the caller's signal.
      try {
        await actor.close()
      } catch {
        failure ??= 'cleanup-error'
      }
      abort.abort()
      renderer.dispose()
      renderer.forceContextLoss()
      if (!failure) state = 'closed'
    })()
    return closing
  }
  return {
    begin() {
      if (preparing || stopped) throw new Error('Private probe unavailable')
      preparing = prepare()
      return preparing
    },
    snapshot,
    close: async () => {
      await close()
      await preparing
      return snapshot()
    },
  }
}
