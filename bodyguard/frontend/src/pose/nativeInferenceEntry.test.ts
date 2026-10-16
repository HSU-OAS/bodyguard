// FR-M-07: worker boot follows listener installation and never implies SDK readiness.
import { afterEach, expect, it, vi } from 'vitest'

const ports = vi.hoisted(() => ({ create: vi.fn(), receive: vi.fn(), prepare: vi.fn() }))
vi.mock('./workerInferenceRuntime', () => ({ createWorkerInferenceRuntime: ports.create }))
vi.mock('./workerNativeEngine', () => ({ prepareWorkerNativeEngine: ports.prepare }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  vi.clearAllMocks()
})
it('announces boot only after the protocol handler exists, forwarding init unchanged', async () => {
  const events: string[] = []
  let listener!: (event: MessageEvent) => void
  ports.create.mockReturnValue({ receive: ports.receive })
  const postMessage = vi.fn(() => events.push('boot'))
  vi.stubGlobal('self', {
    postMessage,
    addEventListener: (type: string, handle: typeof listener) => {
      expect(type).toBe('message')
      listener = handle
      events.push('handler')
    },
  })
  await import('./nativeInference.worker')
  expect(events).toEqual(['handler', 'boot'])
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'boot' })
  expect(ports.prepare).not.toHaveBeenCalled()
  const init = { type: 'init', generation: 1 }
  listener(new MessageEvent('message', { data: init }))
  expect(ports.receive).toHaveBeenCalledExactlyOnceWith(init)
})
