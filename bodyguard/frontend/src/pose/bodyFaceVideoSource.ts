// FR-M-01/02/07·FR-A-03/NFR-07/08: private same-input result boundary, not identity or coaching.
import { readHeadOrientation } from '../avatar/headOrientationRig'
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import { JOINT_COUNT } from '../posture/landmarks'
import { copyPosePoints, type OwnedPoseResult } from './ownedPoseFrame'
import { createVideoPoseSource } from './videoPoseSource'

type Face = Parameters<typeof readHeadOrientation>[0]
type Layout = Parameters<typeof readHeadOrientation>[1]
type Ports = Readonly<{
  video: HTMLVideoElement
  stream: MediaStream
  detectBody(frame: VideoFrame, at: number): OwnedPoseResult | Promise<OwnedPoseResult>
  detectFace(frame: VideoFrame, at: number): Face | Promise<Face>
  matrixLayout: Layout
}>

/** Caller owns both initialized detectors and camera. One decoded VideoFrame remains
 * borrowed through both invocations; dispose is the barrier before closing detectors.
 * FaceResult is plain JS (no close). Raw face points/matrix never leave this boundary.
 * A shared input is NOT evidence of matching people. Private display may consume
 * the copied candidate; no clinical classifier does. Layout is not inferred calibration.
 */
export function createBodyFaceVideoSource(context: ResourceContext, ports: Ports) {
  const { video, stream, detectBody, detectFace, matrixLayout } = ports
  if (
    typeof detectBody !== 'function' ||
    typeof detectFace !== 'function' ||
    (matrixLayout !== 'column-major' && matrixLayout !== 'row-major')
  )
    throw new Error('Invalid body face source')
  const { signal } = context
  let retiring = false
  const source = createVideoPoseSource(context, {
    video,
    stream,
    detect: async (frame, at) => {
      let body: OwnedPoseResult | undefined, release: OwnedPoseResult['close'] | undefined
      let finished = false,
        cleanupFailed = false
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
        if (retiring || signal.aborted)
          return { landmarks: [], worldLandmarks: [], headOrientation: null, close: finish }
        const landmarks = copyPosePoints(body.landmarks)
        const worldLandmarks = copyPosePoints(body.worldLandmarks)
        let headOrientation: readonly number[] | null = null
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
        // FR-M-02/07: do not calculate a candidate the existing body gate discards.
        if (singleBody && !retiring && !signal.aborted) {
          const face = await detectFace(frame, at)
          if (!retiring && !signal.aborted)
            headOrientation = readHeadOrientation(face, matrixLayout)
        }
        return { landmarks, worldLandmarks, headOrientation, close: finish }
      } catch (error) {
        finish()
        throw error instanceof ResourceCleanupError
          ? error
          : new Error('Body face frame unavailable')
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
