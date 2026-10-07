// FR-M-01/02/07·FR-A-03: hidden native fake-camera input; only fixed lifecycle counters escape.
import { closeCamera, openCamera } from '../../src/pose/camera'
import { mountPoseFrameProbe } from './ownedPoseFrameProbe'

export async function mountVideoPoseProbe(canvas: HTMLCanvasElement, gender: 'male' | 'female') {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.hidden = true
  document.body.append(video)
  const abort = new AbortController()
  let stream: MediaStream | undefined,
    actor: Awaited<ReturnType<typeof mountPoseFrameProbe>> | undefined
  let closed = false
  const NativeFrame = globalThis.VideoFrame
  const frames: VideoFrame[] = []
  let frameCloseCalls = 0,
    frameCloseErrors = 0
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
      frameCloseCalls++
      try {
        super.close()
      } catch (error) {
        frameCloseErrors++
        throw error
      }
    }
  }
  function snapshot() {
    return {
      ...actor?.snapshot(),
      cameraLive: stream?.getVideoTracks().every((track) => track.readyState === 'live') ?? false,
      tracksEnded: stream?.getTracks().every((track) => track.readyState === 'ended') ?? false,
      detached: video.srcObject === null,
      frames: frames.length,
      frameCloseCalls,
      frameCloseErrors,
      allFramesClosed: frames.every((frame) => {
        try {
          const clone = frame.clone()
          clone.close()
          return false
        } catch (error) {
          return error instanceof DOMException && error.name === 'InvalidStateError'
        }
      }),
      rawVideoHidden: video.hidden,
      actualHuman: false,
      fakeCamera: true,
    }
  }
  async function close() {
    if (!closed) {
      closed = true
      try {
        await actor?.close()
      } finally {
        try {
          if (stream) closeCamera(video, stream)
        } finally {
          abort.abort()
          video.remove()
          globalThis.VideoFrame = NativeFrame
        }
      }
    }
    return snapshot()
  }
  try {
    stream = await openCamera(video, abort.signal)
    actor = await mountPoseFrameProbe(canvas, gender)
    globalThis.VideoFrame = TrackedFrame
    await actor.attachVideo(video, stream)
    return Object.freeze({
      snapshot,
      close,
      startPlayback: (kind: 'synthetic' | 'video') => actor?.startPlayback(kind),
      holdNextResult: () => actor?.holdNextResult(),
      releaseHeldResult: () => actor?.releaseHeldResult(),
      stopPlayback: () => actor?.stopPlayback(),
      read: async () => ({ ...(await actor?.readVideo()), ...snapshot() }),
      startPending: () => {
        video.pause()
        return actor?.readVideo()
      },
      stopSource: async () => {
        await actor?.disposeVideo()
        return snapshot()
      },
      resume: async () => {
        if (!actor || !stream || closed) throw new Error('Private video pose diagnostic failed')
        await video.play()
        await actor.attachVideo(video, stream)
        return snapshot()
      },
    })
  } catch {
    await close()
    throw new Error('Private video pose diagnostic failed')
  }
}
