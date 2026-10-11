// FR-M-02/07·NFR-08: worker loading contract; actual SDK execution is a browser gate.
import { afterEach, expect, it, vi } from 'vitest'
import { createInferenceWorker } from './inferenceWorker'
import { createPolicyWorker } from './policyWorker'

vi.mock('./policyWorker', () => ({ createPolicyWorker: vi.fn() }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
it('loads the development classic bundle without a direct production fallback', () => {
  vi.stubEnv('DEV', true)
  const terminate = vi.fn()
  const construct = vi.fn()
  class TestWorker {
    terminate = terminate
    constructor(url: string | URL) {
      construct(url)
    }
  }
  vi.stubGlobal('Worker', TestWorker)
  const owned = createInferenceWorker()
  expect(construct.mock.calls[0]).toEqual(['/__bodyguard/inference-worker.js'])
  expect(createPolicyWorker).not.toHaveBeenCalled()
  owned.terminate()
  expect(terminate).toHaveBeenCalledTimes(1)
})
it('retains the inherited policy worker in production', () => {
  vi.stubEnv('DEV', false)
  const owned = { worker: {} as Worker, terminate: vi.fn() }
  vi.mocked(createPolicyWorker).mockReturnValue(owned)
  expect(createInferenceWorker()).toBe(owned)
  expect(createPolicyWorker).toHaveBeenCalledTimes(1)
})
