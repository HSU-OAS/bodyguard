// FR-A-01/02/03·FR-M-02/07: private display of one copied observation; never a verdict.
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import { createHeadRotationRig } from './headOrientationRig'
import { hasSingleDisplayBody, readDetailAlignment } from './observedDetailAlignment'
import { copyHandObservations, createObservedHandRig } from './observedHandRig'
import type { PoseRigFrame } from './observedPoseRig'
import { prepareOwnedAvatarPair } from './ownedAvatarPair'
import { prepareAvatarStage } from './prepareAvatarStage'
import { type AvatarGender, REVIEW_AVATAR_ASSETS } from './reviewAvatarAssets'

export type AvatarView = 'full' | 'upper' | 'detail'
export type DetailAlignmentStatus = 'idle' | 'waiting' | 'aligned' | 'partial' | 'unavailable'
export type WorkspaceAvatar = Awaited<ReturnType<typeof prepareWorkspaceAvatar>>

export async function prepareWorkspaceAvatar(
  context: ResourceContext,
  options: Readonly<{ canvas: HTMLCanvasElement; gender: AvatarGender; onFailure(): void }>,
) {
  const { canvas, gender, onFailure } = options
  const unavailable = () => new Error('Workspace avatar unavailable')
  if (!import.meta.env.DEV || !Object.hasOwn(REVIEW_AVATAR_ASSETS, gender)) throw unavailable()
  let pair: Awaited<ReturnType<typeof prepareOwnedAvatarPair>> | undefined
  let renderer: WebGLRenderer | undefined
  let resize: ResizeObserver | undefined
  let head: ReturnType<typeof createHeadRotationRig> | undefined
  let hands: ReturnType<typeof createObservedHandRig> | undefined
  let alignment: DetailAlignmentStatus = 'idle'
  let requestedAfter = -Infinity
  let lastSequence = 0
  let closed = false,
    cleanupFailed = false
  let width = 0,
    height = 0
  const scene = new Scene()
  const camera = new OrthographicCamera()
  scene.background = new Color('#ffffff')
  const lost = (event: Event) => {
    event.preventDefault()
    if (!closed) onFailure()
  }
  function dispose() {
    if (!closed) {
      closed = true
      context.signal.removeEventListener('abort', aborted)
      canvas.removeEventListener('webglcontextlost', lost)
      for (const release of [
        () => resize?.disconnect(),
        () => head?.dispose(),
        () => hands?.dispose(),
        () => {
          renderer?.setScissorTest(false)
          renderer?.clear()
        },
        () => pair?.dispose(),
        () => renderer?.dispose(),
        () => scene.clear(),
      ]) {
        try {
          release()
        } catch {
          cleanupFailed = true
        }
      }
    }
    if (cleanupFailed) throw new ResourceCleanupError()
  }
  function aborted() {
    try {
      dispose()
    } catch {
      /* Explicit dispose reports the fixed cleanup failure. */
    }
  }
  try {
    pair = await prepareOwnedAvatarPair(context, {
      mirror: true,
      trunk: true,
      halfLifeMs: 50,
      maxAgeMs: 1000,
      load: async ({ signal }) => {
        const asset = REVIEW_AVATAR_ASSETS[gender]
        const response = await fetch(asset.url, { signal, credentials: 'omit', cache: 'no-store' })
        if (!response.ok) throw unavailable()
        const bytes = await response.arrayBuffer()
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
          .map((value) => value.toString(16).padStart(2, '0'))
          .join('')
        if (digest !== asset.sha256) throw unavailable()
        signal.throwIfAborted()
        // A parsed scene transfers even after a late abort; the owned pair reclaims it.
        return (await new GLTFLoader().parseAsync(bytes, '')).scene
      },
    })
    context.signal.throwIfAborted()
    const availableModels = pair.models
    if (!availableModels) throw unavailable()
    const models = availableModels
    scene.add(...models)
    scene.add(new HemisphereLight('#ffffff', '#8b97a6', 2))
    const light = new DirectionalLight('#ffffff', 2)
    light.position.set(-2, 3, 3)
    scene.add(light)
    scene.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(models[0], true)
    const bodyHeight = bounds.max.y - bounds.min.y
    if (!Number.isFinite(bodyHeight) || bodyHeight <= 0) throw unavailable()
    models[1].position.x -= bodyHeight * 0.5
    models[0].position.x += bodyHeight * 0.5
    renderer = new WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
    const size = () => {
      if (closed || context.signal.aborted) return
      const nextWidth = Math.floor(canvas.clientWidth),
        nextHeight = Math.floor(canvas.clientHeight)
      if (nextWidth < 2 || nextHeight < 2) return
      if (width === nextWidth && height === nextHeight) return
      width = nextWidth
      height = nextHeight
      renderer?.setSize(width, height, false)
    }
    size()
    if (!width || !height) throw unavailable()
    resize = new ResizeObserver(() => {
      try {
        size()
      } catch {
        onFailure()
      }
    })
    resize.observe(canvas)
    canvas.addEventListener('webglcontextlost', lost)
    // Each half shares white space and lighting, not a box or a separate decorative stage.
    function draw(view: AvatarView) {
      if (!renderer || closed || context.signal.aborted) return
      if (view === 'full') {
        // One camera preserves the shared space: reaching arms must not hit an invisible midpoint.
        const halfX = Math.max(bodyHeight * 1.15, (bodyHeight * 0.6 * width) / height)
        const halfY = (halfX * height) / width
        const center = bounds.min.y + bodyHeight * 0.5
        camera.position.set(0, center, bodyHeight * 3)
        camera.lookAt(0, center, 0)
        camera.near = bodyHeight * 0.01
        camera.far = bodyHeight * 6
        camera.left = -halfX
        camera.right = halfX
        camera.top = halfY
        camera.bottom = -halfY
        camera.updateProjectionMatrix()
        renderer.setScissorTest(false)
        renderer.setViewport(0, 0, width, height)
        renderer.render(scene, camera)
        return
      }
      const framing = view === 'upper' ? [0.77, 0.32] : [0.86, 0.22]
      const center = bounds.min.y + bodyHeight * framing[0]
      const halfY = bodyHeight * framing[1]
      camera.position.set(0, center, bodyHeight * 3)
      camera.lookAt(0, center, 0)
      camera.near = bodyHeight * 0.01
      camera.far = bodyHeight * 6
      renderer.setScissorTest(true)
      try {
        for (const [index, model] of [models[1], models[0]].entries()) {
          camera.position.x = model.position.x
          camera.lookAt(model.position.x, center, 0)
          const leftWidth = Math.floor(width / 2)
          const paneWidth = index === 0 ? leftWidth : width - leftWidth
          const halfX = (halfY * paneWidth) / height
          camera.left = -halfX
          camera.right = halfX
          camera.top = halfY
          camera.bottom = -halfY
          camera.updateProjectionMatrix()
          models[0].visible = model === models[0]
          models[1].visible = model === models[1]
          renderer.setViewport(index === 0 ? 0 : leftWidth, 0, paneWidth, height)
          renderer.setScissor(index === 0 ? 0 : leftWidth, 0, paneWidth, height)
          renderer.render(scene, camera)
        }
      } finally {
        models[0].visible = true
        models[1].visible = true
        renderer.setScissorTest(false)
      }
    }
    await prepareAvatarStage(renderer, scene, camera, context.signal)
    context.signal.addEventListener('abort', aborted, { once: true })
    context.signal.throwIfAborted()
    draw('full')
    const owned = pair
    return Object.freeze({
      alignOnNextFrame() {
        if (closed || context.signal.aborted) return false
        head?.dispose()
        hands?.dispose()
        head = hands = undefined
        requestedAfter = performance.now()
        alignment = 'waiting'
        return true
      },
      getAlignmentStatus: () => alignment,
      observe(frame: PoseRigFrame) {
        if (closed || context.signal.aborted || !owned.observe(frame)) return false
        // The body-only rig allows equal timestamps; detail drivers never refresh from them.
        if (frame.sequence <= lastSequence) return false
        lastSequence = frame.sequence
        if (alignment === 'waiting' && frame.at >= requestedAfter) {
          const captured = readDetailAlignment(frame, context.generation, performance.now(), 1000)
          const common = { context, mirror: true, halfLifeMs: 50, maxAgeMs: 1000 }
          try {
            if (captured?.head)
              head = createHeadRotationRig(models[1], { ...common, ...captured.head })
            if (captured?.hands)
              hands = createObservedHandRig(models[1], { ...common, ...captured.hands })
            alignment = head && hands ? 'aligned' : head || hands ? 'partial' : 'unavailable'
          } catch {
            head?.dispose()
            hands?.dispose()
            head = hands = undefined
            alignment = 'unavailable'
          }
        }
        const single = hasSingleDisplayBody(frame)
        const stamp = { generation: frame.generation, sequence: frame.sequence, at: frame.at }
        head?.push({ ...stamp, rotation: single ? (frame.result.headOrientation ?? null) : null })
        hands?.push({ ...stamp, hands: single ? copyHandObservations(frame.result.hands) : [] })
        return true
      },
      render: (now: number, deltaMs: number, view: AvatarView) => {
        if (closed || context.signal.aborted) return
        if (alignment === 'waiting' && now - requestedAfter > 1000) alignment = 'unavailable'
        owned.render(now, deltaMs)
        head?.render(now, deltaMs)
        hands?.render(now, deltaMs)
        draw(view)
      },
      dispose,
    })
  } catch (error) {
    dispose()
    if (error instanceof ResourceCleanupError) throw error
    throw unavailable()
  }
}
