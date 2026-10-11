// FR-M-02/07·NFR-07/08: fixed public model v1 bytes, no personal data/cache/storage.
import type { PoseModel } from './constants'

export const MODEL_ASSETS = Object.freeze({
  lite: {
    path: '/models/pose_landmarker_lite.task',
    bytes: 5777746,
    sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
  },
  full: {
    path: '/models/pose_landmarker_full.task',
    bytes: 9398198,
    sha256: '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1',
  },
  heavy: {
    path: '/models/pose_landmarker_heavy.task',
    bytes: 30664242,
    sha256: '64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b',
  },
  face: {
    path: '/models/face_landmarker.task',
    bytes: 3758596,
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
  },
  hands: {
    path: '/models/gesture_recognizer.task',
    bytes: 8373440,
    sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482',
  },
})
export type ModelSelection = Readonly<{ model: PoseModel; face: boolean; hands: boolean }>
export type OwnedModelAssets = Readonly<{
  body: ArrayBuffer
  face?: ArrayBuffer
  hands?: ArrayBuffer
}>
const unavailable = () => new Error('Worker inference unavailable')
// Technical total model read/hash budget, NOT the 5s init/inference or a clinical/performance gate.
const MODEL_READ_LIMIT_MS = 30_000

export function validateOwnedModelAssets(config: ModelSelection, value: unknown): OwnedModelAssets {
  const assets = value as OwnedModelAssets
  if (
    !['lite', 'full', 'heavy'].includes(config.model) ||
    typeof config.face !== 'boolean' ||
    typeof config.hands !== 'boolean'
  )
    throw unavailable()
  if (!assets || typeof assets !== 'object') throw unavailable()
  const expected = {
    body: MODEL_ASSETS[config.model].bytes,
    ...(config.face ? { face: MODEL_ASSETS.face.bytes } : {}),
    ...(config.hands ? { hands: MODEL_ASSETS.hands.bytes } : {}),
  }
  if (Object.keys(assets).length !== Object.keys(expected).length) throw unavailable()
  const buffers = Object.entries(expected).map(([key, size]) => {
    const buffer = assets[key as keyof OwnedModelAssets]
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== size) throw unavailable()
    return buffer
  })
  if (new Set(buffers).size !== buffers.length) throw unavailable()
  return Object.freeze({
    body: assets.body,
    ...(config.face ? { face: assets.face } : {}),
    ...(config.hands ? { hands: assets.hands } : {}),
  })
}

export async function prepareOwnedModelAssets(
  config: ModelSelection,
  owner: AbortSignal,
): Promise<OwnedModelAssets> {
  if (
    owner.aborted ||
    !Object.hasOwn(MODEL_ASSETS, config.model) ||
    !['lite', 'full', 'heavy'].includes(config.model) ||
    typeof config.face !== 'boolean' ||
    typeof config.hands !== 'boolean'
  )
    throw unavailable()
  // Snapshot the bounded selection before any fetch/hash await observes caller changes.
  const selection = Object.freeze({ model: config.model, face: config.face, hands: config.hands })
  const abort = new AbortController(),
    deadline = performance.now() + MODEL_READ_LIMIT_MS
  const retire = () => abort.abort()
  owner.addEventListener('abort', retire, { once: true })
  const timer = setTimeout(retire, MODEL_READ_LIMIT_MS)
  const check = () => {
    if (owner.aborted || abort.signal.aborted || performance.now() >= deadline) throw unavailable()
  }
  let rejectAbort!: (error: Error) => void
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = reject
  })
  const reject = () => rejectAbort(unavailable())
  abort.signal.addEventListener('abort', reject, { once: true })
  async function read(asset: (typeof MODEL_ASSETS)[keyof typeof MODEL_ASSETS]) {
    check()
    const url = new URL(asset.path, location.origin).href
    const response = await fetch(url, {
      signal: abort.signal,
      mode: 'same-origin',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    })
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    const cancel = () => {
      if (reader) void reader.cancel().catch(() => {})
    }
    try {
      check()
      if (response.status !== 200 || response.redirected || response.url !== url || !response.body)
        throw unavailable()
      const length = response.headers.get('content-length')
      if (
        length !== null &&
        (!/^\d+$/.test(length) ||
          ((!response.headers.get('content-encoding') ||
            response.headers.get('content-encoding') === 'identity') &&
            Number(length) !== asset.bytes))
      )
        throw unavailable()
      reader = response.body.getReader()
      abort.signal.addEventListener('abort', cancel, { once: true })
      const bytes = new Uint8Array(asset.bytes)
      let offset = 0
      while (true) {
        check()
        const chunk = await reader.read()
        check()
        if (chunk.done) break
        if (!(chunk.value instanceof Uint8Array) || chunk.value.length > bytes.length - offset)
          throw unavailable()
        bytes.set(chunk.value, offset)
        offset += chunk.value.length
      }
      if (offset !== bytes.length) throw unavailable()
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
      check()
      if (Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('') !== asset.sha256)
        throw unavailable()
      return bytes.buffer
    } finally {
      abort.signal.removeEventListener('abort', cancel)
      if (reader) {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      } else {
        await response.body?.cancel().catch(() => {})
      }
    }
  }
  try {
    check()
    // At most three independent selected files, with the same total fixed result-buffer sizes.
    // Failure/cancellation retires every sibling through the shared abort owner below.
    const work = (async () => {
      const [body, face, hands] = await Promise.all([
        read(MODEL_ASSETS[selection.model]),
        selection.face ? read(MODEL_ASSETS.face) : undefined,
        selection.hands ? read(MODEL_ASSETS.hands) : undefined,
      ])
      check()
      return Object.freeze({ body, ...(face ? { face } : {}), ...(hands ? { hands } : {}) })
    })()
    return await Promise.race([work, cancelled])
  } catch {
    throw unavailable()
  } finally {
    clearTimeout(timer)
    owner.removeEventListener('abort', retire)
    abort.signal.removeEventListener('abort', reject)
    abort.abort()
  }
}
