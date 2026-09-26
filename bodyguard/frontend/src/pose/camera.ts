import { CAMERA_CONSTRAINTS } from './constants'

export type CameraErrorKind = 'denied' | 'busy' | 'not-found' | 'unknown'

// FR-M-01 측정 시작 버튼을 눌렀을 때만 카메라를 켠다
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
  video.srcObject = stream
  await video.play()
  return stream
}

export function closeCamera(video: HTMLVideoElement | null, stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop()
  if (video) video.srcObject = null
}

// prd §4 — 권한 거부, 다른 앱이 사용 중, 카메라 없음을 구분해 안내한다
export function cameraErrorKind(e: unknown): CameraErrorKind {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found'
  return 'unknown'
}
