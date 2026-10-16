// NFR-08·FR-A-02: middleware boundary with actual owned animation bytes, controlled faults.
import { lstat, readFile } from 'node:fs/promises'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { devReferenceContentPlugin } from '../../scripts/dev-reference-content'
import { referenceContentAsset } from './referenceContentAssets'

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return { ...actual, readFile: vi.fn(actual.readFile), lstat: vi.fn(actual.lstat) }
})
const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
beforeEach(() => {
  vi.mocked(readFile).mockImplementation(actual.readFile)
  vi.mocked(lstat).mockImplementation(actual.lstat)
})
afterEach(() => vi.clearAllMocks())
async function request(url: string, method = 'GET') {
  let serve!: (req: unknown, res: unknown, next: () => void) => void
  const configure = devReferenceContentPlugin().configureServer
  if (typeof configure !== 'function') throw new Error('Middleware missing')
  configure.call(
    {} as never,
    {
      middlewares: {
        use: (fn: typeof serve) => {
          serve = fn
        },
      },
    } as never,
  )
  const headers: Record<string, unknown> = {}
  let finish!: () => void
  const complete = new Promise<void>((yes) => {
    finish = yes
  })
  const res = {
    statusCode: 200,
    destroyed: false,
    body: undefined as unknown,
    setHeader: (key: string, value: unknown) => {
      headers[key] = value
    },
    end: (value?: unknown) => {
      res.body = value
      finish()
    },
  }
  let passed = false
  serve({ url, method }, res, () => {
    passed = true
    finish()
  })
  await complete
  return { res, headers, passed }
}
it('serves hash-matched actual animation, HEAD without bytes, and fixed immutable body Git object', async () => {
  const asset = referenceContentAsset('male', 'neck-side')
  const get = await request(asset.url)
  expect(get.res.statusCode).toBe(200)
  expect((get.res.body as Buffer).length).toBe(asset.bytes)
  expect(get.headers).toMatchObject({
    'Content-Type': 'model/gltf-binary',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  const head = await request(asset.url, 'HEAD')
  expect(head.res.body).toBeUndefined()
  expect(head.headers['Content-Length']).toBe(asset.bytes)
  const body = await request('/__bodyguard/review-avatar/female.glb', 'HEAD')
  expect(body.res.statusCode).toBe(200)
  expect(body.headers['Content-Length']).toBe(11549800)
})
it('passes unrelated requests and rejects unknown paths/methods before reading disk', async () => {
  expect((await request('/api/v1/me')).passed).toBe(true)
  for (const path of ['../source.blend', 'male/%2e%2e/secret.glb', 'other/neck-side.glb'])
    expect((await request(`/__bodyguard/reference-content/${path}`)).res.statusCode).toBe(404)
  for (const method of ['POST', 'PUT', 'DELETE'])
    expect(
      (await request(referenceContentAsset('male', 'neck-side').url, method)).res.statusCode,
    ).toBe(405)
  expect(lstat).not.toHaveBeenCalled()
  expect(readFile).not.toHaveBeenCalled()
})
it('contains missing/nonregular/size/hash failures as fixed empty503', async () => {
  const asset = referenceContentAsset('female', 'neck-side')
  for (const fail of [
    () => vi.mocked(lstat).mockRejectedValueOnce(new Error('PRIVATE_PATH')),
    () =>
      vi
        .mocked(lstat)
        .mockResolvedValueOnce({ size: asset.bytes, isFile: () => false } as Awaited<
          ReturnType<typeof lstat>
        >),
    () =>
      vi
        .mocked(lstat)
        .mockResolvedValueOnce({ size: asset.bytes + 1, isFile: () => true } as Awaited<
          ReturnType<typeof lstat>
        >),
    () => vi.mocked(readFile).mockResolvedValueOnce(Buffer.alloc(asset.bytes)),
  ]) {
    fail()
    const result = await request(asset.url)
    expect(result.res.statusCode).toBe(503)
    expect(result.res.body).toBeUndefined()
  }
})
