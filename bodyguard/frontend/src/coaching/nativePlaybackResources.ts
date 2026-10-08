// FR-M-01/02/07·FR-A-01/03·FR-S-02/04/NFR-07/08: native ownership, no public consumer.

import type { HeadDisplayAlignment } from '../avatar/headOrientationRig'
import { copyHandAlignment, type HandDisplayAlignment } from '../avatar/observedHandRig'
import { prepareOwnedAvatarPair } from '../avatar/ownedAvatarPair'
import { createBodyFaceVideoSource } from '../pose/bodyFaceVideoSource'
import { createBodyHandVideoSource } from '../pose/bodyHandVideoSource'
import { type CameraErrorKind, cameraErrorKind, closeCamera, openCamera } from '../pose/camera'
import { POSE_MODELS, type PoseModel } from '../pose/constants'
import { createFaceLandmarker } from '../pose/face'
import { createGestureRecognizer } from '../pose/hands'
import { createPoseLandmarker } from '../pose/landmarker'
import { createVideoPoseSource } from '../pose/videoPoseSource'
import { createOwnedPlaybackResources } from './ownedPlaybackResources'
import { ResourceCleanupError, type ResourceContext, type ResourceNotice } from './resources'

type Pair = Awaited<ReturnType<typeof prepareOwnedAvatarPair>>
type Rig = Parameters<typeof prepareOwnedAvatarPair>[1]
type Bridge = Parameters<typeof createOwnedPlaybackResources>[0]
type Options = Readonly<{
  model: PoseModel
  loadAvatar: Rig['load']
  mirror: boolean
  halfLifeMs: number
  maxAgeMs: number
  head?: HeadDisplayAlignment & Readonly<{ matrixLayout: 'column-major' | 'row-major' }>
  hands?: HandDisplayAlignment
  scheduler: Bridge['scheduler']
  render(pair: Pair): unknown
  onFailure(notice: Extract<ResourceNotice, { type: 'error' }>): void | Promise<void>
}>

// Abort listeners never throw native errors. Explicit disposal preserves cleanup failure.
function ownNative(context: ResourceContext, close: () => void) {
  let disposed = false,
    failed = false
  function dispose() {
    if (!disposed) {
      disposed = true
      context.signal.removeEventListener('abort', aborted)
      try {
        close()
      } catch {
        failed = true
      }
    }
    if (failed) throw new ResourceCleanupError()
  }
  function aborted() {
    try {
      dispose()
    } catch {
      /* The later explicit dispose observes the fixed failure. */
    }
  }
  context.signal.addEventListener('abort', aborted, { once: true })
  if (context.signal.aborted) {
    dispose()
    context.signal.throwIfAborted()
  }
  return dispose
}

/** Fresh bridge per recorded owner. Caller supplies the explicit model, owned source loader,
 * validated rig controls, renderer and scheduler. No release asset/model or clinical defaults.
 * Current SDK behavior is unchanged; a production egress policy still requires approval.
 */
