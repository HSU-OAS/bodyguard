// Private synthetic SDK/network fixture; never a released motion or avatar.
import '../../src/index.css'

import { createPolicyWorker } from '../../src/pose/policyWorker'
import { mountInferenceThreadProbe } from './inferenceThreadProbe'

declare global {
  interface Window {
    sdkPolicyProbe: {
      mount: typeof mountInferenceThreadProbe
      network(
        target: string,
      ): Promise<{ mainBlocked: boolean; workerBlocked: boolean; workerViolations: number }>
    }
  }
}
window.sdkPolicyProbe = {
  mount: mountInferenceThreadProbe,
  async network(target) {
    let mainBlocked = false
    try {
      await fetch(target)
    } catch {
      mainBlocked = true
    }
    const owned = createPolicyWorker(`/network-worker.js?target=${encodeURIComponent(target)}`)
    try {
      const result = await new Promise<{ workerBlocked: boolean; workerViolations: number }>(
        (resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Network probe timed out')), 3000)
          owned.worker.addEventListener(
            'message',
            (event) => {
              clearTimeout(timer)
              resolve(event.data)
            },
            { once: true },
          )
          owned.worker.addEventListener(
            'error',
            () => {
              clearTimeout(timer)
              reject(new Error('Network probe worker failed'))
            },
            { once: true },
          )
        },
      )
      return { mainBlocked, ...result }
    } finally {
      owned.terminate()
    }
  },
}
