// FR-M-02/07·NFR-08: configured same-browser SDK owner, no unprotected fallback.
import workerURL from './nativeInference.worker?worker&url'
import { createPolicyWorker } from './policyWorker'

export function createInferenceWorker() {
  if (import.meta.env.DEV) {
    // Vite serves this worker with SDK_DEV_POLICY. Preserve the existing dev port.
    const worker = new Worker(new URL('./nativeInference.worker.ts', import.meta.url))
    return { worker, terminate: () => worker.terminate() }
  }
  // Production cannot depend on a static host adding CSP to Worker responses.
  return createPolicyWorker(workerURL)
}
