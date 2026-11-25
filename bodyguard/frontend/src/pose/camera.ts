import { ResourceCleanupError } from '../coaching/resources'
import { cameraConstraints, preferredCamera, setPreferredCamera } from './cameraSource'

export type CameraErrorKind = 'denied' | 'busy' | 'not-found' | 'unknown'

// FR-M-01 측정 시작 버튼을 눌렀을 때만 카메라를 켠다
export async function openCamera(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<MediaStream> {
  signal.throwIfAborted()
  const stream = await requestCamera(signal)
  let closed = false,
    cleanupFailed = false
  let rejectPlayback: ((reason: Error) => void) | undefined
  const close = () => {
    if (!closed) {
      closed = true
      try {
        closeCamera(video, stream)
      } catch {
        cleanupFailed = true
      }
    }
    if (cleanupFailed) throw new ResourceCleanupError()
  }
  // FR-M-07: permission is still owned until it settles; only acquired playback
  // is cancellable. Never throw a native cleanup error from an abort event.
  const aborted = () => {
    try {
      close()
    } catch {
      /* Explicit completion below observes the fixed cleanup failure. */
    }
    rejectPlayback?.(
      cleanupFailed
        ? new ResourceCleanupError()
        : new DOMException('Camera preparation aborted', 'AbortError'),
    )
  }
  try {
    // 권한 팝업 자체는 취소할 수 없다. 늦은 허용으로 받은 스트림은 붙이기 전에 끈다 (FR-M-07).
    signal.throwIfAborted()
    const cancelled = new Promise<never>((_, reject) => {
      rejectPlayback = reject
    })
    // A synchronous play/srcObject failure can precede Promise.race ownership.
    void cancelled.catch(() => {})
    signal.addEventListener('abort', aborted, { once: true })
    video.srcObject = stream
    signal.throwIfAborted()
    await Promise.race([video.play(), cancelled])
    signal.throwIfAborted()
    return stream
  } catch (error) {
    close()
    throw error
  } finally {
    signal.removeEventListener('abort', aborted)
    rejectPlayback = undefined
  }
}

// A chosen camera that was unplugged falls back to the browser default once.
async function requestCamera(signal: AbortSignal) {
  const chosen = preferredCamera()
  try {
    return await navigator.mediaDevices.getUserMedia(cameraConstraints(chosen))
  } catch (error) {
    const name = error instanceof DOMException ? error.name : ''
    if (chosen === null || (name !== 'OverconstrainedError' && name !== 'NotFoundError'))
      throw error
    if (preferredCamera() === chosen) setPreferredCamera(null)
    signal.throwIfAborted()
    return navigator.mediaDevices.getUserMedia(cameraConstraints(null))
  }
}

export function closeCamera(video: HTMLVideoElement | null, stream: MediaStream | null) {
  // FR-M-07/NFR-08: one failed stop must not prevent other stops or detach.
  let failed = false
  try {
    for (const track of stream?.getTracks() ?? []) {
      try {
        track.stop()
      } catch {
        failed = true
      }
    }
  } catch {
    failed = true
  }
  try {
    if (video && video.srcObject === stream) video.srcObject = null
  } catch {
    failed = true
  }
  if (failed) throw new ResourceCleanupError()
}

// prd §4 — 권한 거부, 다른 앱이 사용 중, 카메라 없음을 구분해 안내한다
export function cameraErrorKind(e: unknown): CameraErrorKind {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found'
  return 'unknown'
}
