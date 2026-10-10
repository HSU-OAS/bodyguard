// FR-M-02/NFR-07/08: classic worker permits the SDK's own importScripts WASM loader.
import { createWorkerInferenceRuntime } from './workerInferenceRuntime'
import { prepareWorkerNativeEngine } from './workerNativeEngine'

const scope = self as unknown as {
  postMessage(data: unknown): void
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
}
const runtime = createWorkerInferenceRuntime({
  prepare: prepareWorkerNativeEngine,
  send: (message) => scope.postMessage(message),
})
scope.addEventListener('message', (event) => runtime.receive(event.data))
