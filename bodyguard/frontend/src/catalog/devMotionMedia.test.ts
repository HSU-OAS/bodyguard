// FR-S-06·NFR-08: middleware byte/method boundary; not decoded video/clinical validation.
import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { devMotionMediaPlugin } from '../../scripts/dev-motion-media'

vi.mock('node:fs/promises', () => ({ readFile: vi.fn(), lstat: vi.fn() }))
const bytes = Buffer.from('synthetic-local-bytes')
let assets: { file: string; bytes: number; sha256: string }[]
beforeEach(() => {
  assets = [
    {
      file: 'male-neck-side.mp4',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  ]
  vi.mocked(readFile).mockImplementation(async (path) =>
    String(path).endsWith('manifest.json') ? JSON.stringify({ assets }) : bytes,
  )
  vi.mocked(lstat).mockResolvedValue({ size: bytes.length, isFile: () => true } as Awaited<
    ReturnType<typeof lstat>
  >)
})
afterEach(() => vi.clearAllMocks())
async function request(url: string, method = 'GET') {
  let serve!: (req: unknown, res: unknown, next: () => void) => void
  const plugin = devMotionMediaPlugin()
  const configure = plugin.configureServer
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

it('serves only hash/byte-matched bounded media with no-store headers; HEAD never returns bytes', async () => {
  const get = await request('/__bodyguard/motion-media/male/neck-side.mp4')
  expect(get.res.statusCode).toBe(200)
  expect(get.res.body).toEqual(bytes)
  expect(get.headers['Content-Type']).toBe('video/mp4')
  expect(get.headers['Cache-Control']).toBe('no-store')
  const head = await request('/__bodyguard/motion-media/male/neck-side.mp4', 'HEAD')
  expect(head.res.body).toBeUndefined()
  expect(head.headers['Content-Length']).toBe(bytes.length)
})
it.each(['POST', 'PUT', 'DELETE'])('rejects %s before reading a file', async (method) => {
  expect(
    (await request('/__bodyguard/motion-media/male/neck-side.mp4', method)).res.statusCode,
  ).toBe(405)
  expect(readFile).not.toHaveBeenCalled()
})
it.each([
  '../source.blend',
  'male/neck-side.blend',
  'other/neck-side.mp4',
  'male/%2e%2e/neck-side.mp4',
])('rejects unlisted path %s without deriving a disk path', async (path) => {
  expect((await request(`/__bodyguard/motion-media/${path}`)).res.statusCode).toBe(404)
  expect(readFile).not.toHaveBeenCalled()
})
it('rejects corruption/missing/oversized asset metadata with an empty fixed503', async () => {
  for (const candidate of [
    [],
    [{ ...assets[0], sha256: '0'.repeat(64) }],
    [{ ...assets[0], bytes: 4_000_001 }],
  ]) {
    assets = candidate
    const result = await request('/__bodyguard/motion-media/male/neck-side.mp4')
    expect(result.res.statusCode).toBe(503)
    expect(result.res.body).toBeUndefined()
  }
})

it('contains missing/nonregular files and size mismatch before exposing any file body', async () => {
  vi.mocked(lstat).mockRejectedValueOnce(new Error('PRIVATE_SOURCE_PATH'))
  expect((await request('/__bodyguard/motion-media/male/neck-side.mp4')).res.statusCode).toBe(503)
  vi.mocked(lstat).mockResolvedValueOnce({ size: bytes.length, isFile: () => false } as Awaited<
    ReturnType<typeof lstat>
  >)
  expect((await request('/__bodyguard/motion-media/male/neck-side.mp4')).res.body).toBeUndefined()
  vi.mocked(lstat).mockResolvedValueOnce({ size: bytes.length + 1, isFile: () => true } as Awaited<
    ReturnType<typeof lstat>
  >)
  expect((await request('/__bodyguard/motion-media/male/neck-side.mp4')).res.statusCode).toBe(503)
})
