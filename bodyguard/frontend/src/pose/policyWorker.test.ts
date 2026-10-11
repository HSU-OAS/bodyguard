// Network/URL ownership tests, not SDK or clinical validation.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPolicyWorker } from './policyWorker'

const terminate = vi.fn()
const construct = vi.fn()
beforeEach(() => {
  vi.stubGlobal('location', new URL('https://owned.invalid/coaching'))
  vi.stubGlobal(
    'Worker',
    class {
      terminate = terminate
      constructor(url: string) {
        construct(url)
      }
    },
  )
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://owned.invalid/owned')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
it('owns an inherited-policy blob importing only the fixed same-origin bundle', async () => {
  const owned = createPolicyWorker('/assets/nativeInference.worker-test.js')
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
  expect(await blob.text()).toBe(
    'importScripts("https://owned.invalid/assets/nativeInference.worker-test.js");',
  )
  expect(construct).toHaveBeenCalledWith('blob:https://owned.invalid/owned')
  owned.terminate()
  owned.terminate()
  expect(terminate).toHaveBeenCalledOnce()
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:https://owned.invalid/owned')
})
it.each([
  'https://external.invalid/x.js',
  '//external.invalid/x.js',
  'data:text/javascript,0',
  'blob:https://owned.invalid/x',
  'https://user:pass@owned.invalid/x.js',
])('rejects an unowned script without allocating: %s', (url) => {
  expect(() => createPolicyWorker(url)).toThrow('Worker inference unavailable')
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  expect(construct).not.toHaveBeenCalled()
})
it('reclaims the URL after constructor failure, with no direct worker fallback', () => {
  construct.mockImplementationOnce(() => {
    throw new Error('synthetic constructor failure')
  })
  expect(() => createPolicyWorker('/assets/fixed.js')).toThrow('Worker inference unavailable')
  expect(construct).toHaveBeenCalledOnce()
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
})
it('reclaims the URL even when native termination throws', () => {
  const owned = createPolicyWorker('/assets/fixed.js')
  terminate.mockImplementationOnce(() => {
    throw new Error('synthetic close failure')
  })
  expect(() => owned.terminate()).toThrow()
  owned.terminate()
  expect(terminate).toHaveBeenCalledOnce()
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
})
