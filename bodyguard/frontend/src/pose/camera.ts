import { CAMERA_CONSTRAINTS } from './constants'

export type CameraErrorKind = 'denied' | 'busy' | 'not-found' | 'unknown'
// FR-M-07: a fixed cleanup fault, never the native error/track metadata.
export class CameraCleanupError extends Error {
  constructor() {
    super('Camera cleanup failed')
  }
}

// FR-M-01 측정 시작 버튼을 눌렀을 때만 카메라를 켠다
export async function openCamera(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<MediaStream> {
  signal.throwIfAborted()
  const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
  let closed = false
  let cleanupFailed = false
  const close = () => {
    if (closed) return
    closed = true
    try {
      closeCamera(video, stream)
    } catch {
      // An abort event listener must not leak an uncaught native error.
      cleanupFailed = true
    }
  }
  try {
    // 권한 팝업 자체는 취소할 수 없다. 늦은 허용으로 받은 스트림은 붙이기 전에 끈다 (FR-M-07).
    signal.throwIfAborted()
    signal.addEventListener('abort', close, { once: true })
    video.srcObject = stream
    await video.play()
    if (cleanupFailed) throw new CameraCleanupError()
    signal.throwIfAborted()
    return stream
  } catch (error) {
    close()
    throw cleanupFailed ? new CameraCleanupError() : error
  } finally {
    signal.removeEventListener('abort', close)
  }
}

export function closeCamera(video: HTMLVideoElement | null, stream: MediaStream | null) {
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
  if (failed) throw new CameraCleanupError()
}

// prd §4 — 권한 거부, 다른 앱이 사용 중, 카메라 없음을 구분해 안내한다
export function cameraErrorKind(e: unknown): CameraErrorKind {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found'
  return 'unknown'
}
