// FR-M-01/02/07·FR-A-01/03: private decoded-frame delivery; no camera acquisition or classifier.
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import {
  type CapturedPoseInput,
  createOwnedPoseFrame,
  type OwnedPoseResult,
} from './ownedPoseFrame'

export function createVideoPoseSource(
  context: ResourceContext,
  ports: Readonly<{
    video: HTMLVideoElement
    stream: MediaStream
    detect(frame: VideoFrame, at: number): OwnedPoseResult | Promise<OwnedPoseResult>
  }>,
) {
  const { video, stream, detect } = ports
  const { generation, signal } = context
  if (
    typeof VideoFrame !== 'function' ||
    typeof video.requestVideoFrameCallback !== 'function' ||
    typeof video.cancelVideoFrameCallback !== 'function' ||
    typeof stream.getVideoTracks !== 'function' ||
    typeof detect !== 'function'
  )
    throw new Error('Invalid video pose source')
  const tracks = stream.getVideoTracks()
  if (tracks.length !== 1 || tracks[0].kind !== 'video')
    throw new Error('Invalid video pose source')
  let closed = signal.aborted,
    invalid = false,
    cleanupFailed = false
  let lastSequence = 0,
    lastAt = -Infinity,
    lastMedia = -Infinity
  let disposal: Promise<void> | undefined
  const inputs = new Set<VideoFrame>()
  type Reservation = {
    id: number | null
    live: boolean
    resolve(value: CapturedPoseInput<VideoFrame> | null): void
    reject(reason: unknown): void
  }
  let pending: Reservation | null = null
  function owns() {
    const current = stream.getVideoTracks()
    return (
      !closed &&
      !invalid &&
      !signal.aborted &&
      video.srcObject === stream &&
      stream.active &&
      current.length === 1 &&
      current[0] === tracks[0] &&
      tracks[0].readyState === 'live' &&
      tracks[0].enabled &&
      !tracks[0].muted
    )
  }
  function release(frame: VideoFrame) {
    if (!inputs.delete(frame)) return
    try {
      frame.close()
    } catch {
      cleanupFailed = true
    }
  }
  function cancel(reject = false) {
    const reservation = pending
    pending = null
    if (!reservation) return
    reservation.live = false
    try {
      if (reservation.id !== null) video.cancelVideoFrameCallback(reservation.id)
    } catch {
      cleanupFailed = true
    }
    if (reject) reservation.reject(new Error('Video capture unavailable'))
    else reservation.resolve(null)
  }
  function lost() {
    invalid = true
    cancel(true)
  }
  const events = ['emptied', 'error', 'abort'] as const
  const core = createOwnedPoseFrame(Object.freeze({ generation, signal }), {
    capture: () => {
      if (!owns()) throw new Error('Video capture unavailable')
      return new Promise<CapturedPoseInput<VideoFrame> | null>((resolve, reject) => {
        const reservation: Reservation = { id: null, live: true, resolve, reject }
        pending = reservation
        try {
          const id = video.requestVideoFrameCallback((now, metadata) => {
            if (!reservation.live || pending !== reservation) return
            reservation.live = false
            pending = null
            try {
              // Native callbacks must defer; a synchronous provider cannot create a
              // frame before cancellation ownership has been registered.
              if (reservation.id === null || !owns() || video.readyState < 2)
                throw new Error('Video capture unavailable')
              const sequence = metadata.presentedFrames,
                mediaTime = metadata.mediaTime
              if (
                !Number.isSafeInteger(sequence) ||
                sequence <= lastSequence ||
                !Number.isFinite(now) ||
                now < 0 ||
                now <= lastAt ||
                !Number.isFinite(mediaTime) ||
                mediaTime < 0 ||
                mediaTime <= lastMedia ||
                !Number.isSafeInteger(Math.round(mediaTime * 1e6))
              ) {
                resolve(null)
                return
              }
              const input = new VideoFrame(video, { timestamp: Math.round(mediaTime * 1e6) })
              inputs.add(input)
              if (input.displayWidth <= 0 || input.displayHeight <= 0) {
                release(input)
                if (cleanupFailed) throw new ResourceCleanupError()
                throw new Error('Video capture unavailable')
              }
              lastSequence = sequence
              lastAt = now
              lastMedia = mediaTime
              resolve({ generation, sequence, at: now, input })
            } catch (error) {
              reject(
                error instanceof ResourceCleanupError
                  ? error
                  : new Error('Video capture unavailable'),
              )
            }
          })
          if (!Number.isSafeInteger(id) || id < 0) throw new ResourceCleanupError()
          reservation.id = id
          if (!reservation.live || pending !== reservation) {
            try {
              video.cancelVideoFrameCallback(id)
            } catch {
              cleanupFailed = true
            }
          }
        } catch (error) {
          if (pending === reservation) pending = null
          reservation.live = false
          if (error instanceof ResourceCleanupError) cleanupFailed = true
          reject(
            cleanupFailed ? new ResourceCleanupError() : new Error('Video capture unavailable'),
          )
        }
      })
    },
    detect: async (frame, at) => {
      let result: OwnedPoseResult | undefined, resultClose: OwnedPoseResult['close'] | undefined
      let finished = false
      function finish() {
        if (finished) return
        finished = true
        if (result) {
          try {
            if (typeof resultClose !== 'function') throw new Error()
            resultClose.call(result)
          } catch {
            cleanupFailed = true
          }
        }
        release(frame)
        if (cleanupFailed) throw new ResourceCleanupError()
      }
      try {
        if (!owns()) throw new Error('Video capture unavailable')
        result = await detect(frame, at)
        resultClose = result.close
        if (!owns()) throw new Error('Video capture unavailable')
        const headOrientation = result.headOrientation
        return {
          landmarks: result.landmarks,
          worldLandmarks: result.worldLandmarks,
          ...(headOrientation === undefined ? {} : { headOrientation }),
          close: finish,
        }
      } catch (error) {
        finish()
        throw error instanceof ResourceCleanupError ? error : new Error('Video capture unavailable')
      }
    },
  })
  function dispose(): Promise<void> {
    if (disposal) return disposal
    closed = true
    let resolve!: () => void, reject!: (error: unknown) => void
    disposal = new Promise((yes, no) => {
      resolve = yes
      reject = no
    })
    const finish = async () => {
      const unbind = [
        () => signal.removeEventListener('abort', aborted),
        ...tracks.map((track) => () => track.removeEventListener('ended', lost)),
        ...events.map((event) => () => video.removeEventListener(event, lost)),
      ]
      for (const action of unbind) {
        try {
          action()
        } catch {
          cleanupFailed = true
        }
      }
      cancel()
      try {
        await core.dispose()
      } catch (error) {
        if (error instanceof ResourceCleanupError) cleanupFailed = true
      } finally {
        for (const input of inputs) release(input)
      }
      if (cleanupFailed) throw new ResourceCleanupError()
    }
    void finish().then(resolve, reject)
    return disposal
  }
  function aborted() {
    void dispose().catch(() => {})
  }
  if (!closed) {
    signal.addEventListener('abort', aborted, { once: true })
    for (const track of tracks) track.addEventListener('ended', lost)
    for (const event of events) video.addEventListener(event, lost)
  }
  async function read() {
    if (closed) return null
    try {
      const frame = await core.read()
      if (closed) return null
      if (!owns()) throw new Error('Video capture unavailable')
      return frame
    } catch (error) {
      try {
        await dispose()
      } catch {
        cleanupFailed = true
      }
      if (cleanupFailed || error instanceof ResourceCleanupError) throw new ResourceCleanupError()
      throw new Error('Video capture unavailable')
    }
  }
  return Object.freeze({ read, dispose })
}
