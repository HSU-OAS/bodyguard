// FR-M-01/02/07·FR-A-03/NFR-07/08: synthetic decoder/VideoFrame/detector, never real pixels.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { createVideoPoseSource } from './videoPoseSource'

class FakeFrame {
  static made: FakeFrame[] = []
  close = vi.fn()
  displayWidth = 640
  displayHeight = 480
  constructor(_video: HTMLVideoElement, _options: VideoFrameInit) {
    FakeFrame.made.push(this)
  }
}
beforeEach(() => {
  FakeFrame.made = []
  vi.stubGlobal('VideoFrame', FakeFrame)
})
afterEach(() => vi.unstubAllGlobals())
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
function setup() {
  const abort = new AbortController()
  const track = Object.assign(new EventTarget(), {
    readyState: 'live',
    kind: 'video',
    enabled: true,
    muted: false,
    stop: vi.fn(),
  })
  const stream = { getVideoTracks: () => [track], active: true } as unknown as MediaStream
  let callback: VideoFrameRequestCallback | undefined
  const video = Object.assign(new EventTarget(), {
    srcObject: stream,
    readyState: 2,
    videoWidth: 640,
    videoHeight: 480,
    requestVideoFrameCallback: vi.fn((cb: VideoFrameRequestCallback) => {
      callback = cb
      return 1
    }),
    cancelVideoFrameCallback: vi.fn(),
  }) as unknown as HTMLVideoElement
  const result = { landmarks: [], worldLandmarks: [], close: vi.fn() }
  const detect = vi.fn().mockReturnValue(result)
  const source = createVideoPoseSource(
    { generation: 1, signal: abort.signal },
    { video, stream, detect },
  )
  const emit = (now = 10, sequence = 1, mediaTime = 0.1) => {
    callback?.(now, {
      presentedFrames: sequence,
      mediaTime,
      width: 640,
      height: 480,
    } as VideoFrameCallbackMetadata)
  }
  return {
    source,
    video,
    stream,
    track,
    abort,
    detect,
    result,
    emit,
    get callback() {
      return callback
    },
  }
}
describe('owned decoded video pose source', () => {
  it.each([0, NaN, Infinity, 1.5])(
    'reclaims malformed VideoFrame dimension %s without inference',
    async (dimension) => {
      vi.stubGlobal(
        'VideoFrame',
        class extends FakeFrame {
          displayWidth = dimension
        },
      )
      const f = setup(),
        read = f.source.read()
      f.emit()
      await expect(read).rejects.toThrow('Video capture unavailable')
      expect(f.detect).not.toHaveBeenCalled()
      expect(FakeFrame.made[0].close).toHaveBeenCalledOnce()
      expect(await f.source.read()).toBeNull()
      await f.source.dispose()
    },
  )
  it('uses owned VideoFrame dimensions, not callback metadata/current video/CSS dimensions or avatar mirroring', async () => {
    const f = setup(),
      gate = deferred<typeof f.result>()
    f.detect.mockReturnValue(gate.promise)
    Object.defineProperties(f.video, {
      videoWidth: { value: 1920, configurable: true },
      videoHeight: { value: 1080, configurable: true },
    })
    Object.assign(f.video, { style: { width: '200px', height: '200px', scale: '-1 1' } })
    const read = f.source.read()
    f.emit()
    await Promise.resolve()
    FakeFrame.made[0].displayWidth = 320
    FakeFrame.made[0].displayHeight = 320
    gate.resolve(f.result)
    const frame = await read
    expect(frame?.image).toEqual({ width: 640, height: 480, imageIsMirrored: false })
    expect(Object.isFrozen(frame?.image)).toBe(true)
    expect(FakeFrame.made[0].close).toHaveBeenCalledOnce()
    await f.source.dispose()
  })
  it('starts nothing until read, preserves decoded stamps and closes both owned values', async () => {
    const f = setup()
    expect(f.video.requestVideoFrameCallback).not.toHaveBeenCalled()
    expect(FakeFrame.made).toHaveLength(0)
    const read = f.source.read()
    f.emit()
    const frame = await read
    expect(frame).toMatchObject({ generation: 1, sequence: 1, at: 10 })
    expect(f.detect).toHaveBeenCalledTimes(1)
    expect(f.detect.mock.calls[0][0]).toBe(FakeFrame.made[0])
    expect(f.detect.mock.calls[0][1]).toBe(10)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
    expect(f.result.close).toHaveBeenCalledTimes(1)
  })
  it('does not infer duplicate decoded sequence, time or mediaTime', async () => {
    const f = setup()
    const first = f.source.read()
    f.emit()
    await first
    for (const [now, seq, time] of [
      [20, 1, 0.2],
      [10, 2, 0.2],
      [20, 2, 0.1],
      [NaN, 2, 0.2],
      [20, NaN, 0.2],
    ]) {
      const read = f.source.read()
      f.emit(now, seq, time)
      expect(await read).toBeNull()
    }
    expect(f.detect).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made).toHaveLength(1)
  })
  it('has one pending callback/inference, not an unbounded queue', async () => {
    const f = setup(),
      gate = deferred<typeof f.result>()
    f.detect.mockReturnValue(gate.promise)
    const read = f.source.read()
    expect(await f.source.read()).toBeNull()
    f.emit()
    await Promise.resolve()
    expect(await f.source.read()).toBeNull()
    expect(f.video.requestVideoFrameCallback).toHaveBeenCalledTimes(1)
    gate.resolve(f.result)
    expect(await read).not.toBeNull()
  })
  it('cancels pending decoded callback and ignores a manually delivered late callback', async () => {
    const f = setup(),
      read = f.source.read()
    const old = f.callback
    await f.source.dispose()
    expect(await read).toBeNull()
    old?.(10, { presentedFrames: 1, mediaTime: 0.1 } as VideoFrameCallbackMetadata)
    expect(f.video.cancelVideoFrameCallback).toHaveBeenCalledWith(1)
    expect(FakeFrame.made).toHaveLength(0)
    expect(f.detect).not.toHaveBeenCalled()
  })
  it('abort after decoded capture reclaims frame without invoking inference', async () => {
    const f = setup(),
      read = f.source.read()
    f.emit()
    f.abort.abort()
    expect(await read).toBeNull()
    await f.source.dispose()
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
    expect(f.detect).not.toHaveBeenCalled()
  })
  it('waits for an in-flight result after abort before closing its input', async () => {
    const f = setup(),
      gate = deferred<typeof f.result>()
    f.detect.mockReturnValue(gate.promise)
    const read = f.source.read()
    f.emit()
    await Promise.resolve()
    f.abort.abort()
    expect(FakeFrame.made[0].close).not.toHaveBeenCalled()
    gate.resolve(f.result)
    expect(await read).toBeNull()
    await f.source.dispose()
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
    expect(f.result.close).toHaveBeenCalledTimes(1)
  })
  it('stream replacement before decode performs no inference and does not detach another owner', async () => {
    const f = setup(),
      read = f.source.read()
    const other = {} as MediaStream
    f.video.srcObject = other
    f.emit()
    await expect(read).rejects.toThrow('Video capture unavailable')
    expect(f.detect).not.toHaveBeenCalled()
    expect(f.video.srcObject).toBe(other)
    expect(f.track.stop).not.toHaveBeenCalled()
  })
  it('track ending while awaiting decode settles failure, not a hanging successful source', async () => {
    const f = setup(),
      read = f.source.read()
    f.track.readyState = 'ended'
    f.track.dispatchEvent(new Event('ended'))
    await expect(read).rejects.toThrow('Video capture unavailable')
    expect(f.detect).not.toHaveBeenCalled()
    expect(f.video.cancelVideoFrameCallback).toHaveBeenCalledWith(1)
  })
  it('reclaims input on detector failure and sanitizes native errors', async () => {
    const f = setup()
    f.detect.mockImplementation(() => {
      throw new Error('PRIVATE_VIDEO_POSE_INPUT')
    })
    const read = f.source.read()
    f.emit()
    await expect(read).rejects.toThrow('Video capture unavailable')
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
    expect(await f.source.read()).toBeNull()
  })
  it('continues input cleanup after result close failure, then quarantines', async () => {
    const f = setup()
    f.result.close.mockImplementation(() => {
      throw new Error('PRIVATE_VIDEO_POSE_INPUT')
    })
    const read = f.source.read()
    f.emit()
    await expect(read).rejects.toBeInstanceOf(ResourceCleanupError)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
    await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
  })
  it('does not hide input cleanup failure after a provider has thrown', async () => {
    const f = setup()
    f.detect.mockImplementation(() => {
      throw new Error('PRIVATE_VIDEO_POSE_INPUT')
    })
    const read = f.source.read()
    f.emit()
    FakeFrame.made[0].close.mockImplementation(() => {
      throw new Error('PRIVATE_VIDEO_POSE_INPUT')
    })
    await expect(read).rejects.toBeInstanceOf(ResourceCleanupError)
    await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
  })
  it('rejects a synchronous decoder callback and cancels its subsequently returned handle', async () => {
    const f = setup()
    vi.mocked(f.video.requestVideoFrameCallback).mockImplementationOnce((cb) => {
      cb(10, { presentedFrames: 1, mediaTime: 0.1 } as VideoFrameCallbackMetadata)
      return 1
    })
    await expect(f.source.read()).rejects.toThrow('Video capture unavailable')
    expect(f.video.cancelVideoFrameCallback).toHaveBeenCalledWith(1)
    expect(FakeFrame.made).toHaveLength(0)
    expect(f.detect).not.toHaveBeenCalled()
  })
  it('quarantines cancel failure but settles the waiting reader and ignores late decoder work', async () => {
    const f = setup(),
      reading = f.source.read(),
      late = f.callback
    vi.mocked(f.video.cancelVideoFrameCallback).mockImplementation(() => {
      throw new Error('PRIVATE_VIDEO_POSE_INPUT')
    })
    await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
    expect(await reading).toBeNull()
    late?.(10, { presentedFrames: 1, mediaTime: 0.1 } as VideoFrameCallbackMetadata)
    expect(FakeFrame.made).toHaveLength(0)
  })
  it('continues callback retirement after listener removal fails', async () => {
    const f = setup(),
      reading = f.source.read()
    vi.spyOn(f.video, 'removeEventListener').mockImplementationOnce(() => {
      throw new Error('PRIVATE_VIDEO_POSE_INPUT')
    })
    await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
    expect(await reading).toBeNull()
    expect(f.video.cancelVideoFrameCallback).toHaveBeenCalledWith(1)
    expect(f.track.stop).not.toHaveBeenCalled()
  })
  it('a track ending during inference discards and reclaims both late values', async () => {
    const f = setup(),
      gate = deferred<typeof f.result>()
    f.detect.mockReturnValue(gate.promise)
    const read = f.source.read()
    f.emit()
    await Promise.resolve()
    f.track.readyState = 'ended'
    f.track.dispatchEvent(new Event('ended'))
    gate.resolve(f.result)
    await expect(read).rejects.toThrow('Video capture unavailable')
    expect(f.result.close).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
  })
  it('validates capabilities/configuration without making any native frame', async () => {
    const f = setup()
    const source = createVideoPoseSource(
      { generation: 2, signal: f.abort.signal },
      { video: f.video, stream: f.stream, detect: f.detect },
    )
    f.abort.abort()
    expect(await source.read()).toBeNull()
    await source.dispose()
    expect(FakeFrame.made).toHaveLength(0)
    expect(f.video.requestVideoFrameCallback).not.toHaveBeenCalled()
    expect(() =>
      createVideoPoseSource(
        { generation: 0, signal: f.abort.signal },
        { video: f.video, stream: f.stream, detect: f.detect },
      ),
    ).toThrow('Invalid pose frame source')
  })
})
