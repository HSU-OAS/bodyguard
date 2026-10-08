// FR-A-01/02/03·FR-M-07: fresh owned GLB preparation, not release/clinical readiness.
import { type Material, type Mesh, Object3D, type SkinnedMesh, type Texture } from 'three'
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import { createDirectionalRig, OBSERVED_LIMB_BINDINGS } from './directionalRig'
import { cloneEightWeightPair } from './eightWeightSkin'
import type { HeadDisplayAlignment } from './headOrientationRig'
import { copyHandAlignment, HAND_RIG_BINDINGS, type HandDisplayAlignment } from './observedHandRig'
import { createObservedPoseRig, type PoseRigFrame } from './observedPoseRig'
import {
  copyReferenceProgram,
  createReferencePlayback,
  type ReferenceCue,
  type ReferenceProgram,
} from './referencePlayback'
import {
  copyFeedbackProgram,
  createSurfaceFeedback,
  type FeedbackFrame,
  type FeedbackProgram,
} from './surfaceFeedback'

type Options = Readonly<{
  load(context: ResourceContext): Object3D | Promise<Object3D>
  mirror: boolean
  halfLifeMs: number
  maxAgeMs: number
  head?: HeadDisplayAlignment
  hands?: HandDisplayAlignment
  reference?: ReferenceProgram
  feedback?: FeedbackProgram
}>
// Never free a loader alias already owned by another call, including a disposed call.
const consumed = new WeakSet<object>()
const unavailable = () => new Error('Avatar asset unavailable')

function inventory(scene: Object3D) {
  const geometries = new Set<Mesh['geometry']>()
  const materials = new Set<Material>()
  const skeletons = new Set<SkinnedMesh['skeleton']>()
  const textures = new Set<Texture>()
  scene.traverse((node) => {
    const mesh = node as SkinnedMesh
    if (!mesh.isMesh) return
    geometries.add(mesh.geometry)
    if (mesh.isSkinnedMesh) {
      skeletons.add(mesh.skeleton)
      if (mesh.skeleton.boneTexture) textures.add(mesh.skeleton.boneTexture)
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
    }
  })
  return { geometries, materials, skeletons, textures }
}

function ownedSourceCleanup(scene: Object3D) {
  const { geometries, materials, skeletons, textures } = inventory(scene)
  const resources = [...geometries, ...materials, ...skeletons, ...textures]
  const shared = new Set(resources.filter((resource) => consumed.has(resource)))
  const ownedSkeletons = [...skeletons].filter(
    (skeleton) =>
      !shared.has(skeleton) && (!skeleton.boneTexture || !shared.has(skeleton.boneTexture)),
  )
  const skeletonTextures = new Set<Texture | null>(
    ownedSkeletons.map((skeleton) => skeleton.boneTexture),
  )
  const owned = [
    ...ownedSkeletons,
    ...geometries,
    ...materials,
    ...[...textures].filter((texture) => !skeletonTextures.has(texture)),
  ].filter((resource) => !shared.has(resource))
  // Reserve atomically before user disposal code can reenter. A mixed alias is rejected,
  // reclaiming only its fresh resources and never freeing another lease's handles.
  for (const resource of resources) consumed.add(resource)
  let disposed = false,
    failed = false
  return {
    alias: shared.size > 0,
    dispose: () => {
      if (!disposed) {
        disposed = true
        for (const resource of owned) {
          try {
            resource.dispose()
          } catch {
            failed = true
          }
        }
      }
      if (failed) throw new ResourceCleanupError()
    },
  }
}

/** Loader transfers a fresh owned scene; it must reclaim any partial work on rejection.
 * Caller owns renderer/camera/SDK. Source/clone/rig handles never leave browser memory.
 * A valid pair only proves technical loading, not avatar quality or a correct exercise.
 */
