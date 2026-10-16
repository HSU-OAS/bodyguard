// FR-S-03/04·FR-A-01/03: manual DEV-only authored guide; no camera/clinical state.
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  type Material,
  type Mesh,
  type Object3D,
  OrthographicCamera,
  Scene,
  type SkinnedMesh,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import { assertBlenderReferenceBinding, blenderReferenceProgram } from './blenderReferenceProgram'
import { cloneEightWeightPair } from './eightWeightSkin'
import { type ComparisonStatus, createObservedComparison } from './observedComparison'
import { prepareAvatarStage } from './prepareAvatarStage'
import { type ReferenceMotion, referenceContentAsset } from './referenceContentAssets'
import { referenceFraming } from './referenceFraming'
import { createReferencePlayback, type ReferenceCue } from './referencePlayback'
import { type AvatarGender, REVIEW_AVATAR_ASSETS } from './reviewAvatarAssets'
import { readVerifiedReferenceAsset } from './verifiedReferenceAsset'

export type ReferenceView = 'full' | 'upper' | 'detail'
export type ReferenceCommand = Readonly<{
  phase: ReferenceCue['phase']
  stepId: 'left' | 'right' | 'both'
  playing: boolean
  revision: number
  view: ReferenceView
}>
export type ReferenceStage = Awaited<ReturnType<typeof prepareReferenceStage>>

