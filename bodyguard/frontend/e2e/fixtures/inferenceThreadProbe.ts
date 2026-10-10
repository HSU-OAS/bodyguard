// FR-M-02/07·NFR-02/07/08: actual SDK/thread comparison, synthetic blank input, no raw outputs.
import { createFaceLandmarker } from '../../src/pose/face'
import { createGestureRecognizer } from '../../src/pose/hands'
import { createPoseLandmarker } from '../../src/pose/landmarker'
import { createWorkerPoseInference } from '../../src/pose/workerInference'

export function mountInferenceThreadProbe(thread: 'main' | 'worker') {
  if (thread !== 'main' && thread !== 'worker')
    throw new Error('Private thread comparison unavailable')
  const abort = new AbortController()
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Private thread comparison unavailable')
  context.fillStyle = '#888'
  context.fillRect(0, 0, 640, 480)
  const button = document.createElement('button')
  button.textContent = '응답 확인'
  document.body.append(button)
  let state: 'idle' | 'preparing' | 'ready' | 'running' | 'closed' | 'failed' = 'idle'
  let body: Awaited<ReturnType<typeof createPoseLandmarker>> | undefined
  let face: Awaited<ReturnType<typeof createFaceLandmarker>> | undefined
  let hands: Awaited<ReturnType<typeof createGestureRecognizer>> | undefined
  let worker: Awaited<ReturnType<typeof createWorkerPoseInference>> | undefined
  let preparation: Promise<void> | undefined, work: Promise<void> | undefined
  let closing: Promise<ReturnType<typeof snapshot>> | undefined
  let raf = 0,
    lastRaf = 0,
    maxGapMs = 0,
    beats = 0,
    frames = 0,
    closes = 0
  let clickTimer: ReturnType<typeof setTimeout> | undefined
  let clickScheduledAt = 0,
    clickDelayMs: number | null = null,
    readyMs: number | null = null
  const timings: number[] = []
  const delegates: string[] = []
  let concurrentRejected = false
  const beat = (at: number) => {
    if (state !== 'running') return
    if (lastRaf) maxGapMs = Math.max(maxGapMs, at - lastRaf)
    lastRaf = at
    beats++
    raf = requestAnimationFrame(beat)
  }
  button.addEventListener('click', () => {
    if (state === 'running' && clickDelayMs === null)
      clickDelayMs = performance.now() - clickScheduledAt
  })
  async function prepare() {
    state = 'preparing'
    const began = performance.now()
    try {
      if (thread === 'worker') {
        worker = await createWorkerPoseInference(
          { generation: 1, signal: abort.signal },
          {
            model: 'lite',
            face: true,
            hands: true,
            matrixLayout: 'column-major',
          },
        )
      } else {
        body = await createPoseLandmarker('lite')
        face = await createFaceLandmarker()
        hands = await createGestureRecognizer()
        delegates.push(body.delegate, face.delegate, hands.delegate)
      }
      abort.signal.throwIfAborted()
      readyMs = performance.now() - began
      state = 'ready'
    } catch {
      state = 'failed'
      throw new Error('Private thread comparison unavailable')
    }
  }
  async function read(index: number) {
    const frame = new VideoFrame(canvas, { timestamp: index * 100_000 })
    frames++
    const at = index * 100
    const began = performance.now()
    try {
      if (thread === 'worker') {
        const pending = worker?.detect(frame, at)
        if (index === 1) {
          try {
            await worker?.detect(frame, at)
          } catch {
            concurrentRejected = true
          }
        }
        const result = await pending
        if (!result) throw new Error()
        result.close()
      } else {
        const result = body?.landmarker.detectForVideo(frame, at)
        if (!result) throw new Error()
        try {
          face?.landmarker.detectForVideo(frame, at)
          hands?.recognizer.recognizeForVideo(frame, at)
        } finally {
          result.close()
        }
      }
      abort.signal.throwIfAborted()
      timings.push(performance.now() - began)
    } finally {
      frame.close()
      closes++
    }
  }
  async function run() {
    if (state !== 'ready') throw new Error('Private thread comparison unavailable')
    state = 'running'
    raf = requestAnimationFrame(beat)
    try {
      await new Promise<void>((yes) =>
        requestAnimationFrame(() => requestAnimationFrame(() => yes())),
      )
      clickScheduledAt = performance.now() + 25
      clickTimer = setTimeout(() => button.click(), 25)
      for (let i = 1; i <= 3; i++) {
        await read(i)
        await new Promise<void>((yes) => requestAnimationFrame(() => yes()))
      }
      await new Promise<void>((yes) => setTimeout(yes, 50))
      if (clickDelayMs === null) throw new Error()
      state = 'ready'
    } catch {
      state = 'failed'
      throw new Error('Private thread comparison unavailable')
    } finally {
      cancelAnimationFrame(raf)
      if (clickTimer !== undefined) clearTimeout(clickTimer)
    }
  }
  function snapshot() {
    return {
      thread,
      state,
      readyMs,
      firstMs: timings[0] ?? null,
      timings: [...timings],
      maxGapMs,
      beats,
      clickDelayMs,
      frames,
      closes,
      delegates: [...delegates],
      concurrentRejected,
    }
  }
  return Object.freeze({
    begin() {
      if (preparation) throw new Error('Private thread comparison unavailable')
      preparation = prepare()
      return preparation
    },
    run() {
      if (work) throw new Error('Private thread comparison unavailable')
      work = run()
      return work
    },
    snapshot,
    close() {
      closing ??= (async () => {
        abort.abort()
        await preparation?.catch(() => {})
        await work?.catch(() => {})
        let failed = false
        for (const dispose of [
          () => worker?.dispose(),
          () => hands?.recognizer.close(),
          () => face?.landmarker.close(),
          () => body?.landmarker.close(),
        ]) {
          try {
            await dispose()
          } catch {
            failed = true
          }
        }
        cancelAnimationFrame(raf)
        if (clickTimer !== undefined) clearTimeout(clickTimer)
        button.remove()
        state = failed ? 'failed' : 'closed'
        if (failed) throw new Error('Private thread comparison unavailable')
        return snapshot()
      })()
      return closing
    },
  })
}
