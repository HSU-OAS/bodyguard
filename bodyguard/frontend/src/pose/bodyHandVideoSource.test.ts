// FR-M-01/02/07·FR-A-03/NFR-07/08: generated inputs, not native accuracy or people.
import { Matrix4 } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { createBodyHandVideoSource, readNativeHands } from './bodyHandVideoSource'

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
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
const points = (length = 33) => Array.from({ length }, () => ({ x: 0.5, y: 0.4, z: 0 }))
const handResult = () => ({
  landmarks: [points(21), points(21)],
  worldLandmarks: [points(21), points(21)],
  handedness: [[{ categoryName: 'Left', score: 0.9 }], [{ categoryName: 'Right', score: 0.8 }]],
})
const faceResult = () => ({
  faceLandmarks: [points(478)],
  facialTransformationMatrixes: [{ rows: 4, columns: 4, data: new Matrix4().toArray() }],
})
function fixture(withFace = true) {
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
  const face = faceResult(),
    hands = handResult()
  const detectBody = vi.fn<() => typeof body | Promise<typeof body>>().mockReturnValue(body)
  const detectFace = vi.fn<() => typeof face | Promise<typeof face>>().mockReturnValue(face)
  const detectHands = vi.fn<() => typeof hands | Promise<typeof hands>>().mockReturnValue(hands)
  const source = createBodyHandVideoSource(
    { generation: 7, signal: abort.signal },
    {
      video,
      stream,
      detectBody,
      detectHands,
      ...(withFace ? { face: { detectFace, matrixLayout: 'column-major' as const } } : {}),
    },
  )
  const emit = (now = 10, sequence = 1, mediaTime = 0.1) =>
    callback?.(now, { presentedFrames: sequence, mediaTime } as VideoFrameCallbackMetadata)
  return {
    source,
    abort,
    track,
    video,
    body,
    face,
    hands,
    detectBody,
    detectFace,
    detectHands,
    emit,
  }
}
describe('bounded native hand candidates', () => {
  it('copies two labels and 21 points without retaining score, gesture or deprecated labels', () => {
    const input = { ...handResult(), gestures: ['PRIVATE'], handednesses: [] }
    const result = readNativeHands(input)
    input.landmarks[0][0].x = 99
    expect(result).toHaveLength(2)
    expect(result[0].side).toBe('left')
    expect(result[1].side).toBe('right')
    expect(Object.keys(result[0]).sort()).toEqual(['landmarks', 'side', 'worldLandmarks'])
    expect(result[0].landmarks[0].x).toBe(0.5)
    expect(Object.isFrozen(result[0].landmarks[0])).toBe(true)
  })
  it.each([
    { landmarks: [] },
    { worldLandmarks: [] },
    { handedness: [] },
    {
      handedness: [[{ categoryName: 'Left', score: 0.9 }], [{ categoryName: 'Left', score: 0.8 }]],
    },
    {
      handedness: [
        [{ categoryName: 'Unknown', score: 0.9 }],
        [{ categoryName: 'Right', score: 0.8 }],
      ],
    },
    {
      handedness: [[{ categoryName: 'Left', score: NaN }], [{ categoryName: 'Right', score: 0.8 }]],
    },
    {
      handedness: [[{ categoryName: 'Left', score: 1.1 }], [{ categoryName: 'Right', score: 0.8 }]],
    },
    {
      handedness: [
        [{ categoryName: 'Left', score: -0.1 }],
        [{ categoryName: 'Right', score: 0.8 }],
      ],
    },
    {
      handedness: [
        [
          { categoryName: 'Left', score: 0.9 },
          { categoryName: 'Right', score: 0.1 },
        ],
        [],
      ],
    },
  ])('does not guess ambiguous or mismatched candidates: %j', (change) => {
    expect(readNativeHands({ ...handResult(), ...change })).toEqual([])
  })
  it('rejects more than two hands and preserves one valid hand when the other has incomplete points', () => {
    const input = handResult()
    input.landmarks[0].pop()
    expect(readNativeHands(input).map((hand) => hand.side)).toEqual(['right'])
    expect(
      readNativeHands({
        landmarks: [points(21), points(21), points(21)],
        worldLandmarks: [points(21), points(21), points(21)],
        handedness: [[], [], []],
      }),
    ).toEqual([])
  })
  it('accepts numeric endpoint scores as candidate metadata, not a confidence threshold', () => {
    const input = handResult()
    input.handedness[0][0].score = 0
    input.handedness[1][0].score = 1
    expect(readNativeHands(input)).toHaveLength(2)
  })
})
describe('same frozen body face and hands input', () => {
  it('is inert then copies in order with original stamps before borrowed values are released', async () => {
    const f = fixture(),
      order: string[] = []
    f.detectBody.mockImplementation(() => {
      order.push('body')
      return f.body
    })
    f.detectFace.mockImplementation(() => {
      order.push('face')
      f.body.landmarks[0][0].x = 99
      return f.face
    })
    f.detectHands.mockImplementation(() => {
      order.push('hands')
      f.face.facialTransformationMatrixes[0].data.fill(99)
      return f.hands
    })
    f.body.close.mockImplementation(() => {
      f.hands.landmarks[0][0].x = 99
    })
    expect(order).toEqual([])
    const reading = f.source.read()
    f.emit()
    const observed = await reading
    expect(order).toEqual(['body', 'face', 'hands'])
    for (const detector of [f.detectBody, f.detectFace, f.detectHands])
      expect(detector).toHaveBeenCalledWith(FakeFrame.made[0], 10)
    expect(observed).toMatchObject({ generation: 7, sequence: 1, at: 10 })
    expect(observed?.result.landmarks[0][0].x).toBe(0.5)
    expect(observed?.result.headOrientation).toEqual([0, 0, 0, 1])
    expect(observed?.result.hands?.[0].landmarks[0].x).toBe(0.5)
    expect(f.body.close).toHaveBeenCalledTimes(1)
    expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
  })
  it('does not invent a head when face is disabled or invoke/close plain JS hand results', async () => {
    const f = fixture(false),
      close = vi.fn()
    Object.assign(f.hands, { close })
    const reading = f.source.read()
    f.emit()
    expect((await reading)?.result).not.toHaveProperty('headOrientation')
    expect(f.detectFace).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
  it('clears fresh missing hands and invalid body without reusing old candidates', async () => {
    const f = fixture()
    const first = f.source.read()
    f.emit()
    expect((await first)?.result.hands).toHaveLength(2)
    f.detectHands.mockReturnValue({ landmarks: [], worldLandmarks: [], handedness: [] })
    const second = f.source.read()
    f.emit(20, 2, 0.2)
    expect((await second)?.result.hands).toEqual([])
    f.detectHands.mockReturnValue(f.hands)
    for (const [landmarks, worldLandmarks] of [
      [[], []],
      [
        [points(), points()],
        [points(), points()],
      ],
      [[points()], []],
      [[points(32)], [points()]],
      [[[{ x: NaN, y: 0, z: 0 }, ...points(32)]], [points()]],
    ]) {
      f.detectBody.mockReturnValue({ ...f.body, landmarks, worldLandmarks })
      const sequence = f.detectHands.mock.calls.length + 1
      const reading = f.source.read()
      f.emit(sequence * 10, sequence, sequence / 10)
      expect((await reading)?.result).toMatchObject({ hands: [], headOrientation: null })
    }
  })
  it('rejects repeated decoder stamps before all detectors', async () => {
    const f = fixture()
    const first = f.source.read()
    f.emit()
    await first
    const reading = f.source.read()
    f.emit(20, 1, 0.2)
    expect(await reading).toBeNull()
    expect(f.detectHands).toHaveBeenCalledTimes(1)
  })
  it.each(['body', 'face', 'hands'] as const)(
    'disposal waits for %s and skips remaining native work',
    async (stage) => {
      const f = fixture(),
        body = deferred<typeof f.body>(),
        face = deferred<typeof f.face>(),
        hands = deferred<typeof f.hands>()
      if (stage === 'body') f.detectBody.mockReturnValue(body.promise)
      if (stage === 'face') f.detectFace.mockReturnValue(face.promise)
      if (stage === 'hands') f.detectHands.mockReturnValue(hands.promise)
      const reading = f.source.read()
      f.emit()
      await vi.waitFor(() =>
        expect(
          stage === 'body' ? f.detectBody : stage === 'face' ? f.detectFace : f.detectHands,
        ).toHaveBeenCalledTimes(1),
      )
      let finished = false
      const closing = f.source.dispose().then(() => {
        finished = true
      })
      await Promise.resolve()
      expect(finished).toBe(false)
      expect(FakeFrame.made[0].close).not.toHaveBeenCalled()
      if (stage === 'body') body.resolve(f.body)
      if (stage === 'face') face.resolve(f.face)
      if (stage === 'hands') hands.resolve(f.hands)
      expect(await reading).toBeNull()
      await closing
      expect(f.detectHands).toHaveBeenCalledTimes(stage === 'hands' ? 1 : 0)
      expect(f.body.close).toHaveBeenCalledTimes(1)
      expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
      expect(f.track.stop).not.toHaveBeenCalled()
    },
  )
  it('abort during hand work blocks another read and discards late candidates', async () => {
    const f = fixture(),
      gate = deferred<typeof f.hands>()
    f.detectHands.mockReturnValue(gate.promise)
    const reading = f.source.read()
    f.emit()
    await vi.waitFor(() => expect(f.detectHands).toHaveBeenCalledTimes(1))
    expect(await f.source.read()).toBeNull()
    f.abort.abort()
    gate.resolve(f.hands)
    expect(await reading).toBeNull()
    await f.source.dispose()
    expect(f.body.close).toHaveBeenCalledTimes(1)
  })
  it('sanitizes hand exceptions and preserves cleanup poison while closing input', async () => {
    for (const failedClose of [false, true]) {
      const f = fixture()
      f.detectHands.mockImplementation(() => {
        throw new Error('PRIVATE_HAND_POINTS')
      })
      if (failedClose)
        f.body.close.mockImplementation(() => {
          throw new Error('PRIVATE_CLOSE')
        })
      const reading = f.source.read()
      f.emit()
      if (failedClose) {
        await expect(reading).rejects.toBeInstanceOf(ResourceCleanupError)
        await expect(f.source.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
      } else await expect(reading).rejects.toThrow('Video capture unavailable')
      expect(f.body.close).toHaveBeenCalledTimes(1)
      expect(FakeFrame.made[0].close).toHaveBeenCalledTimes(1)
    }
  })
})
