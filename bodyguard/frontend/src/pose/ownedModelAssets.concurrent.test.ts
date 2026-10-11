// FR-M-02/07·NFR-07/08: bounded selected public files only; synthetic bytes/hash/network.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MODEL_ASSETS, prepareOwnedModelAssets } from './ownedModelAssets'

const config = { model: 'heavy', face: true, hands: true } as const
const paths = [MODEL_ASSETS.heavy.path, MODEL_ASSETS.face.path, MODEL_ASSETS.hands.path]
function response(path: string) {
  const asset = Object.values(MODEL_ASSETS).find((item) => item.path === path)
  if (!asset) throw new Error('Unknown synthetic public file')
  const value = new Response(new Uint8Array(asset.bytes) as BodyInit)
  Object.defineProperty(value, 'url', { value: new URL(path, location.origin).href })
  return value
}
function network() {
  const pending = new Map<string, (value: Response) => void>()
  const fetch = vi.fn(
    (url: string, _options: RequestInit) =>
      new Promise<Response>((resolve) => pending.set(new URL(url).pathname, resolve)),
  )
  vi.stubGlobal('fetch', fetch)
  return { pending, fetch }
}
beforeEach(() => {
  vi.stubGlobal('location', new URL('http://localhost:3000/dev/measure'))
  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn(async (_algorithm: string, bytes: Uint8Array) => {
        const asset = Object.values(MODEL_ASSETS).find((item) => item.bytes === bytes.length)
        if (!asset) throw new Error('Unknown synthetic size')
        return Uint8Array.from(asset.sha256.match(/../g) ?? [], (n) => Number.parseInt(n, 16))
          .buffer
      }),
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
it('R1 starts all three selected reads before any response and binds reverse completions', async () => {
  const f = network(),
    abort = new AbortController()
  const work = prepareOwnedModelAssets(config, abort.signal)
  try {
    expect([...f.pending.keys()]).toEqual(paths)
    for (const path of paths.toReversed()) f.pending.get(path)?.(response(path))
    const assets = await work
    expect(assets.body.byteLength).toBe(MODEL_ASSETS.heavy.bytes)
    expect(assets.face?.byteLength).toBe(MODEL_ASSETS.face.bytes)
    expect(assets.hands?.byteLength).toBe(MODEL_ASSETS.hands.bytes)
    expect(f.fetch).toHaveBeenCalledTimes(3)
  } finally {
    abort.abort()
    await work.catch(() => {})
  }
})
it('R1 snapshots the selected files even if the caller mutates its options while waiting', async () => {
  const f = network(),
    abort = new AbortController()
  const selected = { model: 'heavy' as const, face: true, hands: true }
  const work = prepareOwnedModelAssets(selected, abort.signal)
  try {
    expect([...f.pending.keys()]).toEqual(paths)
    selected.face = false
    selected.hands = false
    for (const path of paths) f.pending.get(path)?.(response(path))
    expect(Object.keys(await work)).toEqual(['body', 'face', 'hands'])
  } finally {
    abort.abort()
    await work.catch(() => {})
  }
})
it('R2 one bad response aborts all selected reads and disposes later response bodies', async () => {
  const f = network(),
    work = prepareOwnedModelAssets(config, new AbortController().signal)
  const assertion = expect(work).rejects.toThrow('Worker inference unavailable')
  f.pending.get(MODEL_ASSETS.heavy.path)?.(new Response('', { status: 404 }))
  await assertion
  // Failed first file must not leave already-started siblings holding authority.
  for (const [, options] of f.fetch.mock.calls) expect(options.signal?.aborted).toBe(true)
  const closes = paths.slice(1).map((path) => {
    const value = response(path),
      cancel = vi.spyOn(value.body as ReadableStream, 'cancel')
    f.pending.get(path)?.(value)
    return cancel
  })
  await vi.waitFor(() => {
    for (const cancel of closes) expect(cancel).toHaveBeenCalledOnce()
  })
})
it.each(['cancel', 'deadline'] as const)(
  'R2 %s rejects all selected reads and their later returns',
  async (kind) => {
    vi.useFakeTimers()
    const f = network(),
      abort = new AbortController()
    const work = prepareOwnedModelAssets(config, abort.signal)
    const assertion = expect(work).rejects.toThrow('Worker inference unavailable')
    expect(f.fetch).toHaveBeenCalledTimes(3)
    if (kind === 'cancel') abort.abort()
    else await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    const closes = paths.map((path) => {
      const value = response(path),
        cancel = vi.spyOn(value.body as ReadableStream, 'cancel')
      f.pending.get(path)?.(value)
      return cancel
    })
    await vi.waitFor(() => {
      for (const cancel of closes) expect(cancel).toHaveBeenCalledOnce()
    })
    for (const [, options] of f.fetch.mock.calls) expect(options.signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  },
)
