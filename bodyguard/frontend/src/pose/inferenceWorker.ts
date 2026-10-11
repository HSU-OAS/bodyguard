// FR-M-02/07·NFR-08: configured same-browser SDK owner, no unprotected fallback.
import workerURL from './nativeInference.worker?worker&url'
import { createPolicyWorker } from './policyWorker'

export function createInferenceWorker() {
  if (import.meta.env.DEV) {
    // Vite source imports need modules, but the SDK's WASM loader needs importScripts.
    // The dev-only middleware serves the same entry as an in-memory classic bundle.
    const worker = new Worker('/__bodyguard/inference-worker.js')
    return { worker, terminate: () => worker.terminate() }
  }
  // Production cannot depend on a static host adding CSP to Worker responses.
  return createPolicyWorker(workerURL)
}
