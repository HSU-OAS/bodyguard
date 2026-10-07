// FR-M-02/07·FR-A-01/03/NFR-07/08: synthetic ports; no camera or actual inference.
import { describe, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import {
  type CapturedPoseInput,
  createOwnedPoseFrame,
  type OwnedPoseResult,
} from './ownedPoseFrame'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const native = (count = 1): OwnedPoseResult => ({
  landmarks: Array.from({ length: count }, () => [{ x: 0.5, y: 0.4, z: 0, visibility: 0.9 }]),
  worldLandmarks: Array.from({ length: count }, () => [{ x: 0, y: 1, z: 0, visibility: 0.9 }]),
  close: vi.fn(),
})
function fixture() {
  const abort = new AbortController()
  const capture = vi
    .fn<() => CapturedPoseInput<string> | null | Promise<CapturedPoseInput<string> | null>>()
    .mockReturnValue({ generation: 1, sequence: 1, at: 10, input: 'borrowed' })
  const result = native()
  const detect = vi
    .fn<(_input: string, _at: number) => OwnedPoseResult | Promise<OwnedPoseResult>>()
    .mockReturnValue(result)
  const source = createOwnedPoseFrame({ generation: 1, signal: abort.signal }, { capture, detect })
  return { source, abort, capture, detect, result }
}

describe('owned pose frame', () => {
  it('preserves tagged partial-provider cleanup failure before a result is returned', async () => {
    const f = fixture()
    f.detect.mockImplementation(() => {
      throw new ResourceCleanupError()
    })
    await expect(f.source.read()).rejects.toBeInstanceOf(ResourceCleanupError)
    await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
  })
  it('does not acquire on creation; returns one copied stamped result and closes it', async () => {
    const f = fixture()
    expect(f.capture).not.toHaveBeenCalled()
    const frame = await f.source.read()
    expect(f.detect).toHaveBeenCalledWith('borrowed', 10)
    expect(frame).toEqual({
      generation: 1,
      sequence: 1,
      at: 10,
      result: {
        landmarks: f.result.landmarks,
        worldLandmarks: f.result.worldLandmarks,
      },
    })
    expect(frame?.result.landmarks).not.toBe(f.result.landmarks)
    expect(frame?.result.landmarks[0][0]).not.toBe(f.result.landmarks[0][0])
    expect(Object.isFrozen(frame)).toBe(true)
    expect(f.result.close).toHaveBeenCalledTimes(1)
  })
  it('copies before native close can erase result values', async () => {
    const f = fixture()
    vi.mocked(f.result.close).mockImplementation(() => {
      f.result.landmarks[0][0].x = 99
    })
    expect((await f.source.read())?.result.landmarks[0][0].x).toBe(0.5)
  })
  it('preserves no-person and multiple-person result instead of choosing one', async () => {
    for (const count of [0, 2]) {
      const f = fixture()
      f.detect.mockReturnValue(native(count))
      const frame = await f.source.read()
      expect(frame?.result.landmarks).toHaveLength(count)
      expect(frame?.result.worldLandmarks).toHaveLength(count)
    }
  })
  it('rejects foreign, repeated and non-increasing capture stamps before inference', async () => {
    const f = fixture()
    await f.source.read()
    for (const [generation, sequence, at] of [
      [2, 2, 20],
      [1, 1, 20],
      [1, 2, 10],
      [1, 2, 9],
      [1, NaN, 20],
      [1, 2, Infinity],
    ]) {
      f.capture.mockReturnValue({ generation, sequence, at, input: 'borrowed' })
      expect(await f.source.read()).toBeNull()
    }
    expect(f.detect).toHaveBeenCalledTimes(1)
    f.capture.mockReturnValue({ generation: 1, sequence: 2, at: 20, input: 'borrowed' })
    expect((await f.source.read())?.at).toBe(20)
  })
  it('snapshots stamps once, not after delayed inference', async () => {
    const f = fixture(),
      gate = deferred<OwnedPoseResult>()
    const captured = { generation: 1, sequence: 1, at: 10, input: 'borrowed' }
    f.capture.mockReturnValue(captured)
    f.detect.mockReturnValue(gate.promise)
    const reading = f.source.read()
    await Promise.resolve()
    captured.generation = 99
    captured.sequence = 99
    captured.at = 999
    gate.resolve(f.result)
    expect(await reading).toMatchObject({ generation: 1, sequence: 1, at: 10 })
  })
  it('has at most one capture/inference in flight', async () => {
    const f = fixture(),
      gate = deferred<OwnedPoseResult>()
    f.detect.mockReturnValue(gate.promise)
    const first = f.source.read()
    await Promise.resolve()
    expect(await f.source.read()).toBeNull()
    expect(f.capture).toHaveBeenCalledTimes(1)
    expect(f.detect).toHaveBeenCalledTimes(1)
    gate.resolve(f.result)
    expect(await first).not.toBeNull()
  })
  it('blocks synchronous reentrant capture before a promise has been returned', async () => {
    const f = fixture()
    let nested: Promise<unknown> | undefined
    f.capture.mockImplementationOnce(() => {
      nested = f.source.read()
      return { generation: 1, sequence: 1, at: 10, input: 'borrowed' }
    })
    expect(await f.source.read()).not.toBeNull()
    expect(await nested).toBeNull()
    expect(f.capture).toHaveBeenCalledTimes(1)
  })
  it('abort during capture performs no inference or delivery', async () => {
    const f = fixture(),
      gate = deferred<CapturedPoseInput<string> | null>()
    f.capture.mockReturnValue(gate.promise)
    const reading = f.source.read()
    f.abort.abort()
    gate.resolve({ generation: 1, sequence: 1, at: 10, input: 'borrowed' })
    expect(await reading).toBeNull()
    expect(f.detect).not.toHaveBeenCalled()
    expect(await f.source.read()).toBeNull()
  })
  it('dispose waits for late result reclamation, delivers nothing and is idempotent', async () => {
    const f = fixture(),
      gate = deferred<OwnedPoseResult>()
    f.detect.mockReturnValue(gate.promise)
    const reading = f.source.read()
    await Promise.resolve()
    let disposed = false
    const disposal = f.source.dispose().then(() => {
      disposed = true
    })
    await Promise.resolve()
    expect(disposed).toBe(false)
    gate.resolve(f.result)
    expect(await reading).toBeNull()
    await disposal
    await f.source.dispose()
    expect(f.result.close).toHaveBeenCalledTimes(1)
    expect(await f.source.read()).toBeNull()
  })
  it('sanitizes provider failure, closes source and does not auto-retry', async () => {
    const f = fixture()
    f.detect.mockImplementation(() => {
      throw new Error('PRIVATE_POSE_FRAME_COORDINATES')
    })
    await expect(f.source.read()).rejects.toThrow('Pose frame unavailable')
    expect(await f.source.read()).toBeNull()
    expect(f.detect).toHaveBeenCalledTimes(1)
  })
  it('late rejected provider does not leak an error into a closed consumer', async () => {
    const f = fixture(),
      gate = deferred<OwnedPoseResult>()
    f.detect.mockReturnValue(gate.promise)
    const reading = f.source.read()
    await Promise.resolve()
    const closing = f.source.dispose()
    gate.reject(new Error('PRIVATE_POSE_FRAME_COORDINATES'))
    expect(await reading).toBeNull()
    await closing
  })
  it('reclaims native result after malformed/accessor data and sanitizes errors', async () => {
    const f = fixture()
    Object.defineProperty(f.result, 'landmarks', {
      get() {
        throw new Error('PRIVATE_POSE_FRAME_COORDINATES')
      },
    })
    await expect(f.source.read()).rejects.toThrow('Pose frame unavailable')
    expect(f.result.close).toHaveBeenCalledTimes(1)
  })
  it('late result close failure reaches both read and disposal as fixed cleanup error', async () => {
    const f = fixture(),
      gate = deferred<OwnedPoseResult>()
    vi.mocked(f.result.close).mockImplementation(() => {
      throw new Error('PRIVATE_POSE_FRAME_COORDINATES')
    })
    f.detect.mockReturnValue(gate.promise)
    const reading = f.source.read()
    await Promise.resolve()
    const closing = f.source.dispose()
    const readCheck = expect(reading).rejects.toBeInstanceOf(ResourceCleanupError)
    const closeCheck = expect(closing).rejects.toBeInstanceOf(ResourceCleanupError)
    gate.resolve(f.result)
    await Promise.all([readCheck, closeCheck])
    expect(f.result.close).toHaveBeenCalledTimes(1)
  })
  it('does not acquire after pre-abort or invalid configuration', async () => {
    const f = fixture()
    f.abort.abort()
    const source = createOwnedPoseFrame({ generation: 1, signal: f.abort.signal }, f)
    expect(await source.read()).toBeNull()
    expect(f.capture).not.toHaveBeenCalled()
    expect(() => createOwnedPoseFrame({ generation: 0, signal: f.abort.signal }, f)).toThrow(
      'Invalid pose frame source',
    )
  })
  it('reentrant disposal waits for capture settlement without starting inference', async () => {
    const f = fixture()
    let disposal: Promise<void> | undefined,
      disposed = false
    f.capture.mockImplementationOnce(() => {
      disposal = f.source.dispose().then(() => {
        disposed = true
      })
      expect(disposed).toBe(false)
      return { generation: 1, sequence: 1, at: 10, input: 'borrowed' }
    })
    expect(await f.source.read()).toBeNull()
    await disposal
    expect(disposed).toBe(true)
    expect(f.detect).not.toHaveBeenCalled()
  })
  it('rejects unbounded/malformed arrays but still reclaims native result', async () => {
    for (const poses of [native(3), { ...native(), landmarks: null }]) {
      const f = fixture()
      f.detect.mockReturnValue(poses as OwnedPoseResult)
      await expect(f.source.read()).rejects.toThrow('Pose frame unavailable')
      expect(poses.close).toHaveBeenCalledTimes(1)
      expect(await f.source.read()).toBeNull()
    }
  })
  it('sanitizes capture failure and does not invoke inference', async () => {
    const f = fixture()
    f.capture.mockImplementationOnce(() => {
      throw new Error('PRIVATE_POSE_FRAME_COORDINATES')
    })
    await expect(f.source.read()).rejects.toThrow('Pose frame unavailable')
    expect(f.detect).not.toHaveBeenCalled()
    expect(await f.source.read()).toBeNull()
    await f.source.dispose()
  })
  it('does not convert missing native close into a reusable inference error', async () => {
    const f = fixture()
    f.detect.mockReturnValue({ ...native(), close: undefined } as unknown as OwnedPoseResult)
    await expect(f.source.read()).rejects.toBeInstanceOf(ResourceCleanupError)
    await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
    expect(await f.source.read()).toBeNull()
  })
})
