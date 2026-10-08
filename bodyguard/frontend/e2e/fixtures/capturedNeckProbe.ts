// FR-M-01/02/07·NFR-07/08: PRIVATE fake-camera/native SDK connection, not clinical validation.
import { closeCamera, openCamera } from '../../src/pose/camera'
import { createPoseLandmarker } from '../../src/pose/landmarker'
import { copyPosePoints } from '../../src/pose/ownedPoseFrame'
import { createVideoPoseSource } from '../../src/pose/videoPoseSource'
import { createWorkerPoseInference } from '../../src/pose/workerInference'
import { observeCapturedNeckSide } from '../../src/posture/neckSideObservation'

export async function mountCapturedNeckProbe(mode: 'main' | 'worker') {
  const video = document.createElement('video'),
    abort = new AbortController()
  video.muted = video.playsInline = video.hidden = true
  video.style.scale = '-1 1'
  document.body.append(video)
  let stream: MediaStream | undefined, source: ReturnType<typeof createVideoPoseSource> | undefined
  let disposeInference: (() => void | Promise<void>) | undefined
  let frames = 0,
    closes = 0,
    nativeResults = 0,
    unavailable = 0,
    syntheticChecks = 0
  let sourceGeometryMatches = true,
    syntheticChecksPassed = true,
    closed = false
  let captured: { width: number; height: number } | undefined
  const NativeFrame = globalThis.VideoFrame
  class TrackedFrame extends NativeFrame {
    constructor(input: CanvasImageSource, options?: VideoFrameInit)
    constructor(input: AllowSharedBufferSource, options: VideoFrameBufferInit)
    constructor(
      input: CanvasImageSource | AllowSharedBufferSource,
      options?: VideoFrameInit | VideoFrameBufferInit,
    ) {
      if (options && 'codedWidth' in options) super(input as AllowSharedBufferSource, options)
      else super(input as CanvasImageSource, options)
      frames++
    }
    close() {
      closes++
      super.close()
    }
  }
  globalThis.VideoFrame = TrackedFrame
  async function close() {
    if (closed) return snapshot()
    closed = true
    abort.abort()
    try {
      await source?.dispose()
    } finally {
      try {
        await disposeInference?.()
      } finally {
        if (stream) closeCamera(video, stream)
        video.remove()
        globalThis.VideoFrame = NativeFrame
      }
    }
    return snapshot()
  }
  function snapshot() {
    return {
      frames,
      closes,
      nativeResults,
      unavailable,
      syntheticChecks,
      sourceGeometryMatches,
      syntheticChecksPassed,
      closed,
      tracksEnded: stream?.getTracks().every((t) => t.readyState === 'ended') ?? true,
      detached: video.srcObject === null,
      rawVideoHidden: video.hidden,
      actualHuman: false,
      actualCamera: false,
    }
  }
  try {
    stream = await openCamera(video, abort.signal)
    const native = mode === 'main' ? await createPoseLandmarker('lite') : undefined
    const worker =
      mode === 'worker'
        ? await createWorkerPoseInference(
            { generation: 1, signal: abort.signal },
            { model: 'lite', face: false, hands: false, matrixLayout: 'column-major' },
          )
        : undefined
    disposeInference = () => (native ? native.landmarker.close() : worker?.dispose())
    source = createVideoPoseSource(
      { generation: 1, signal: abort.signal },
      {
        video,
        stream,
        async detect(input, at) {
          captured = { width: input.displayWidth, height: input.displayHeight }
          if (worker) return worker.detect(input, at)
          if (!native) throw new Error('Private detector unavailable')
          return native.landmarker.detectForVideo(input, at)
        },
      },
    )
    return {
      close,
      snapshot,
      async read() {
        const frame = await source?.read()
        if (!frame) throw new Error('Private captured input unavailable')
        nativeResults++
        const image = frame.image
        sourceGeometryMatches &&= Boolean(
          image &&
            captured &&
            image.width === captured.width &&
            image.height === captured.height &&
            image.imageIsMirrored === false &&
            Object.isFrozen(image),
        )
        const options = { now: performance.now(), minimumConfidence: 0.8, maxAgeMs: 250 }
        const actual = observeCapturedNeckSide({ frame, ...options })
        if (actual.status === 'unavailable') unavailable++
        // Separate authored points, never a positive native observation or classification.
        const points = Array.from({ length: 33 }, () => ({
          x: 0.5,
          y: 0.5,
          z: 0,
          visibility: 1,
          presence: 1,
        }))
        points[7] = { x: 0.4, y: 0.2, z: 0, visibility: 1, presence: 1 }
        points[8] = { x: 0.6, y: 0.1, z: 0, visibility: 1, presence: 1 }
        points[11] = { x: 0.3, y: 0.4, z: 0, visibility: 1, presence: 1 }
        points[12] = { x: 0.7, y: 0.4, z: 0, visibility: 1, presence: 1 }
        const synthetic = {
          ...frame,
          result: { landmarks: copyPosePoints(copyPosePoints([points])) },
        }
        const projected = observeCapturedNeckSide({ frame: synthetic, ...options, now: frame.at })
        syntheticChecks++
        syntheticChecksPassed &&= Boolean(
          image &&
            projected.status === 'available' &&
            Math.abs(
              projected.headShoulderLineAngleRad -
                Math.atan2(0.1 * image.height, 0.2 * image.width),
            ) < 1e-12 &&
            projected.generation === frame.generation &&
            projected.sequence === frame.sequence &&
            projected.at === frame.at &&
            !('classification' in projected),
        )
        points[7].presence = 0
        const hidden = { ...frame, result: { landmarks: copyPosePoints(copyPosePoints([points])) } }
        syntheticChecksPassed &&=
          observeCapturedNeckSide({ frame: hidden, ...options, now: frame.at }).status ===
          'unavailable'
        syntheticChecksPassed &&=
          observeCapturedNeckSide({ frame: synthetic, ...options, now: frame.at + 251 }).status ===
          'unavailable'
        return snapshot()
      },
    }
  } catch {
    await close()
    throw new Error('Private captured neck probe unavailable')
  }
}
