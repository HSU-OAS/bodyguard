// @vitest-environment happy-dom
// NFR-08·FR-A-02: real owned animation bytes, controlled HTTP; no camera/people.
import { webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { referenceContentAsset } from './referenceContentAssets'
import { readVerifiedReferenceAsset } from './verifiedReferenceAsset'

const asset = referenceContentAsset('male', 'neck-side')
const original = new Uint8Array(
  await readFile(resolve('../docs/review/blender-reference-content/animations/male-neck-side.glb')),
)
let fetcher: ReturnType<typeof vi.fn>
function response(bytes = original, overrides: Record<string, unknown> = {}) {
  return {
    status: 200,
    url: new URL(asset.url, location.origin).href,
    redirected: false,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
    ...overrides,
  }
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  fetcher = vi.fn().mockResolvedValue(response())
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('returns exact embedded GLB bytes with no credentials, cache or redirects', async () => {
  const result = await readVerifiedReferenceAsset(asset, new AbortController().signal)
  expect(new Uint8Array(result)).toEqual(original)
  expect(fetcher).toHaveBeenCalledWith(
    new URL(asset.url, location.origin).href,
    expect.objectContaining({
      mode: 'same-origin',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    }),
  )
})
it('rejects modified canonical tuples and pre-aborted owners before any fetch', async () => {
  for (const candidate of [
    { ...asset, url: 'https://other.invalid/model.glb' },
    { ...asset, url: '/__bodyguard/reference-content/../secret.glb' },
    { ...asset, bytes: asset.bytes + 1 },
    { ...asset, sha256: '0'.repeat(64) },
  ])
    await expect(
      readVerifiedReferenceAsset(candidate, new AbortController().signal),
    ).rejects.toThrow('Blender reference unavailable')
  const abort = new AbortController()
  abort.abort()
  await expect(readVerifiedReferenceAsset(asset, abort.signal)).rejects.toThrow()
  expect(fetcher).not.toHaveBeenCalled()
})
it('contains status, URL, redirect, missing-body and exact size/hash failures', async () => {
  const tampered = original.slice()
  tampered[tampered.length - 1] ^= 1
  for (const candidate of [
    response(original, { status: 503 }),
    response(original, { redirected: true }),
    response(original, { url: 'https://other.invalid/' }),
    response(original, { body: null }),
    response(original.subarray(1)),
    response(new Uint8Array(asset.bytes + 1)),
    response(tampered),
  ]) {
    fetcher.mockResolvedValueOnce(candidate)
    await expect(readVerifiedReferenceAsset(asset, new AbortController().signal)).rejects.toThrow(
      'Blender reference unavailable',
    )
  }
})
it('aborts a pending native fetch on owner cancellation and at the unchanged30s deadline', async () => {
  vi.useFakeTimers()
  fetcher.mockImplementation(
    (_url, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('PRIVATE_SOURCE')), {
          once: true,
        })
      }),
  )
  const abort = new AbortController()
  const canceled = expect(readVerifiedReferenceAsset(asset, abort.signal)).rejects.toThrow(
    'Blender reference unavailable',
  )
  abort.abort()
  await canceled
  const expired = expect(
    readVerifiedReferenceAsset(asset, new AbortController().signal),
  ).rejects.toThrow('Blender reference unavailable')
  await vi.advanceTimersByTimeAsync(30_000)
  await expired
  expect(vi.getTimerCount()).toBe(0)
})
