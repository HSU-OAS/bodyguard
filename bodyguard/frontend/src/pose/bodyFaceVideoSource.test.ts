// FR-M-01/02/07·FR-A-03/NFR-07/08: synthetic providers/decoder only; no real person.
import { Matrix4, Quaternion, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { createBodyFaceVideoSource } from './bodyFaceVideoSource'
import { createOwnedPoseFrame, type OwnedPoseResult } from './ownedPoseFrame'

class FakeFrame {
  static made: FakeFrame[] = []
  displayWidth = 640
  displayHeight = 480
  close = vi.fn()
  constructor(_video: HTMLVideoElement, _options: VideoFrameInit) {
    FakeFrame.made.push(this)
  }
}
beforeEach(() => {
  FakeFrame.made = []
  vi.stubGlobal('VideoFrame', FakeFrame)
})
afterEach(() => vi.unstubAllGlobals())
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const points = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
const face = () => ({
  faceLandmarks: [Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.4, z: 0 }))],
  facialTransformationMatrixes: [
    {
      rows: 4,
      columns: 4,
      data: Array.from(
        new Matrix4()
          .makeRotationFromQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3))
          .toArray(),
      ),
    },
  ],
})
function fixture() {
  const abort = new AbortController()
  const track = Object.assign(new EventTarget(), {
    kind: 'video',
    readyState: 'live',
    enabled: true,
    muted: false,
    stop: vi.fn(),
  })
  const stream = { active: true, getVideoTracks: () => [track] } as unknown as MediaStream
  let callback: VideoFrameRequestCallback | undefined
  const video = Object.assign(new EventTarget(), {
    srcObject: stream,
    readyState: 2,
    requestVideoFrameCallback: vi.fn((cb: VideoFrameRequestCallback) => {
      callback = cb
      return 1
    }),
    cancelVideoFrameCallback: vi.fn(),
  }) as unknown as HTMLVideoElement
  const body = { landmarks: [points()], worldLandmarks: [points()], close: vi.fn() }
  const facial = face()
  const detectBody = vi
    .fn<(_frame: VideoFrame, _at: number) => typeof body | Promise<typeof body>>()
    .mockReturnValue(body)
  const detectFace = vi
    .fn<(_frame: VideoFrame, _at: number) => typeof facial | Promise<typeof facial>>()
    .mockReturnValue(facial)
  const source = createBodyFaceVideoSource(
    { generation: 1, signal: abort.signal },
    { video, stream, detectBody, detectFace, matrixLayout: 'column-major' },
  )
  const emit = (now = 10, sequence = 1, mediaTime = 0.1) =>
    callback?.(now, { presentedFrames: sequence, mediaTime } as VideoFrameCallbackMetadata)
  return { source, abort, body, facial, detectBody, detectFace, emit, video, track }
}
describe('same frozen body and face frame', () => {
  it('starts nothing, then uses one input and timestamp and returns copied rotation only', async () => {
    const f = fixture()
    expect(f.detectBody).not.toHaveBeenCalled()
    expect(f.detectFace).not.toHaveBeenCalled()
    const reading = f.source.read()
    f.emit()
    const frame = await reading
    expect(frame).toMatchObject({ generation: 1, sequence: 1, at: 10 })
    expect(f.detectBody).toHaveBeenCalledWith(FakeFrame.made[0], 10)
    expect(f.detectFace).toHaveBeenCalledWith(FakeFrame.made[0], 10)
    expect(Object.keys(frame?.result ?? {}).sort()).toEqual([
      'headOrientation',
      'landmarks',
      'worldLandmarks',
    ])
    const expected = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3).toArray()
    expected.forEach((component, i) => {
      expect(frame?.result.headOrientation?.[i]).toBeCloseTo(component, 12)
    })
    expect(Object.isFrozen(frame?.result.headOrientation)).toBe(true)
    expect(f.body.close).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
  })
  it('snapshots body before face can mutate borrowed arrays and copies before body release', async () => {
    const f = fixture()
    f.detectFace.mockImplementation(() => {
      f.body.landmarks[0][0].x = 90
      return f.facial
    })
    f.body.close.mockImplementation(() => {
      f.body.worldLandmarks[0][0].y = 91
    })
    const reading = f.source.read()
    f.emit()
    const frame = await reading
    expect(frame?.result.landmarks[0][0].x).toBe(0.5)
    expect(frame?.result.worldLandmarks[0][0].y).toBe(0.5)
  })
  it('retains input and body through face pending and blocks a second inference', async () => {
    const f = fixture(),
      gate = deferred<typeof f.facial>()
    f.detectFace.mockReturnValue(gate.promise)
    const reading = f.source.read()
    f.emit()
    await vi.waitFor(() => expect(f.detectFace).toHaveBeenCalledTimes(1))
    expect(await f.source.read()).toBeNull()
    expect(f.body.close).not.toHaveBeenCalled()
    expect(FakeFrame.made[0].close).not.toHaveBeenCalled()
    gate.resolve(f.facial)
    expect(await reading).not.toBeNull()
  })
  it('rejects duplicated decoder stamps before either provider runs', async () => {
    const f = fixture()
    const first = f.source.read()
    f.emit()
    await first
    for (const [at, sequence, time] of [
      [20, 1, 0.2],
      [10, 2, 0.2],
      [20, 2, 0.1],
    ]) {
      const reading = f.source.read()
      f.emit(at, sequence, time)
      expect(await reading).toBeNull()
    }
    expect(f.detectBody).toHaveBeenCalledTimes(1)
    expect(f.detectFace).toHaveBeenCalledTimes(1)
  })
  it('does not retain a previous head on fresh missing, multiple or malformed face', async () => {
    const f = fixture()
    let sequence = 0
    for (const value of [
      f.facial,
      { faceLandmarks: [], facialTransformationMatrixes: [] },
      { ...f.facial, faceLandmarks: [...f.facial.faceLandmarks, ...f.facial.faceLandmarks] },
      {
        ...f.facial,
        facialTransformationMatrixes: [{ rows: 4, columns: 4, data: Array(16).fill(NaN) }],
      },
    ]) {
      f.detectFace.mockReturnValue(value)
      const reading = f.source.read()
      f.emit(++sequence * 10, sequence, sequence / 10)
      const result = await reading
      expect(result?.result.headOrientation === null).toBe(sequence !== 1)
    }
  })
  it('skips face for unusable body/world and resumes without reusing a previous head', async () => {
    const f = fixture()
    let sequence = 0
    for (const [images, worlds] of [
      [[], []],
      [
        [points(), points()],
        [points(), points()],
      ],
      [[points()], []],
      [[points()], [points(), points()]],
      [[points().slice(0, 20)], [points()]],
      [[points()], [points().slice(0, 20)]],
      [[[{ ...points()[0], x: NaN }, ...points().slice(1)]], [points()]],
      [[points()], [[{ ...points()[0], y: Infinity }, ...points().slice(1)]]],
    ]) {
      f.detectBody.mockReturnValue({ ...f.body, landmarks: images, worldLandmarks: worlds })
      const reading = f.source.read()
      f.emit(++sequence * 10, sequence, sequence / 10)
      expect((await reading)?.result.headOrientation).toBeNull()
      expect(f.detectFace).not.toHaveBeenCalled()
      expect(f.body.close).toHaveBeenCalledTimes(sequence)
      expect(FakeFrame.made[sequence - 1].close).toHaveBeenCalledOnce()
    }
    f.detectBody.mockReturnValue(f.body)
    const reading = f.source.read()
    f.emit(++sequence * 10, sequence, sequence / 10)
    expect((await reading)?.result.headOrientation).not.toBeNull()
    expect(f.detectFace).toHaveBeenCalledExactlyOnceWith(
      FakeFrame.made[sequence - 1],
      sequence * 10,
    )
    await f.source.dispose()
  })
  it('skips an irrelevant face exception, preserving the next valid-body failure', async () => {
    const f = fixture()
    f.detectFace.mockImplementation(() => {
      throw new Error('PRIVATE_FACE')
    })
    f.detectBody.mockReturnValue({ ...f.body, landmarks: [], worldLandmarks: [] })
    const empty = f.source.read()
    f.emit()
    expect((await empty)?.result.headOrientation).toBeNull()
    expect(f.detectFace).not.toHaveBeenCalled()
    f.detectBody.mockReturnValue(f.body)
    const valid = f.source.read()
    f.emit(20, 2, 0.2)
    await expect(valid).rejects.toThrow('Video capture unavailable')
    expect(f.body.close).toHaveBeenCalledTimes(2)
    await f.source.dispose()
  })
  it('clears a previous head for an empty body and resumes on the same source', async () => {
    const f = fixture()
    const first = f.source.read()
    f.emit()
    expect((await first)?.result.headOrientation).not.toBeNull()
    f.detectBody.mockReturnValue({ ...f.body, landmarks: [], worldLandmarks: [] })
    const empty = f.source.read()
    f.emit(20, 2, 0.2)
    expect((await empty)?.result.headOrientation).toBeNull()
    expect(f.detectFace).toHaveBeenCalledOnce()
    f.detectBody.mockReturnValue(f.body)
    const resumed = f.source.read()
    f.emit(30, 3, 0.3)
    expect((await resumed)?.result.headOrientation).not.toBeNull()
    expect(f.detectFace).toHaveBeenCalledTimes(2)
    expect(f.body.close).toHaveBeenCalledTimes(3)
    await f.source.dispose()
  })
  it('preserves cleanup failure when face inference is skipped', async () => {
    const f = fixture()
    f.detectBody.mockReturnValue({ ...f.body, landmarks: [], worldLandmarks: [] })
    f.body.close.mockImplementation(() => {
      throw new Error('PRIVATE_CLOSE')
    })
    const reading = f.source.read()
    f.emit()
    await expect(reading).rejects.toBeInstanceOf(ResourceCleanupError)
    await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
    expect(f.detectFace).not.toHaveBeenCalled()
    expect(f.body.close).toHaveBeenCalledOnce()
    expect(FakeFrame.made[0].close).toHaveBeenCalledOnce()
  })
  it('does not call face after abort while body is pending and still reclaims body and input', async () => {
    const f = fixture(),
      gate = deferred<typeof f.body>()
    f.detectBody.mockReturnValue(gate.promise)
    const reading = f.source.read()
    f.emit()
    await vi.waitFor(() => expect(f.detectBody).toHaveBeenCalledTimes(1))
    f.abort.abort()
    gate.resolve(f.body)
    expect(await reading).toBeNull()
    await f.source.dispose()
    expect(f.detectFace).not.toHaveBeenCalled()
    expect(f.body.close).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
  })
  it('disposal waits for face pending, discards late rotation and reclaims both owned values', async () => {
    const f = fixture(),
      gate = deferred<typeof f.facial>()
    f.detectFace.mockReturnValue(gate.promise)
    const reading = f.source.read()
    f.emit()
    await vi.waitFor(() => expect(f.detectFace).toHaveBeenCalledTimes(1))
    let disposed = false
    const closing = f.source.dispose().then(() => {
      disposed = true
    })
    await Promise.resolve()
    expect(disposed).toBe(false)
    gate.resolve(f.facial)
    expect(await reading).toBeNull()
    await closing
    await f.source.dispose()
    expect(f.body.close).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
  })
  it('sanitizes face rejection, reclaims body/input and never invents a face-result close', async () => {
    const f = fixture(),
      faceClose = vi.fn()
    Object.assign(f.facial, { close: faceClose })
    f.detectFace.mockImplementation(() => {
      throw new Error('PRIVATE_BODY_FACE_POINTS')
    })
    const reading = f.source.read()
    f.emit()
    await expect(reading).rejects.toThrow('Video capture unavailable')
    expect(f.body.close).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
    expect(faceClose).not.toHaveBeenCalled()
    expect(await f.source.read()).toBeNull()
  })
  it('preserves partial-provider cleanup failure and body cleanup failure during face failure', async () => {
    for (const mode of ['body', 'face', 'close']) {
      const f = fixture()
      if (mode === 'body')
        f.detectBody.mockImplementation(() => {
          throw new ResourceCleanupError()
        })
      else
        f.detectFace.mockImplementation(() => {
          throw mode === 'face' ? new ResourceCleanupError() : new Error('PRIVATE_BODY_FACE_POINTS')
        })
      if (mode === 'close')
        f.body.close.mockImplementation(() => {
          throw new Error('PRIVATE_BODY_FACE_POINTS')
        })
      const reading = f.source.read()
      f.emit()
      await expect(reading).rejects.toBeInstanceOf(ResourceCleanupError)
      await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
      expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
    }
  })
  it('does not close caller camera or detectors on disposal', async () => {
    const f = fixture()
    await f.source.dispose()
    expect(f.track.stop).not.toHaveBeenCalled()
    expect(f.video.srcObject).not.toBeNull()
    expect(f.detectBody).not.toHaveBeenCalled()
    expect(f.detectFace).not.toHaveBeenCalled()
  })
  it('does not invoke face after explicit disposal while body is pending', async () => {
    const f = fixture(),
      gate = deferred<typeof f.body>()
    f.detectBody.mockReturnValue(gate.promise)
    const reading = f.source.read()
    f.emit()
    await vi.waitFor(() => expect(f.detectBody).toHaveBeenCalledTimes(1))
    const closing = f.source.dispose()
    gate.resolve(f.body)
    expect(await reading).toBeNull()
    await closing
    expect(f.detectFace).not.toHaveBeenCalled()
    expect(f.body.close).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
  })
  it('does not require or invoke close on a successful plain JS face result', async () => {
    const f = fixture(),
      close = vi.fn()
    Object.assign(f.facial, { close })
    const reading = f.source.read()
    f.emit()
    expect(await reading).not.toBeNull()
    expect(close).not.toHaveBeenCalled()
  })
  it('rejects malformed body before face invocation and still reclaims native values', async () => {
    const f = fixture()
    Object.defineProperty(f.body, 'worldLandmarks', {
      get() {
        throw new Error('PRIVATE_BODY_FACE_POINTS')
      },
    })
    const reading = f.source.read()
    f.emit()
    await expect(reading).rejects.toThrow('Video capture unavailable')
    expect(f.detectFace).not.toHaveBeenCalled()
    expect(f.body.close).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
  })
  it('copies optional rotation before native close and rejects malformed values at the shared boundary', async () => {
    for (const headOrientation of [[0, 0, 0, 1], [0, 0, 0, 2], [0, NaN, 0, 1], new Array(4), []]) {
      const f = fixture()
      const result: OwnedPoseResult = { ...f.body, headOrientation }
      f.body.close.mockImplementation(() => {
        headOrientation[3] = 99
      })
      const source = createOwnedPoseFrame(
        { generation: 1, signal: f.abort.signal },
        {
          capture: () => ({ generation: 1, sequence: 1, at: 10, input: 'borrowed' }),
          detect: () => result,
        },
      )
      if (
        headOrientation.length === 4 &&
        headOrientation[3] === 1 &&
        headOrientation.every(Number.isFinite)
      ) {
        const observed = await source.read()
        expect(observed?.result.headOrientation).toEqual([0, 0, 0, 1])
        expect(observed?.result.headOrientation).not.toBe(headOrientation)
      } else await expect(source.read()).rejects.toThrow('Pose frame unavailable')
      expect(f.body.close).toHaveBeenCalledTimes(1)
    }
  })
  it('validates declared layout before decoder scheduling', () => {
    const f = fixture()
    expect(() =>
      createBodyFaceVideoSource(
        { generation: 1, signal: f.abort.signal },
        {
          video: f.video,
          stream: { active: true, getVideoTracks: () => [f.track] } as unknown as MediaStream,
          detectBody: f.detectBody,
          detectFace: f.detectFace,
          matrixLayout: 'guess' as 'column-major',
        },
      ),
    ).toThrow('Invalid body face source')
    expect(f.video.requestVideoFrameCallback).not.toHaveBeenCalled()
  })
})
