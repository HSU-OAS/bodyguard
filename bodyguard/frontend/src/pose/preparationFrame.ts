// FR-M-02/07·NFR-08: one same-browser input; caller owns and closes it, never serializes it.
import { ResourceCleanupError } from '../coaching/resources'

// Technical decoded-input deadline, not a clinical hold timer or relaxed SDK response bound.
const INPUT_READY_LIMIT_MS = 5000

export async function capturePreparationFrame(video: HTMLVideoElement, signal: AbortSignal) {
  signal.throwIfAborted()
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await new Promise<void>((resolve, reject) => {
      let id: number | undefined
      let settled = false
      const deadline = performance.now() + INPUT_READY_LIMIT_MS
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal.removeEventListener('abort', aborted)
        try {
          if (id !== undefined) video.cancelVideoFrameCallback(id)
        } catch {
          error = new ResourceCleanupError()
        }
        if (error) reject(error)
        else resolve()
      }
      const aborted = () => finish(new DOMException('Aborted', 'AbortError'))
      const timer = setTimeout(
        () => finish(new Error('Camera input unavailable')),
        INPUT_READY_LIMIT_MS,
      )
      signal.addEventListener('abort', aborted, { once: true })
      try {
        id = video.requestVideoFrameCallback(() =>
          finish(performance.now() >= deadline ? new Error('Camera input unavailable') : undefined),
        )
      } catch {
        finish(new Error('Camera input unavailable'))
      }
      if (signal.aborted) aborted()
    })
  }
  signal.throwIfAborted()
  return new VideoFrame(video, { timestamp: Math.round(performance.now() * 1000) })
}