export async function prepareOwnedAvatarPair(context: ResourceContext, options: Options) {
  const { generation, signal } = context
  const { load, mirror, halfLifeMs, maxAgeMs } = options
  let head: HeadDisplayAlignment | undefined
  let hands: HandDisplayAlignment | undefined
  let referenceProgram: ReferenceProgram | undefined
  let feedbackProgram: FeedbackProgram | undefined
  try {
    const supplied = options.head
    if (supplied)
      head = Object.freeze({
        bone: supplied.bone,
        cameraReference: Object.freeze(Array.from(supplied.cameraReference)),
        sceneFromCamera: Object.freeze(Array.from(supplied.sceneFromCamera)),
      })
    const suppliedHands = options.hands
    if (suppliedHands) hands = copyHandAlignment(suppliedHands)
    const suppliedReference = options.reference
    if (suppliedReference !== undefined) referenceProgram = copyReferenceProgram(suppliedReference)
    const suppliedFeedback = options.feedback
    if (suppliedFeedback !== undefined) feedbackProgram = copyFeedbackProgram(suppliedFeedback)
  } catch {
    throw unavailable()
  }
  if (
    !Number.isSafeInteger(generation) ||
    generation <= 0 ||
    !signal ||
    signal.aborted ||
    typeof load !== 'function' ||
    typeof mirror !== 'boolean' ||
    !Number.isFinite(halfLifeMs) ||
    halfLifeMs <= 0 ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs <= 0
  )
    throw unavailable()
  const owner = Object.freeze({ generation, signal })
  let source: Object3D
  try {
    source = await load(owner)
  } catch (error) {
    if (error instanceof ResourceCleanupError) throw error
    throw unavailable()
  }
  if (!(source instanceof Object3D) || consumed.has(source)) throw unavailable()
  consumed.add(source)
  const sourceOwner = ownedSourceCleanup(source)
  let pair: ReturnType<typeof cloneEightWeightPair> | undefined
  let user: ReturnType<typeof createObservedPoseRig> | undefined
  let reference: ReturnType<typeof createDirectionalRig> | undefined
  let playback: ReturnType<typeof createReferencePlayback> | undefined
  let feedback: ReturnType<typeof createSurfaceFeedback> | undefined
  let closed = false,
    cleanupFailed = false
  function dispose() {
    if (!closed) {
      closed = true
      signal.removeEventListener('abort', aborted)
      for (const action of [
        () => user?.dispose(),
        () => feedback?.dispose(),
        () => reference?.dispose(),
        () => playback?.dispose(),
        ...(pair?.copies.map((model) => () => model.removeFromParent()) ?? []),
        () => pair?.dispose(),
        sourceOwner.dispose,
      ]) {
        try {
          action()
        } catch {
          cleanupFailed = true
        }
      }
    }
    if (cleanupFailed) throw new ResourceCleanupError()
  }
  function aborted() {
    // Abort events must not expose native errors. The controller's later dispose observes failure.
    try {
      dispose()
    } catch {
      /* Fixed error is returned by dispose, never thrown from an event. */
    }
  }
  try {
    if (signal.aborted || sourceOwner.alias) throw unavailable()
    const boundBones = new Set<Object3D>()
    let skinnedCount = 0
    source.traverse((node) => {
      const mesh = node as SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      const position = mesh.geometry.getAttribute('position')
      const weights = mesh.geometry.getAttribute('skinWeight')
      if (
        !position ||
        position.count === 0 ||
        position.itemSize !== 3 ||
        weights?.count !== position.count
      )
        throw unavailable()
      skinnedCount++
      for (const bone of mesh.skeleton.bones) boundBones.add(bone)
    })
    if (
      !skinnedCount ||
      OBSERVED_LIMB_BINDINGS.some(
        ({ bone, anchor }) =>
          !boundBones.has(source.getObjectByName(bone) as Object3D) ||
          !boundBones.has(source.getObjectByName(anchor) as Object3D),
      ) ||
      (head && !boundBones.has(source.getObjectByName(head.bone) as Object3D)) ||
      (hands &&
        [...HAND_RIG_BINDINGS.map((b) => b.bone), 'wristL', 'wristR'].some(
          (name) => !boundBones.has(source.getObjectByName(name) as Object3D),
        ))
    )
      throw unavailable()
    pair = cloneEightWeightPair(source)
    for (const model of pair.copies) {
      consumed.add(model)
      const resources = inventory(model)
      for (const group of Object.values(resources))
        for (const resource of group) consumed.add(resource)
    }
    const rig = { context: owner, bindings: OBSERVED_LIMB_BINDINGS, halfLifeMs, maxAgeMs }
    reference = createDirectionalRig(pair.copies[0], rig)
    if (referenceProgram)
      playback = createReferencePlayback(pair.copies[0], {
        context: owner,
        program: referenceProgram,
      })
    user = createObservedPoseRig(pair.copies[1], { ...rig, mirror, head, hands })
    if (feedbackProgram)
      feedback = createSurfaceFeedback(pair.copies[1], {
        context: owner,
        program: feedbackProgram,
        maxAgeMs,
      })
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) throw unavailable()
  } catch (error) {
    dispose()
    if (error instanceof ResourceCleanupError) throw error
    throw unavailable()
  }
  const models = Object.freeze([pair.copies[0], pair.copies[1]] as const)
  const driver = user
  return Object.freeze({
    get models() {
      return closed || signal.aborted ? null : models
    },
    observe: (frame: PoseRigFrame) => {
      if (closed || signal.aborted) return false
      const accepted = driver.observe(frame)
      if (accepted) feedback?.observe(driver.getCoverage())
      else if (driver.getCoverage() === null) feedback?.observe(null)
      return accepted
    },
    updateFeedback: (frame: FeedbackFrame) =>
      !closed && !signal.aborted && Boolean(feedback?.update(frame)),
    updateReference: (cue: ReferenceCue) =>
      !closed && !signal.aborted && Boolean(playback?.update(cue)),
    render: (
      now: number,
      deltaMs: number,
    ): ReturnType<typeof driver.render> &
      Readonly<{
        reference?: ReturnType<NonNullable<typeof playback>['render']>
        feedback?: ReturnType<NonNullable<typeof feedback>['render']>
      }> => {
      const result = driver.render(now, deltaMs)
      return playback || feedback
        ? Object.freeze({
            ...result,
            ...(playback ? { reference: playback.render(now, deltaMs) } : {}),
            ...(feedback
              ? {
                  feedback: feedback.render(
                    now,
                    result.status === 'tracking' || result.status === 'partial',
                  ),
                }
              : {}),
          })
        : result
    },
    dispose,
  })
}
