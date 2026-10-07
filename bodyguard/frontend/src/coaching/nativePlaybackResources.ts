// FR-M-01/02/07·FR-A-01/03·FR-S-02/04/NFR-07/08: native ownership, no public consumer.
import { prepareOwnedAvatarPair } from '../avatar/ownedAvatarPair'
import { type CameraErrorKind, cameraErrorKind, closeCamera, openCamera } from '../pose/camera'
import { POSE_MODELS, type PoseModel } from '../pose/constants'
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
  if (
    typeof model !== 'string' ||
    !Object.hasOwn(POSE_MODELS, model) ||
    typeof loadAvatar !== 'function' ||
    typeof mirror !== 'boolean' ||
    !Number.isFinite(halfLifeMs) ||
    halfLifeMs <= 0 ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs <= 0
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
      const dispose = ownNative(context, () => native.landmarker.close())
      return {
        dispose,
        detect(frame: VideoFrame, at: number) {
          context.signal.throwIfAborted()
          return native.landmarker.detectForVideo(frame, at)
        },
      }
    },
    avatars: (context) =>
      prepareOwnedAvatarPair(context, { load: loadAvatar, mirror, halfLifeMs, maxAgeMs }),
    source: (context, camera, inference) =>
      createVideoPoseSource(context, {
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
