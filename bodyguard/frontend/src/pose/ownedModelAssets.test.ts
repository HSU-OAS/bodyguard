// FR-M-02/07·NFR-07/08: public model bytes only; not human/clinical validation.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FACE_MODEL_PATH, GESTURE_MODEL_PATH, POSE_MODELS } from './constants'
import { MODEL_ASSETS, prepareOwnedModelAssets } from './ownedModelAssets'

const config = { model: 'lite', face: false, hands: false } as const
// Synthetic public bytes/hash port; actual originals are checked separately by CLI/browser.
const original = (path: string) => {
  const asset = Object.values(MODEL_ASSETS).find((a) => a.path === path)
  if (!asset) throw new Error('Unknown fixture')
  return new Uint8Array(asset.bytes)
}
const response = (
  bytes: Uint8Array,
  url = 'http://localhost:3000/models/pose_landmarker_lite.task',
) => {
  const res = new Response(bytes as BodyInit)
  Object.defineProperty(res, 'url', { value: url })
  return res
}
beforeEach(() => {
  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn(async (algorithm: string, bytes: Uint8Array) => {
        expect(algorithm).toBe('SHA-256')
        const asset = Object.values(MODEL_ASSETS).find((a) => a.bytes === bytes.length)
        const hex = bytes[100] === 0 && asset ? asset.sha256 : '0'.repeat(64)
        return Uint8Array.from(hex.match(/../g) ?? [], (n) => Number.parseInt(n, 16)).buffer
      }),
    },
  })
  vi.stubGlobal('location', new URL('http://localhost:3000/dev/measure'))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
it('keeps the same fixed model selection paths', () => {
  for (const model of ['lite', 'full', 'heavy'] as const)
    expect(MODEL_ASSETS[model].path).toBe(POSE_MODELS[model].path)
  expect(MODEL_ASSETS.face.path).toBe(FACE_MODEL_PATH)
  expect(MODEL_ASSETS.hands.path).toBe(GESTURE_MODEL_PATH)
})
it('checks decoded bytes/hash rather than an encoded Content-Length', async () => {
  const res = response(original(MODEL_ASSETS.lite.path))
  res.headers.set('content-encoding', 'gzip')
  res.headers.set('content-length', '123')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => res),
  )
  const assets = await prepareOwnedModelAssets(config, new AbortController().signal)
  expect(assets.body.byteLength).toBe(MODEL_ASSETS.lite.bytes)
})
it('does not accept an overdue fetch even before the timeout callback runs', async () => {
  vi.useFakeTimers()
  let now = 0,
    resolve!: (value: Response) => void
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r
        }),
    ),
  )
  const pending = prepareOwnedModelAssets(config, new AbortController().signal)
  const assertion = expect(pending).rejects.toThrow('Worker inference unavailable')
  now = 30_001
  resolve(response(original(MODEL_ASSETS.lite.path)))
  await assertion
  expect(vi.getTimerCount()).toBe(0)
})
it('reads only fixed requested public models with no credentials/redirect/cache persistence', async () => {
  const fetch = vi.fn(async (url: string, _options?: RequestInit) =>
    response(original(new URL(url).pathname), url),
  )
  vi.stubGlobal('fetch', fetch)
  const assets = await prepareOwnedModelAssets(
    { model: 'heavy', face: true, hands: true },
    new AbortController().signal,
  )
  expect(fetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    '/models/pose_landmarker_heavy.task',
    '/models/face_landmarker.task',
    '/models/gesture_recognizer.task',
  ])
  for (const call of fetch.mock.calls)
    expect(call[1]).toMatchObject({
      mode: 'same-origin',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    })
  expect(assets.body.byteLength).toBe(MODEL_ASSETS.heavy.bytes)
  expect(assets.face?.byteLength).toBe(MODEL_ASSETS.face.bytes)
  expect(assets.hands?.byteLength).toBe(MODEL_ASSETS.hands.bytes)
})
it('omits disabled optional models and never fetches for a pre-aborted owner', async () => {
  const fetch = vi.fn(async (url: string) => response(original(new URL(url).pathname), url))
  vi.stubGlobal('fetch', fetch)
  const abort = new AbortController()
  abort.abort()
  await expect(prepareOwnedModelAssets(config, abort.signal)).rejects.toThrow(
    'Worker inference unavailable',
  )
  expect(fetch).not.toHaveBeenCalled()
  const assets = await prepareOwnedModelAssets(config, new AbortController().signal)
  expect(Object.keys(assets)).toEqual(['body'])
  expect(fetch).toHaveBeenCalledOnce()
})
it.each(['status', 'redirect', 'external', 'short', 'large', 'tamper', 'empty', 'length'])(
  'rejects %s public model response, without exposing source errors',
  async (kind) => {
    let bytes = original(MODEL_ASSETS.lite.path)
    if (kind === 'short') bytes = bytes.slice(0, -1)
    if (kind === 'large') bytes = new Uint8Array(bytes.length + 1)
    if (kind === 'tamper') bytes[100] ^= 1
    if (kind === 'empty') bytes = new Uint8Array()
    const res = response(bytes, kind === 'external' ? 'https://other.invalid/private' : undefined)
    if (kind === 'status') Object.defineProperty(res, 'status', { value: 404 })
    if (kind === 'redirect') Object.defineProperty(res, 'redirected', { value: true })
    if (kind === 'length') res.headers.set('content-length', '999999999')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res),
    )
    await expect(prepareOwnedModelAssets(config, new AbortController().signal)).rejects.toThrow(
      'Worker inference unavailable',
    )
  },
)
it('bounds a hanging download independently of the five-second Worker command deadline', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn((_url: string, _options?: RequestInit) => new Promise<Response>(() => {}))
  vi.stubGlobal('fetch', fetch)
  const pending = prepareOwnedModelAssets(config, new AbortController().signal)
  const assertion = expect(pending).rejects.toThrow('Worker inference unavailable')
  await vi.advanceTimersByTimeAsync(30_000)
  await assertion
  expect((fetch.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})
it('cancels a pending reader and never promotes its later bytes', async () => {
  const cancel = vi.fn()
  const stream = new ReadableStream<Uint8Array>({ cancel })
  const res = response(new Uint8Array())
  Object.defineProperty(res, 'body', { value: stream })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => res),
  )
  const abort = new AbortController(),
    pending = prepareOwnedModelAssets(config, abort.signal)
  const assertion = expect(pending).rejects.toThrow('Worker inference unavailable')
  await vi.waitFor(() => expect(stream.locked).toBe(true))
  abort.abort()
  await assertion
  await vi.waitFor(() => expect(stream.locked).toBe(false))
  expect(cancel).toHaveBeenCalledOnce()
})
it('reclaims a fetch resolving after cancellation without starting another model', async () => {
  let resolve!: (value: Response) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>((r) => {
        resolve = r
      }),
  )
  vi.stubGlobal('fetch', fetch)
  const abort = new AbortController(),
    pending = prepareOwnedModelAssets({ ...config, face: true }, abort.signal)
  const assertion = expect(pending).rejects.toThrow('Worker inference unavailable')
  abort.abort()
  await assertion
  const res = response(original(MODEL_ASSETS.lite.path)),
    cancel = vi.spyOn(res.body as ReadableStream<Uint8Array>, 'cancel')
  resolve(res)
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce())
  expect(fetch).toHaveBeenCalledOnce()
})
