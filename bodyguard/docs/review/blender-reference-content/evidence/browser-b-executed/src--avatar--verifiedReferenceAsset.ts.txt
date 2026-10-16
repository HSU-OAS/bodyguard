// FR-A-01/03·NFR-08: bounded/hash-matched fixed own GLB, no external URIs or credentials.
import { referenceContentAsset } from './referenceContentAssets'
import { REVIEW_AVATAR_ASSETS } from './reviewAvatarAssets'

const allowed = (['male', 'female'] as const).flatMap((gender) => [
  REVIEW_AVATAR_ASSETS[gender],
  ...(['neck-side', 'shoulder-shrug', 'arm-overhead'] as const).map((motion) =>
    referenceContentAsset(gender, motion),
  ),
])
export async function readVerifiedReferenceAsset(
  asset: Readonly<{ url: string; bytes: number; sha256: string }>,
  owner: AbortSignal,
) {
  owner.throwIfAborted()
  if (
    !allowed.some(
      (entry) =>
        entry.url === asset.url && entry.bytes === asset.bytes && entry.sha256 === asset.sha256,
    )
  )
    throw new Error('Blender reference unavailable')
  const url = new URL(asset.url, location.origin)
  if (
    url.origin !== location.origin ||
    !asset.url.startsWith('/__bodyguard/') ||
    !Number.isSafeInteger(asset.bytes) ||
    asset.bytes <= 0 ||
    asset.bytes > 16_000_000 ||
    !/^[a-f0-9]{64}$/.test(asset.sha256)
  )
    throw new Error('Blender reference unavailable')
  const abort = new AbortController(),
    deadline = performance.now() + 30_000
  const retire = () => abort.abort()
  owner.addEventListener('abort', retire, { once: true })
  const timer = setTimeout(retire, 30_000)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const check = () => {
    if (owner.aborted || abort.signal.aborted || performance.now() >= deadline)
      throw new Error('Blender reference unavailable')
  }
  try {
    const response = await fetch(url.href, {
      signal: abort.signal,
      mode: 'same-origin',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    })
    check()
    if (
      response.status !== 200 ||
      response.url !== url.href ||
      response.redirected ||
      !response.body
    )
      throw new Error()
    reader = response.body.getReader()
    const bytes = new Uint8Array(asset.bytes)
    let offset = 0
    while (true) {
      check()
      const next = await reader.read()
      check()
      if (next.done) break
      if (!(next.value instanceof Uint8Array) || offset + next.value.length > asset.bytes)
        throw new Error()
      bytes.set(next.value, offset)
      offset += next.value.length
    }
    if (offset !== asset.bytes) throw new Error()
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) =>
      n.toString(16).padStart(2, '0'),
    ).join('')
    check()
    if (hash !== asset.sha256) throw new Error()
    const view = new DataView(bytes.buffer)
    if (
      view.byteLength < 20 ||
      view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== view.byteLength ||
      view.getUint32(16, true) !== 0x4e4f534a
    )
      throw new Error()
    const jsonLength = view.getUint32(12, true)
    if (jsonLength === 0 || jsonLength > bytes.length - 20) throw new Error()
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)))
    if (
      !Array.isArray(json.buffers) ||
      json.buffers.length !== 1 ||
      json.buffers[0].uri !== undefined ||
      json.images?.length
    )
      throw new Error()
    return bytes.buffer
  } catch {
    throw new Error('Blender reference unavailable')
  } finally {
    clearTimeout(timer)
    owner.removeEventListener('abort', retire)
    try {
      await reader?.cancel()
    } catch {
      /* Fetch cancellation is not a native asset lease. */
    }
    reader?.releaseLock()
  }
}
