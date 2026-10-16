// FR-M-02/07·NFR-08: generated blank input; lifecycle metadata only, no camera or body arrays.
import { ResourceCleanupError } from '../../src/coaching/resources'
import { createWorkerPoseInference } from '../../src/pose/workerInference'

const NativeWorker = Worker
type Event = {
  task: string
  phase: string
  delegate?: string | null
  error?: string | null
  at: number
  clean?: boolean
}
export async function runSdkLifecycle(cancelAt: 'none' | 'body' | 'face' | 'hands') {
  const events: Event[] = []
  const abort = new AbortController()
  const ports: MessagePort[] = []
  const note = (event: Omit<Event, 'at'>) => {
    if (events.length < 100)
      events.push({ ...event, at: performance.timeOrigin + performance.now() })
  }
  let requested = false,
    created = 0,
    terminated = 0
  window.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(
        url === '/__bodyguard/inference-worker.js' ? '/__private-sdk-lifecycle-worker.js' : url,
        options,
      )
      created++
      this.addEventListener('message', (event) => {
        const data = event.data
        if (['ready', 'result', 'closed', 'error'].includes(data?.type))
          note({ task: 'parent', phase: `receive-${data.type}`, clean: data.clean === true })
      })
    }
    postMessage(message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
      const data = message as { type?: string }
      if (['init', 'frame', 'close'].includes(data?.type ?? ''))
        note({ task: 'parent', phase: `send-${data.type}` })
      if (data?.type === 'init') {
        if (!Array.isArray(transfer)) throw new Error('Probe transfer unavailable')
        const channel = new MessageChannel()
        ports.push(channel.port1)
        channel.port1.onmessage = ({ data: event }) => {
          if (
            event &&
            ['body', 'face', 'hands', 'runtime'].includes(event.task) &&
            typeof event.phase === 'string' &&
            typeof event.at === 'number'
          ) {
            if (events.length < 100) events.push(event)
            if (!requested && event.task === cancelAt && event.phase === 'create-begin') {
              requested = true
              note({ task: 'parent', phase: 'abort-request' })
              abort.abort()
            }
          }
        }
        super.postMessage({ ...data, probePort: channel.port2 }, [...transfer, channel.port2])
      } else if (Array.isArray(transfer)) super.postMessage(message, transfer)
      else super.postMessage(message, transfer)
    }
    terminate() {
      terminated++
      super.terminate()
    }
  }
  let lease: Awaited<ReturnType<typeof createWorkerPoseInference>> | undefined
  let state = 'preparing',
    failure: string | null = null,
    counts: unknown
  try {
    lease = await createWorkerPoseInference(
      { generation: 1, signal: abort.signal },
      { model: 'heavy', face: true, hands: true, matrixLayout: 'column-major' },
    )
    if (cancelAt !== 'none' && !requested) throw new Error('Probe missed cancellation')
    const blank = new OffscreenCanvas(640, 480)
    const image = blank.getContext('2d')
    if (!image) throw new Error('Probe input unavailable')
    image.fillStyle = '#999'
    image.fillRect(0, 0, 640, 480)
    const frame = new VideoFrame(blank, { timestamp: 0 })
    try {
      const result = await lease.detect(frame, performance.now())
      counts = {
        bodies: result.landmarks.length,
        worlds: result.worldLandmarks.length,
        hands: result.hands?.length ?? 0,
        head: !!result.headOrientation,
      }
      result.close()
    } finally {
      frame.close()
    }
    state = 'ready-and-read'
  } catch (error) {
    failure = error instanceof ResourceCleanupError ? 'cleanup' : 'unavailable'
    state = requested ? 'cancelled' : 'failed'
  } finally {
    try {
      await lease?.dispose()
    } catch {
      failure = 'cleanup'
      state = 'failed'
    }
    // Port and Worker replies are independent queues; allow their already-posted messages to drain.
    await new Promise((resolve) => setTimeout(resolve, 50))
    for (const port of ports) port.close()
    window.Worker = NativeWorker
  }
  return {
    cancelAt,
    state,
    failure,
    counts,
    created,
    terminated,
    events,
    actualCamera: false,
    actualPeople: false,
  }
}
