// FR-M-07/NFR-08: test-only comparison must not hide native cleanup errors.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ resolve: vi.fn(), create: vi.fn() }))
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: sdk.resolve },
  PoseLandmarker: { createFromOptions: sdk.create },
}))
type Scope = {
  onmessage?: (event: { data: unknown }) => Promise<void>
  postMessage: ReturnType<typeof vi.fn>
}
let scope: Scope
beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  scope = { postMessage: vi.fn() }
  vi.stubGlobal('self', scope)
  vi.stubGlobal('OffscreenCanvas', class {})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))))
  sdk.resolve.mockResolvedValue({})
})
afterEach(() => vi.unstubAllGlobals())
async function receive(data: unknown) {
  if (!scope.onmessage) throw new Error('Test worker not installed')
  await scope.onmessage({ data })
}
it('releases a partially created GPU task if CPU initialization fails', async () => {
  const gpu = { close: vi.fn() }
  sdk.create.mockResolvedValueOnce(gpu).mockRejectedValueOnce(new Error('private SDK detail'))
  await import('../../e2e/fixtures/poseDelegateProbe.worker')
  await receive({ type: 'init' })
  expect(gpu.close).toHaveBeenCalledOnce()
  expect(scope.postMessage).toHaveBeenCalledWith({ type: 'error', stage: 'init', clean: true })
  expect(scope.postMessage).not.toHaveBeenCalledWith({ type: 'ready' })
})
it('releases both results, bitmap and tasks when a frame cleanup fails', async () => {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const cpuResult = {
    landmarks: [points],
    worldLandmarks: [],
    close: vi.fn(() => {
      throw new Error('private')
    }),
  }
  const gpuResult = { landmarks: [points], worldLandmarks: [], close: vi.fn() }
  const gpu = { close: vi.fn(), detectForVideo: vi.fn(() => gpuResult) }
  const cpu = { close: vi.fn(), detectForVideo: vi.fn(() => cpuResult) }
  sdk.create.mockResolvedValueOnce(gpu).mockResolvedValueOnce(cpu)
  await import('../../e2e/fixtures/poseDelegateProbe.worker')
  await receive({ type: 'init' })
  scope.postMessage.mockClear()
  const bitmap = { close: vi.fn() }
  await receive({ type: 'frame', bitmap, index: 0, at: 1, width: 720, height: 1280 })
  for (const close of [cpuResult.close, gpuResult.close, bitmap.close, cpu.close, gpu.close])
    expect(close).toHaveBeenCalledOnce()
  expect(scope.postMessage).toHaveBeenCalledWith({ type: 'error', stage: 'frame', clean: false })
  expect(scope.postMessage).not.toHaveBeenCalledWith({ type: 'frame-done', index: 0 })
})
it('attempts both task releases and reports an unclean close if either throws', async () => {
  const gpu = { close: vi.fn() }
  const cpu = {
    close: vi.fn(() => {
      throw new Error('private')
    }),
  }
  sdk.create.mockResolvedValueOnce(gpu).mockResolvedValueOnce(cpu)
  await import('../../e2e/fixtures/poseDelegateProbe.worker')
  await receive({ type: 'init' })
  await receive({ type: 'close' })
  expect(cpu.close).toHaveBeenCalledOnce()
  expect(gpu.close).toHaveBeenCalledOnce()
  expect(scope.postMessage).toHaveBeenCalledWith({ type: 'closed', clean: false })
})