export async function prepareReferenceStage(
  context: ResourceContext,
  options: Readonly<{
    canvas: HTMLCanvasElement
    gender: AvatarGender
    motion: ReferenceMotion
    onFailure(): void
    onObservation?(status: ComparisonStatus): void
  }>,
) {
  if (!import.meta.env.DEV) throw new Error('Blender reference unavailable')
  const { signal, generation } = context,
    { canvas, gender, motion, onFailure } = options
  let source: Object3D | undefined, pair: ReturnType<typeof cloneEightWeightPair> | undefined
  let player: ReturnType<typeof createReferencePlayback> | undefined,
    observed: ReturnType<typeof createObservedComparison> | undefined,
    renderer: WebGLRenderer | undefined,
    resize: ResizeObserver | undefined
  let closed = false,
    cleanupFailed = false,
    sequence = 0,
    revision = -1,
    width = 0,
    height = 0
  const scene = new Scene(),
    camera = new OrthographicCamera()
  scene.background = new Color('#ffffff')
  const lost = (event: Event) => {
    event.preventDefault()
    if (!closed) onFailure()
  }
  function dispose() {
    if (!closed) {
      closed = true
      signal.removeEventListener('abort', aborted)
      canvas.removeEventListener('webglcontextlost', lost)
      const original = new Set<{ dispose(): void }>()
      source?.traverse((node) => {
        const mesh = node as SkinnedMesh
        if (!(node as Mesh).isMesh) return
        original.add(mesh.geometry)
        if (mesh.isSkinnedMesh) original.add(mesh.skeleton)
        for (const material of (Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]) as Material[])
          original.add(material)
      })
      for (const release of [
        () => resize?.disconnect(),
        () => player?.dispose(),
        () => observed?.dispose(),
        () => pair?.dispose(),
        ...[...original].map((resource) => () => resource.dispose()),
        () => {
          renderer?.setScissorTest(false)
          renderer?.clear()
        },
        () => renderer?.dispose(),
        () => {
          if (renderer && !renderer.getContext().isContextLost()) renderer.forceContextLoss()
        },
        () => scene.clear(),
      ])
        try {
          release()
        } catch {
          cleanupFailed = true
        }
      source = undefined
    }
    if (cleanupFailed) throw new ResourceCleanupError()
  }
  function aborted() {
    try {
      dispose()
    } catch {
      /* Explicit owner close reports cleanup failure. */
    }
  }
  try {
    const animationBytes = await readVerifiedReferenceAsset(
      referenceContentAsset(gender, motion),
      signal,
    )
    const animation = await new GLTFLoader().parseAsync(animationBytes, '')
    signal.throwIfAborted()
    const program = blenderReferenceProgram(motion, animation)
    const body = await readVerifiedReferenceAsset(REVIEW_AVATAR_ASSETS[gender], signal)
    source = (await new GLTFLoader().parseAsync(body, '')).scene
    signal.throwIfAborted()
    assertBlenderReferenceBinding(source, animation.scene)
    pair = cloneEightWeightPair(source)
    const [guide, user] = pair.copies
    observed = createObservedComparison(user, signal)
    scene.add(guide, user, new HemisphereLight('#ffffff', '#8b97a6', 2))
    const light = new DirectionalLight('#ffffff', 2)
    light.position.set(-2, 3, 3)
    scene.add(light)
    const bounds = new Box3().setFromObject(guide, true),
      bodyHeight = bounds.max.y - bounds.min.y
    if (!Number.isFinite(bodyHeight) || bodyHeight <= 0) throw new Error()
    player = createReferencePlayback(guide, { context, program })
    renderer = new WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
    function size() {
      if (closed || signal.aborted) return
      const w = Math.floor(canvas.clientWidth),
        h = Math.floor(canvas.clientHeight)
      if (w < 2 || h < 2) return
      if (w !== width || h !== height) {
        width = w
        height = h
        renderer?.setSize(w, h, false)
      }
    }
    function draw(view: ReferenceView, paint = true) {
      if (!renderer || closed) return
      size()
      const framing = referenceFraming(bodyHeight, width, height, view, motion)
      const center = bounds.min.y + framing.centerY,
        { halfX, halfY } = framing
      guide.position.x = framing.guideX
      user.position.x = -framing.guideX
      camera.position.set(0, center, bodyHeight * 3)
      camera.lookAt(0, center, 0)
      camera.near = bodyHeight * 0.01
      camera.far = bodyHeight * 6
      if (view !== 'full') {
        // Cropped views share the white canvas, but arms must not cover the other comparison.
        const leftWidth = Math.floor(width / 2),
          visible = [user.visible, guide.visible]
        renderer.setScissorTest(true)
        try {
          for (const [index, model] of [user, guide].entries()) {
            const paneWidth = index === 0 ? leftWidth : width - leftWidth
            const cropY = bodyHeight * (view === 'upper' ? 0.35 : 0.24)
            const cropX = (cropY * paneWidth) / height
            camera.position.x = model.position.x
            camera.lookAt(model.position.x, center, 0)
            camera.left = -cropX
            camera.right = cropX
            camera.top = cropY
            camera.bottom = -cropY
            camera.updateProjectionMatrix()
            user.visible = index === 0 && visible[0]
            guide.visible = index === 1 && visible[1]
            renderer.setViewport(index === 0 ? 0 : leftWidth, 0, paneWidth, height)
            renderer.setScissor(index === 0 ? 0 : leftWidth, 0, paneWidth, height)
            if (paint) renderer.render(scene, camera)
          }
        } finally {
          ;[user.visible, guide.visible] = visible
          renderer.setScissorTest(false)
        }
        return
      }
      camera.left = -halfX
      camera.right = halfX
      camera.top = halfY
      camera.bottom = -halfY
      camera.updateProjectionMatrix()
      renderer.setViewport(0, 0, width, height)
      renderer.setScissorTest(false)
      if (paint) renderer.render(scene, camera)
    }
    size()
    if (!width || !height) throw new Error()
    draw('full', false)
    // Pending GPU preparation is awaited by the component's retirement barrier before reuse.
    await prepareAvatarStage(renderer, scene, camera, signal)
    resize = new ResizeObserver(() => {
      try {
        size()
      } catch {
        onFailure()
      }
    })
    resize.observe(canvas)
    canvas.addEventListener('webglcontextlost', lost)
    signal.addEventListener('abort', aborted, { once: true })
    signal.throwIfAborted()
    let previousObservation: ComparisonStatus | undefined
    return Object.freeze({
      beginObservation: (ownerGeneration: number) => observed?.begin(ownerGeneration) ?? false,
      observe: (frame: Parameters<ReturnType<typeof createObservedComparison>['observe']>[0]) =>
        observed?.observe(frame) ?? false,
      suspendObservation() {
        observed?.suspend()
      },
      alignObservation: () => observed?.align() ?? false,
      render(now: number, delta: number, command: ReferenceCommand) {
        if (closed || signal.aborted || !player) return
        if (command.revision !== revision) {
          player.dispose()
          player = createReferencePlayback(guide, { context, program })
          revision = command.revision
        }
        if (
          !player.update({
            generation,
            sequence: ++sequence,
            at: now,
            motionId: program.motionId,
            version: program.version,
            stepId: command.stepId,
            phase: command.phase,
            status: command.playing ? 'running' : 'paused',
          })
        )
          throw new Error('Blender reference unavailable')
        const state = player.render(now, delta)
        if (state.status === 'unavailable' || state.status === 'stale' || state.status === 'closed')
          throw new Error('Blender reference unavailable')
        const observedState = observed?.render(now, delta) ?? 'waiting'
        if (observedState !== previousObservation) {
          previousObservation = observedState
          options.onObservation?.(observedState)
        }
        draw(command.view)
        return observed?.getSnapshot()
      },
      dispose,
    })
  } catch (error) {
    dispose()
    if (error instanceof ResourceCleanupError) throw error
    throw new Error('Blender reference unavailable')
  }
}
