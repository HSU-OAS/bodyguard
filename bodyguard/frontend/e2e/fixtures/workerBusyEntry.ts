// S6.17·FR-M-02/07·NFR-07/08: TEST ONLY, actual composite inference, two fixed markers.

import { createWorkerInferenceRuntime } from '../../src/pose/workerInferenceRuntime'
import { prepareWorkerNativeEngine } from '../../src/pose/workerNativeEngine'

const scope = self as unknown as {
  postMessage(value: unknown): void
  addEventListener(type: 'message', receive: (event: MessageEvent<unknown>) => void): void
}
const runtime = createWorkerInferenceRuntime({
  async prepare(config, signal) {
    const engine = await prepareWorkerNativeEngine(config, signal)
    let first = true
    return Object.freeze({
      async detect(frame: VideoFrame, at: number) {
        if (!first) return engine.detect(frame, at)
        first = false
        let completed = false
        const marker = (phase: 'start' | 'end') =>
          scope.postMessage({
            type: 'test-only-worker-busy',
            phase,
            at: performance.timeOrigin + performance.now(),
            completed,
          })
        marker('start')
        try {
          const result = await engine.detect(frame, at)
          completed = true
          return result
        } finally {
          marker('end')
        }
      },
      dispose: () => engine.dispose(),
    })
  },
  send: (message) => scope.postMessage(message),
})
scope.addEventListener('message', (event) => runtime.receive(event.data))