export function createNativePlaybackResources(options: Options) {
  const { model, loadAvatar, mirror, halfLifeMs, maxAgeMs, scheduler, render, onFailure } = options
  // Snapshot caller-owned alignment before camera/SDK awaits. Numeric roundoff only,
  // not a neutral-pose detector, anatomical angle or clinical acceptance threshold.
  let head: Options['head']
  let hands: HandDisplayAlignment | undefined
  try {
    const requestedHands = options.hands
    if (requestedHands !== undefined) hands = copyHandAlignment(requestedHands)
    const requested = options.head
    if (requested !== undefined) {
      if (
        !requested ||
        !Array.isArray(requested.cameraReference) ||
        !Array.isArray(requested.sceneFromCamera) ||
        requested.cameraReference.length !== 4 ||
        requested.sceneFromCamera.length !== 4
      )
        throw new Error()
      head = Object.freeze({
        bone: requested.bone,
        matrixLayout: requested.matrixLayout,
        cameraReference: Object.freeze(Array.from(requested.cameraReference)),
        sceneFromCamera: Object.freeze(Array.from(requested.sceneFromCamera)),
      })
    }
  } catch {
    throw new Error('Invalid native playback resources')
  }
  if (
    typeof model !== 'string' ||
    !Object.hasOwn(POSE_MODELS, model) ||
    typeof loadAvatar !== 'function' ||
    typeof mirror !== 'boolean' ||
    !Number.isFinite(halfLifeMs) ||
    halfLifeMs <= 0 ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs <= 0 ||
    (head &&
      (head.bone !== 'head' ||
        (head.matrixLayout !== 'column-major' && head.matrixLayout !== 'row-major') ||
        [head.cameraReference, head.sceneFromCamera].some(
          (q) =>
            q.length !== 4 || !q.every(Number.isFinite) || Math.abs(Math.hypot(...q) - 1) > 1e-5,
        )))
  )
    throw new Error('Invalid native playback resources')
  let cameraError: CameraErrorKind | null = null
  const bridge = createOwnedPlaybackResources({
    async camera(context) {
      cameraError = null
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.hidden = true
      try {
        const stream = await openCamera(video, context.signal)
        const dispose = ownNative(context, () => {
          try {
            closeCamera(video, stream)
          } finally {
            video.remove()
          }
        })
        return { video, stream, dispose }
      } catch (error) {
        video.remove()
        if (!context.signal.aborted) cameraError = cameraErrorKind(error)
        throw error
      }
    },
    async inference(context) {
      const native = await createPoseLandmarker(model)
      const disposeBody = ownNative(context, () => native.landmarker.close())
      let face: Awaited<ReturnType<typeof createFaceLandmarker>> | undefined
      let disposeFace: (() => void) | undefined
      let gesture: Awaited<ReturnType<typeof createGestureRecognizer>> | undefined
      let disposeHands: (() => void) | undefined
      function disposeInference() {
        let failed = false
        for (const release of [disposeHands, disposeFace, disposeBody]) {
          try {
            release?.()
          } catch {
            failed = true
          }
        }
        if (failed) throw new ResourceCleanupError()
      }
      try {
        if (head) {
          const ownedFace = await createFaceLandmarker()
          face = ownedFace
          disposeFace = ownNative(context, () => ownedFace.landmarker.close())
        }
        if (hands) {
          const ownedHands = await createGestureRecognizer()
          gesture = ownedHands
          disposeHands = ownNative(context, () => ownedHands.recognizer.close())
        }
      } catch (error) {
        // Attempt every earlier release, even when one close failed.
        disposeInference()
        throw error
      }
      const detectBody = (frame: VideoFrame, at: number) => {
        context.signal.throwIfAborted()
        return native.landmarker.detectForVideo(frame, at)
      }
      return {
        dispose: disposeInference,
        detect: detectBody,
        detectBody,
        detectFace(frame: VideoFrame, at: number) {
          context.signal.throwIfAborted()
          if (!face) throw new Error('Face inference unavailable')
          return face.landmarker.detectForVideo(frame, at)
        },
        detectHands(frame: VideoFrame, at: number) {
          context.signal.throwIfAborted()
          if (!gesture) throw new Error('Hand inference unavailable')
          return gesture.recognizer.recognizeForVideo(frame, at)
        },
      }
    },
    avatars: (context) =>
      prepareOwnedAvatarPair(context, {
        load: loadAvatar,
        mirror,
        halfLifeMs,
        maxAgeMs,
        ...(hands ? { hands } : {}),
        ...(head
          ? {
              head: {
                bone: head.bone,
                cameraReference: head.cameraReference,
                sceneFromCamera: head.sceneFromCamera,
              },
            }
          : {}),
      }),
    source: (context, camera, inference) =>
      hands
        ? createBodyHandVideoSource(context, {
            video: camera.video,
            stream: camera.stream,
            detectBody: inference.detectBody,
            detectHands: inference.detectHands,
            ...(head
              ? { face: { detectFace: inference.detectFace, matrixLayout: head.matrixLayout } }
              : {}),
          })
        : head
          ? createBodyFaceVideoSource(context, {
              video: camera.video,
              stream: camera.stream,
              detectBody: inference.detectBody,
              detectFace: inference.detectFace,
              matrixLayout: head.matrixLayout,
            })
          : createVideoPoseSource(context, {
              video: camera.video,
              stream: camera.stream,
              detect: inference.detect,
            }),
    scheduler,
    render,
    onFailure,
  })
  return Object.freeze({
    ports: bridge.ports,
    start: bridge.start,
    close: bridge.close,
    getSnapshot: () => Object.freeze({ ...bridge.getSnapshot(), cameraError }),
  })
}
