// FR-M-01/02/07·FR-A-03/NFR-07/08: private candidates, not person matching or coaching.
import { readHeadOrientation } from '../avatar/headOrientationRig'
import { copyHandObservations, type HandObservation } from '../avatar/observedHandRig'
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import { JOINT_COUNT, type Point } from '../posture/landmarks'
import { copyPosePoints, type OwnedPoseResult } from './ownedPoseFrame'
import { createVideoPoseSource } from './videoPoseSource'

type NativeHands = Readonly<{
  landmarks: readonly (readonly Point[])[]
  worldLandmarks: readonly (readonly Point[])[]
  handedness: readonly (readonly Readonly<{ categoryName: string; score: number }>[])[]
}>
type Ports = Readonly<{
  video: HTMLVideoElement
  stream: MediaStream
  detectBody(frame: VideoFrame, at: number): OwnedPoseResult | Promise<OwnedPoseResult>
  detectHands(frame: VideoFrame, at: number): NativeHands | Promise<NativeHands>
  face?: Readonly<{
    detectFace(
      frame: VideoFrame,
      at: number,
    ):
      | Parameters<typeof readHeadOrientation>[0]
      | Promise<Parameters<typeof readHeadOrientation>[0]>
    matrixLayout: Parameters<typeof readHeadOrientation>[1]
  }>
}>

/** SDK labels are candidates, not anatomical/person proof. No score threshold, mirror
 * swap, gesture or deprecated handednesses field. Caller handles a foreign getter failure. */
export function readNativeHands(value: NativeHands): readonly HandObservation[] {
  const image = value.landmarks,
    world = value.worldLandmarks,
    labels = value.handedness
  if (
    !Array.isArray(image) ||
    !Array.isArray(world) ||
    !Array.isArray(labels) ||
    image.length > 2 ||
    image.length !== world.length ||
    image.length !== labels.length
  )
    return Object.freeze([])
  const candidates: HandObservation[] = [],
    seen = new Set<string>()
  for (let i = 0; i < image.length; i++) {
    const categories = labels[i]
    if (!Array.isArray(categories) || categories.length !== 1) return Object.freeze([])
    const name = categories[0]?.categoryName,
      score = categories[0]?.score
    if (
      (name !== 'Left' && name !== 'Right') ||
      seen.has(name) ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 1
    )
      return Object.freeze([])
    seen.add(name)
    candidates.push({
      side: name === 'Left' ? 'left' : 'right',
      landmarks: image[i],
      worldLandmarks: world[i],
    })
  }
  return copyHandObservations(candidates)
}

/** Caller owns camera and initialized SDKs. One frozen input stays borrowed until all
 * sequential invocations return. dispose is the barrier before closing those resources.
 * Body is copied before face, face orientation before hands, hands before body close.
 * JS Face/Gesture results have no close. Raw face matrix/categories never leave here. */
export function createBodyHandVideoSource(context: ResourceContext, ports: Ports) {
  const { video, stream, detectBody, detectHands } = ports
  let face: Ports['face']
  try {
    const requestedFace = ports.face
    if (requestedFace !== undefined) {
      if (!requestedFace) throw new Error()
      const detectFace = requestedFace.detectFace,
        matrixLayout = requestedFace.matrixLayout
      if (
        typeof detectFace !== 'function' ||
        (matrixLayout !== 'column-major' && matrixLayout !== 'row-major')
      )
        throw new Error()
      face = Object.freeze({ detectFace, matrixLayout })
    }
  } catch {
    throw new Error('Invalid body hand source')
  }
  if (typeof detectBody !== 'function' || typeof detectHands !== 'function')
    throw new Error('Invalid body hand source')
  const { signal } = context
  let retiring = false
  const source = createVideoPoseSource(context, {
    video,
    stream,
    detect: async (frame, at) => {
      let body: OwnedPoseResult | undefined, release: OwnedPoseResult['close'] | undefined
      let finished = false,
        cleanupFailed = false
      const active = () => !retiring && !signal.aborted
      function finish() {
        if (!finished) {
          finished = true
          if (body) {
            try {
              if (typeof release !== 'function') throw new Error()
              release.call(body)
            } catch {
              cleanupFailed = true
            }
          }
        }
        if (cleanupFailed) throw new ResourceCleanupError()
      }
      try {
        signal.throwIfAborted()
        body = await detectBody(frame, at)
        release = body.close
        if (typeof release !== 'function') throw new ResourceCleanupError()
        const landmarks = active() ? copyPosePoints(body.landmarks) : []
        const worldLandmarks = active() ? copyPosePoints(body.worldLandmarks) : []
        const singleBody =
          landmarks.length === 1 &&
          worldLandmarks.length === 1 &&
          [landmarks[0], worldLandmarks[0]].every(
            (points) =>
              points.length === JOINT_COUNT &&
              Array.from(points).every(
                (point) => point && [point.x, point.y, point.z].every(Number.isFinite),
              ),
          )
        let headOrientation: readonly number[] | null = null
        let hands: readonly HandObservation[] = Object.freeze([])
        // FR-M-02/07: keep initialized tasks for the next usable body; skip discarded candidates.
        if (singleBody && face && active()) {
          const nativeFace = await face.detectFace(frame, at)
          if (active()) headOrientation = readHeadOrientation(nativeFace, face.matrixLayout)
        }
        if (singleBody && active()) {
          const nativeHands = await detectHands(frame, at)
          if (active()) hands = readNativeHands(nativeHands)
        }
        return {
          landmarks,
          worldLandmarks,
          hands,
          ...(face ? { headOrientation } : {}),
          close: finish,
        }
      } catch (error) {
        finish()
        throw error instanceof ResourceCleanupError
          ? error
          : new Error('Body hand frame unavailable')
      }
    },
  })
  return Object.freeze({
    read: source.read,
    dispose() {
      retiring = true
      return source.dispose()
    },
  })
}
