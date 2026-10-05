// FR-M-01/02/07/NFR-08: browser-test-only, fake camera and real cached tasks; no frame/coordinate export.
import { FaceLandmarker, GestureRecognizer, PoseLandmarker } from '@mediapipe/tasks-vision'
import { createBrowserPorts } from '../../src/coaching/browserPorts'
import type { ResourceNotice } from '../../src/coaching/resources'

export async function probeNativePorts() {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.style.display = 'none'
  document.body.append(video)
  const notices: ResourceNotice[] = []
  const ports = createBrowserPorts(video, {
    poseModel: 'lite',
    onFailure: (notice) => {
      notices.push(notice)
    },
  })
  let nativeCloses = 0
  let nativeCloseErrors = 0
  const restore: (() => void)[] = []
  for (const prototype of [
    PoseLandmarker.prototype,
    GestureRecognizer.prototype,
    FaceLandmarker.prototype,
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'close')
    const close = prototype.close
    Object.defineProperty(prototype, 'close', {
      configurable: true,
      value: function (this: typeof prototype) {
        nativeCloses++
        try {
          return close.call(this)
        } catch (error) {
          nativeCloseErrors++
          throw error
        }
      },
    })
    restore.push(() => {
      if (descriptor) Object.defineProperty(prototype, 'close', descriptor)
      else Reflect.deleteProperty(prototype, 'close')
    })
  }
  let camera: Awaited<ReturnType<typeof ports.camera>> | null = null
  let inference: Awaited<ReturnType<typeof ports.inference>> | null = null
  try {
    const before = { local: localStorage.length, session: sessionStorage.length }
    const abort = new AbortController()
    const context = { generation: 1, signal: abort.signal }
    camera = await ports.camera(context)
    const tracks = camera.stream.getTracks()
    const live = tracks.length > 0 && tracks.every((track) => track.readyState === 'live')
    inference = await ports.inference(context)
    const delegates = [inference.pose.delegate, inference.hand.delegate, inference.face.delegate]
    // Native results are consumed only here in browser memory, never returned or logged.
    inference.pose.landmarker.detectForVideo(video, 1).close()
    inference.hand.recognizer.recognizeForVideo(video, 1)
    inference.face.landmarker.detectForVideo(video, 1)
    await Promise.all([camera.dispose(), inference.dispose(), camera.dispose()])
    const ended = tracks.every((track) => track.readyState === 'ended')
    const detached = video.srcObject === null
    abort.abort()
    const after = { local: localStorage.length, session: sessionStorage.length }
    return Object.freeze({
      fake_camera_live: live,
      tracks_ended: ended,
      video_detached: detached,
      initialized_native_tasks: delegates.length,
      delegates,
      native_close_api_calls: nativeCloses,
      native_close_api_errors: nativeCloseErrors,
      notices: notices.length,
      storage_unchanged: JSON.stringify(before) === JSON.stringify(after),
      real_human_test: false,
      gpu_worker_memory_release_verified: false,
    })
  } finally {
    await Promise.allSettled([camera?.dispose(), inference?.dispose()])
    for (const undo of restore) undo()
    video.remove()
  }
}
