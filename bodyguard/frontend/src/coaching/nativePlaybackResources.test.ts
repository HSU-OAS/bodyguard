// @vitest-environment happy-dom
// FR-M-01/02/07·FR-S-02/04/NFR-08: native adapter ownership; native APIs mocked here.

import { AnimationClip, QuaternionKeyframeTrack } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import { prepareOwnedAvatarPair } from '../avatar/ownedAvatarPair'
import type { ReferenceProgram } from '../avatar/referencePlayback'
import type { FeedbackProgram } from '../avatar/surfaceFeedback'
import { createBodyFaceVideoSource } from '../pose/bodyFaceVideoSource'
import { createBodyHandVideoSource } from '../pose/bodyHandVideoSource'
import { closeCamera, openCamera } from '../pose/camera'
import { createFaceLandmarker } from '../pose/face'
import { createGestureRecognizer } from '../pose/hands'
import { createPoseLandmarker } from '../pose/landmarker'
import { createVideoPoseSource } from '../pose/videoPoseSource'
import { advanceCoaching, createCoaching } from '../stretch/progression'
import { createNativePlaybackResources } from './nativePlaybackResources'
import { createResourceController, ResourceCleanupError } from './resources'

vi.mock('../pose/camera', async (original) => ({
  ...(await original<typeof import('../pose/camera')>()),
  openCamera: vi.fn(),
  closeCamera: vi.fn(),
}))
vi.mock('../pose/landmarker', () => ({ createPoseLandmarker: vi.fn() }))
vi.mock('../pose/face', () => ({ createFaceLandmarker: vi.fn() }))
vi.mock('../pose/hands', () => ({ createGestureRecognizer: vi.fn() }))
vi.mock('../pose/bodyFaceVideoSource', () => ({ createBodyFaceVideoSource: vi.fn() }))
vi.mock('../pose/bodyHandVideoSource', () => ({ createBodyHandVideoSource: vi.fn() }))
vi.mock('../avatar/ownedAvatarPair', () => ({ prepareOwnedAvatarPair: vi.fn() }))
vi.mock('../pose/videoPoseSource', () => ({ createVideoPoseSource: vi.fn() }))
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
const drain = async () => {
  for (let i = 0; i < 50; i++) await Promise.resolve()
}
const headAlignment = (matrixLayout: 'column-major' | 'row-major' = 'column-major') => ({
  bone: 'head',
  matrixLayout,
  cameraReference: [0, 0, 0, 1],
  sceneFromCamera: [0, 0, 0, 1],
})
const handAlignment = () => ({
  cameraReferences: { left: [0, 0, 0, 1], right: [0, 0, 0, 1] },
  sceneFromCamera: [0, 0, 0, 1],
})
function setup(
  head?: ReturnType<typeof headAlignment>,
  hands?: ReturnType<typeof handAlignment>,
  reference?: ReferenceProgram,
  feedback?: Parameters<typeof createNativePlaybackResources>[0]['feedback'],
) {
  const stream = { getTracks: () => [] } as unknown as MediaStream
  const native = {
    close: vi.fn(),
    detectForVideo: vi.fn(() => ({ landmarks: [], worldLandmarks: [], close: vi.fn() })),
  }
  const loaded = { landmarker: native, model: 'lite', delegate: 'CPU' } as unknown as Awaited<
    ReturnType<typeof createPoseLandmarker>
  >
  const pair = {
    models: null,
    observe: vi.fn(),
    render: vi.fn(() => ({ status: 'untracked', tracked: 0, total: 8 })),
    dispose: vi.fn(),
    updateReference: vi.fn(() => true),
    updateFeedback: vi.fn(() => true),
  } as unknown as Awaited<ReturnType<typeof prepareOwnedAvatarPair>>
  const source = { read: vi.fn(async () => null), dispose: vi.fn(async () => {}) }
  const face = {
    close: vi.fn(),
    detectForVideo: vi.fn(() => ({ faceLandmarks: [], facialTransformationMatrixes: [] })),
  }
  const loadedFace = { landmarker: face, delegate: 'CPU' } as unknown as Awaited<
    ReturnType<typeof createFaceLandmarker>
  >
  const gesture = {
    close: vi.fn(),
    recognizeForVideo: vi.fn(() => ({ landmarks: [], worldLandmarks: [], handedness: [] })),
  }
  const loadedHands = { recognizer: gesture, delegate: 'CPU' } as unknown as Awaited<
    ReturnType<typeof createGestureRecognizer>
  >
  vi.mocked(openCamera).mockResolvedValue(stream)
  vi.mocked(createPoseLandmarker).mockResolvedValue(loaded)
  vi.mocked(createFaceLandmarker).mockResolvedValue(loadedFace)
  vi.mocked(createGestureRecognizer).mockResolvedValue(loadedHands)
  vi.mocked(prepareOwnedAvatarPair).mockResolvedValue(pair)
  vi.mocked(createVideoPoseSource).mockReturnValue(source)
  vi.mocked(createBodyFaceVideoSource).mockReturnValue(source)
  vi.mocked(createBodyHandVideoSource).mockReturnValue(source)
  const callbacks = new Map<number, (at: number) => void>()
  let id = 0
  const options = {
    model: 'lite' as const,
    mirror: true,
    halfLifeMs: 50,
    maxAgeMs: 250,
    loadAvatar: vi.fn(),
    render: vi.fn(),
    onFailure: vi.fn(),
    ...(head ? { head } : {}),
    ...(hands ? { hands } : {}),
    ...(reference ? { reference } : {}),
    ...(feedback ? { feedback } : {}),
    scheduler: {
      request: vi.fn((cb: (at: number) => void) => {
        callbacks.set(++id, cb)
        return id
      }),
      cancel: vi.fn((key: number) => callbacks.delete(key)),
    },
  }
  const actor = createNativePlaybackResources(options)
  const notices: unknown[] = []
  const controller = createResourceController(actor.ports, (n) => {
    notices.push(n)
  })
  return {
    actor,
    controller,
    notices,
    options,
    loaded,
    native,
    face,
    loadedFace,
    gesture,
    loadedHands,
    stream,
    pair,
    source,
    callbacks,
    async fire(at: number) {
      const entry = callbacks.entries().next().value
      if (!entry) throw new Error('No callback')
      callbacks.delete(entry[0])
      entry[1](at)
      await drain()
    },
    prepare: () => controller.run({ type: 'request-camera', generation: 1 }),
  }
}
beforeEach(() => vi.resetAllMocks())
// FR-A-01/03·FR-S-03/04: synthetic accepted observations and supplied errors, not clinical rules.
function feedbackProgram(): FeedbackProgram {
  return {
    motionId: 'synthetic',
    version: '1',
    regions: [{ id: 'arm', bones: ['upperarm01L'] }],
  }
}
function feedbackFrame(sequence = 1, at = 100): PoseRigFrame {
  return { generation: 1, sequence, at, result: { landmarks: [], worldLandmarks: [] } }
}
function feedbackDecision(frame = feedbackFrame()) {
  const state = advanceCoaching(referenceState(frame.generation), {
    type: 'frame',
    now: frame.at + 1,
    generation: frame.generation,
    sampledAt: frame.at,
    sequence: frame.sequence,
    personCount: 1,
    stepId: 'hold',
    classification: 'unmet',
  }).state
  return { state, errors: [{ regionId: 'arm', severity: 'deviation' as const }] }
}
describe('native feedback observation and session binding', () => {
  it('copies settings before awaits and forwards original accepted capture plus current coaching phase', async () => {
    const program = feedbackProgram(),
      frame = feedbackFrame(),
      evaluate = vi.fn((_frame: PoseRigFrame) => feedbackDecision(frame))
    const f = setup(undefined, undefined, referenceProgram(), { program, evaluate })
    ;(program.regions as { id: string; bones: string[] }[])[0].id = 'mutated'
    vi.mocked(f.pair.observe).mockReturnValue(true)
    f.source.read.mockResolvedValueOnce(frame as never)
    await f.prepare()
    f.actor.start(1)
    await f.fire(100)
    expect(vi.mocked(prepareOwnedAvatarPair).mock.calls[0][1].feedback).toEqual(feedbackProgram())
    expect(evaluate).toHaveBeenCalledOnce()
    expect(evaluate.mock.calls[0]?.[0]).toEqual(frame)
    expect(f.pair.updateFeedback).toHaveBeenCalledWith({
      generation: 1,
      sequence: 1,
      at: 100,
      motionId: 'synthetic',
      version: '1',
      errors: [{ regionId: 'arm', severity: 'deviation' }],
    })
    await f.fire(102)
    expect(f.pair.updateReference).toHaveBeenLastCalledWith(
      expect.objectContaining({ at: 101, phase: 'waiting-start' }),
    )
    await f.actor.close()
    await f.controller.close()
  })
  it.each(['generation', 'sequence', 'at', 'version', 'status', 'unobservable'] as const)(
    'rejects %s session mismatch without fabricating progress or errors',
    async (kind) => {
      const frame = feedbackFrame(),
        decision = feedbackDecision(frame)
      const state = {
        ...decision.state,
        ...(kind === 'generation' ? { generation: 2 } : {}),
        ...(kind === 'sequence' ? { lastSequence: 2 } : {}),
        ...(kind === 'at' ? { lastSampledAt: 99 } : {}),
        ...(kind === 'status' ? { status: 'paused' as const } : {}),
        ...(kind === 'unobservable' ? { lastObservationAt: null } : {}),
        ...(kind === 'version' ? { plan: { ...decision.state.plan, version: 'old' } } : {}),
      }
      const evaluate = vi.fn(() => ({ ...decision, state })),
        f = setup(undefined, undefined, referenceProgram(), {
          program: feedbackProgram(),
          evaluate,
        })
      vi.mocked(f.pair.observe).mockReturnValue(true)
      f.source.read.mockResolvedValueOnce(frame as never)
      await f.prepare()
      f.actor.start(1)
      await f.fire(100)
      await f.fire(102)
      expect(evaluate).toHaveBeenCalledOnce()
      expect(f.pair.updateFeedback).not.toHaveBeenCalled()
      expect(f.pair.updateReference).not.toHaveBeenCalled()
      await f.actor.close()
      await f.controller.close()
    },
  )
  it('does not evaluate a rejected observation and accepts null without synthesizing errors', async () => {
    const evaluate = vi.fn(() => null),
      f = setup(undefined, undefined, undefined, { program: feedbackProgram(), evaluate })
    f.source.read.mockResolvedValueOnce(feedbackFrame() as never)
    await f.prepare()
    f.actor.start(1)
    await f.fire(100)
    expect(evaluate).not.toHaveBeenCalled()
    vi.mocked(f.pair.observe).mockReturnValue(true)
    f.source.read.mockResolvedValueOnce(feedbackFrame(2, 110) as never)
    await f.fire(110)
    expect(evaluate).toHaveBeenCalledOnce()
    expect(f.pair.updateFeedback).not.toHaveBeenCalled()
    await f.actor.close()
    await f.controller.close()
  })
  it('guards feedback-only retained commands while source disposal is still borrowed', async () => {
    const evaluate = vi.fn(() => null),
      f = setup(undefined, undefined, undefined, { program: feedbackProgram(), evaluate }),
      gate = deferred<void>()
    await f.prepare()
    f.actor.start(1)
    await f.fire(100)
    const retained = f.options.render.mock.calls.at(-1)?.[0] as typeof f.pair
    f.source.dispose.mockReturnValueOnce(gate.promise)
    const closing = f.controller.close()
    await drain()
    expect(
      retained.updateFeedback({
        generation: 1,
        sequence: 1,
        at: 100,
        motionId: 'synthetic',
        version: '1',
        errors: [],
      }),
    ).toBe(false)
    expect(retained.observe(feedbackFrame())).toBe(false)
    expect(evaluate).not.toHaveBeenCalled()
    expect(f.pair.updateFeedback).not.toHaveBeenCalled()
    gate.resolve()
    await closing
    await f.actor.close()
  })
  it('drops a decision whose callback retires the controller', async () => {
    let cancel = () => {},
      evaluate = vi.fn(() => {
        cancel()
        return feedbackDecision()
      })
    const f = setup(undefined, undefined, referenceProgram(), {
      program: feedbackProgram(),
      evaluate,
    })
    cancel = () => {
      void f.controller.close()
    }
    vi.mocked(f.pair.observe).mockReturnValue(true)
    f.source.read.mockResolvedValueOnce(feedbackFrame() as never)
    await f.prepare()
    f.actor.start(1)
    await f.fire(100)
    expect(evaluate).toHaveBeenCalledOnce()
    expect(f.pair.updateFeedback).not.toHaveBeenCalled()
    expect(f.pair.updateReference).not.toHaveBeenCalled()
    await f.controller.close()
    await f.actor.close()
  })
  it('keeps a newer reentrant observation instead of the older supplied decision', async () => {
    let retained: typeof f.pair | undefined
    const evaluate = vi.fn((frame: PoseRigFrame) => {
      if (frame.sequence === 1) retained?.observe(feedbackFrame(2, 101))
      return feedbackDecision(frame)
    })
    const f = setup(undefined, undefined, referenceProgram(), {
      program: feedbackProgram(),
      evaluate,
    })
    f.options.render.mockImplementation((pair: unknown) => {
      retained = pair as typeof f.pair
    })
    vi.mocked(f.pair.observe).mockReturnValue(true)
    f.source.read.mockResolvedValueOnce(feedbackFrame() as never)
    await f.prepare()
    f.actor.start(1)
    await f.fire(100)
    expect(evaluate).toHaveBeenCalledTimes(2)
    expect(f.pair.updateFeedback).toHaveBeenCalledOnce()
    expect(f.pair.updateFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ sequence: 2, at: 101 }),
    )
    await f.actor.close()
    await f.controller.close()
  })
  it.each(['throw', 'promise'] as const)(
    'bounds %s evaluation and closes rather than forwarding native/private errors',
    async (kind) => {
      const evaluate = vi.fn(() => {
        if (kind === 'throw') throw new Error('PRIVATE_FEEDBACK')
        return Promise.reject(new Error('PRIVATE_FEEDBACK'))
      })
      const f = setup(undefined, undefined, undefined, {
        program: feedbackProgram(),
        evaluate: evaluate as never,
      })
      vi.mocked(f.pair.observe).mockReturnValue(true)
      f.source.read.mockResolvedValueOnce(feedbackFrame() as never)
      await f.prepare()
      f.actor.start(1)
      await f.fire(100)
      expect(f.options.onFailure).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', reason: 'asset-error' }),
      )
      expect(JSON.stringify(f.options.onFailure.mock.calls)).not.toContain('PRIVATE_FEEDBACK')
      expect(f.pair.updateFeedback).not.toHaveBeenCalled()
      await f.actor.close()
      await f.controller.close()
      expect(f.native.close).toHaveBeenCalledOnce()
    },
  )
  it.each(['callback', 'errors-getter'] as const)(
    'does not retire a newer reentrant observation when the older %s throws',
    async (kind) => {
      let retained: typeof f.pair | undefined
      const evaluate = vi.fn((frame: PoseRigFrame) => {
        const decision = feedbackDecision(frame)
        if (frame.sequence !== 1) return decision
        const replaced = () => {
          retained?.observe(feedbackFrame(2, 101))
          throw new Error('PRIVATE_OLD_DECISION')
        }
        if (kind === 'callback') return replaced()
        Object.defineProperty(decision, 'errors', { get: replaced })
        return decision
      })
      const f = setup(undefined, undefined, referenceProgram(), {
        program: feedbackProgram(),
        evaluate,
      })
      f.options.render.mockImplementation((pair: unknown) => {
        retained = pair as typeof f.pair
      })
      vi.mocked(f.pair.observe).mockReturnValue(true)
      f.source.read.mockResolvedValueOnce(feedbackFrame() as never)
      await f.prepare()
      f.actor.start(1)
      await f.fire(100)
      expect(f.options.onFailure).not.toHaveBeenCalled()
      expect(f.actor.getSnapshot().status).toBe('running')
      expect(f.pair.updateFeedback).toHaveBeenCalledOnce()
      expect(f.pair.updateFeedback).toHaveBeenLastCalledWith(
        expect.objectContaining({ sequence: 2, at: 101 }),
      )
      await f.actor.close()
      await f.controller.close()
    },
  )
  it('rejects malformed feedback settings before touching any camera', async () => {
    const f = setup()
    expect(() =>
      createNativePlaybackResources({
        ...f.options,
        feedback: { program: { ...feedbackProgram(), version: '' }, evaluate: () => null },
      }),
    ).toThrow('Invalid native playback resources')
    expect(openCamera).not.toHaveBeenCalled()
  })
  it.each(['phase', 'step', 'age'] as const)(
    'never highlights with an invalid current %s field',
    async (kind) => {
      const frame = feedbackFrame(),
        decision = feedbackDecision(frame)
      const state = {
        ...decision.state,
        ...(kind === 'phase' ? { phase: 'invalid' as never } : {}),
        ...(kind === 'step' ? { stepIndex: -1 } : {}),
        ...(kind === 'age' ? { plan: { ...decision.state.plan, maxFrameAgeMs: NaN } } : {}),
      }
      const f = setup(undefined, undefined, referenceProgram(), {
        program: feedbackProgram(),
        evaluate: () => ({ ...decision, state }),
      })
      vi.mocked(f.pair.observe).mockReturnValue(true)
      f.source.read.mockResolvedValueOnce(frame as never)
      await f.prepare()
      f.actor.start(1)
      await f.fire(100)
      expect(f.pair.updateFeedback).not.toHaveBeenCalled()
      expect(f.pair.updateReference).not.toHaveBeenCalled()
      await f.actor.close()
      await f.controller.close()
    },
  )
})
// FR-S-03/04: authored program + actual progression state, no clinical defaults.
function referenceProgram(): ReferenceProgram {
  const clip = () =>
    new AnimationClip('test-not-release', 1, [
      new QuaternionKeyframeTrack('head.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ])
  return {
    motionId: 'synthetic',
    version: '1',
    blendMs: 100,
    maxAgeMs: 250,
    steps: [
      {
        id: 'hold',
        clips: {
          'waiting-start': clip(),
          'seeking-target': clip(),
          holding: clip(),
          'waiting-return': clip(),
        },
      },
    ],
  }
}
function referenceState(generation = 1) {
  return {
    ...createCoaching({
      motionId: 'synthetic',
      version: '1',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'hold', kind: 'hold', targetMs: 100 }],
    }),
    status: 'running' as const,
    generation,
    lastNow: 100,
    readyAt: 100,
  }
}
describe('optional native reference session binding', () => {
  it('does not let a retained renderer pair bypass controller cancellation during a borrow', async () => {
    const f = setup(undefined, undefined, referenceProgram()),
      gate = deferred<void>()
    await f.prepare()
    f.actor.start(1)
    await f.fire(100)
    const retained = f.options.render.mock.calls.at(-1)?.[0] as typeof f.pair | undefined
    expect(retained).toBeDefined()
    const feedback = {
      generation: 1,
      sequence: 1,
      at: 100,
      motionId: 'synthetic',
      version: '1',
      errors: [],
    }
    expect(retained?.updateFeedback(feedback)).toBe(true)
    expect(f.pair.updateFeedback).toHaveBeenCalledOnce()
    f.source.dispose.mockReturnValueOnce(gate.promise)
    const closing = f.controller.close()
    await drain()
    const before = vi.mocked(f.pair.render).mock.calls.length
    expect(
      retained?.updateReference({
        generation: 1,
        sequence: 99,
        at: 110,
        motionId: 'synthetic',
        version: '1',
        stepId: 'hold',
        phase: 'holding',
        status: 'running',
      }),
    ).toBe(false)
    expect(retained?.updateFeedback({ ...feedback, sequence: 2, at: 110 })).toBe(false)
    expect(f.pair.updateFeedback).toHaveBeenCalledOnce()
    retained?.render(110, 10)
    expect(f.pair.render).toHaveBeenCalledTimes(before)
    expect(f.pair.updateReference).not.toHaveBeenCalled()
    gate.resolve()
    await closing
    await f.actor.close()
  })
  it('defers a future session cue to its first eligible original render stamp and keeps newer pending input', async () => {
    const f = setup(undefined, undefined, referenceProgram())
    await f.prepare()
    f.actor.start(1)
    expect(f.actor.synchronize(referenceState())).toBe(true)
    expect(f.pair.updateReference).not.toHaveBeenCalled()
    await f.fire(90)
    expect(f.pair.updateReference).not.toHaveBeenCalled()
    await f.fire(100)
    expect(f.pair.updateReference).toHaveBeenCalledWith(
      expect.objectContaining({ at: 100, sequence: 1 }),
    )
    expect(
      f.actor.synchronize({ ...referenceState(), lastNow: 110, phase: 'seeking-target' }),
    ).toBe(true)
    expect(f.actor.synchronize(referenceState())).toBe(false)
    await f.fire(105)
    expect(f.pair.updateReference).toHaveBeenCalledOnce()
    await f.fire(110)
    expect(f.pair.updateReference).toHaveBeenLastCalledWith(
      expect.objectContaining({ at: 110, sequence: 2, phase: 'seeking-target' }),
    )
    await f.actor.close()
  })
  it('rechecks authority after input getters and never forwards during getter-triggered abort', async () => {
    const f = setup(undefined, undefined, referenceProgram())
    await f.prepare()
    const state = referenceState()
    Object.defineProperty(state, 'phase', {
      get() {
        void f.controller.close()
        return 'holding'
      },
    })
    expect(f.actor.synchronize(state)).toBe(false)
    expect(f.pair.updateReference).not.toHaveBeenCalled()
    await f.actor.close()
  })
  it('bounds a malformed current state and never invokes the pair with partial identity', async () => {
    const f = setup(undefined, undefined, referenceProgram())
    await f.prepare()
    const state = referenceState()
    Object.defineProperty(state, 'plan', {
      get() {
        throw new Error('PRIVATE_REFERENCE_STATE')
      },
    })
    expect(f.actor.synchronize(state)).toBe(false)
    expect(f.pair.updateReference).not.toHaveBeenCalled()
    await f.actor.close()
    expect(f.options.onFailure).toHaveBeenCalledWith({
      type: 'error',
      generation: 1,
      reason: 'asset-error',
    })
    expect(JSON.stringify(f.actor.getSnapshot())).not.toContain('PRIVATE_REFERENCE_STATE')
  })
  it('resets cue sequence for a fresh generation and ignores the retired one', async () => {
    const f = setup(undefined, undefined, referenceProgram())
    await f.prepare()
    f.actor.start(1)
    expect(f.actor.synchronize(referenceState())).toBe(true)
    await f.fire(100)
    const next = { ...f.pair, dispose: vi.fn(), updateReference: vi.fn(() => true) }
    vi.mocked(prepareOwnedAvatarPair).mockResolvedValueOnce(next)
    vi.mocked(createVideoPoseSource).mockReturnValueOnce({
      read: async () => null,
      dispose: async () => {},
    })
    await f.controller.run({ type: 'request-camera', generation: 2 })
    expect(f.actor.synchronize(referenceState())).toBe(false)
    expect(f.actor.synchronize(referenceState(2))).toBe(true)
    f.actor.start(2)
    await f.fire(100)
    expect(next.updateReference).toHaveBeenCalledWith(
      expect.objectContaining({ generation: 2, sequence: 1 }),
    )
    expect(f.pair.updateReference).toHaveBeenCalledOnce()
    await f.actor.close()
  })
  it('remains inert when absent, invalid or not yet ready', async () => {
    const f = setup()
    expect(f.actor.synchronize(referenceState())).toBe(false)
    await f.prepare()
    expect(f.actor.synchronize(referenceState())).toBe(false)
    await f.actor.close()
    const g = setup(undefined, undefined, referenceProgram())
    expect(g.actor.synchronize(referenceState())).toBe(false)
    expect(() =>
      createNativePlaybackResources({
        ...g.options,
        reference: { ...referenceProgram(), version: '' },
      }),
    ).toThrow('Invalid native playback resources')
    expect(g.pair.updateReference).not.toHaveBeenCalled()
    await g.actor.close()
  })
  it('copies reference data before awaits and forwards original state time with monotonic cue sequences', async () => {
    const program = referenceProgram(),
      f = setup(undefined, undefined, program)
    ;(program as { version: string }).version = 'changed'
    program.steps[0].clips.holding.tracks[0].values[3] = 99
    await f.prepare()
    const supplied = vi.mocked(prepareOwnedAvatarPair).mock.calls[0][1].reference
    expect(supplied?.version).toBe('1')
    expect(supplied?.steps[0].clips.holding.tracks[0].values[3]).toBe(1)
    const state = referenceState()
    f.actor.start(1)
    expect(f.actor.synchronize(state)).toBe(true)
    await f.fire(100)
    const progressed = advanceCoaching(state, {
      type: 'frame',
      now: 110,
      generation: 1,
      sampledAt: 110,
      sequence: 1,
      personCount: 1,
      stepId: 'hold',
      classification: 'start',
    }).state
    const before = JSON.stringify(progressed)
    expect(f.actor.synchronize(progressed)).toBe(true)
    await f.fire(110)
    expect(JSON.stringify(progressed)).toBe(before)
    expect(vi.mocked(f.pair.updateReference).mock.calls.map(([cue]) => cue)).toEqual([
      {
        generation: 1,
        sequence: 1,
        at: 100,
        motionId: 'synthetic',
        version: '1',
        stepId: 'hold',
        status: 'running',
        phase: 'waiting-start',
      },
      {
        generation: 1,
        sequence: 2,
        at: 110,
        motionId: 'synthetic',
        version: '1',
        stepId: 'hold',
        status: 'running',
        phase: 'seeking-target',
      },
    ])
    expect(f.actor.synchronize({ ...state, generation: 2 })).toBe(false)
    expect(f.pair.updateReference).toHaveBeenCalledTimes(2)
    await f.actor.close()
  })
  it('rejects old cues during retirement while keeping native borrowed handles alive', async () => {
    const f = setup(headAlignment(), handAlignment(), referenceProgram()),
      gate = deferred<void>()
    await f.prepare()
    f.actor.start(1)
    f.source.dispose.mockReturnValueOnce(gate.promise)
    const closing = f.controller.close()
    await drain()
    expect(f.actor.synchronize(referenceState())).toBe(false)
    expect(f.pair.updateReference).not.toHaveBeenCalled()
    for (const sdk of [f.native, f.face, f.gesture]) expect(sdk.close).not.toHaveBeenCalled()
    gate.resolve()
    await closing
    await f.actor.close()
    for (const sdk of [f.native, f.face, f.gesture]) expect(sdk.close).toHaveBeenCalledOnce()
  })
})
describe('native playback adapter', () => {
  it('is inert and requires explicit model/rig configuration', () => {
    const f = setup()
    expect(openCamera).not.toHaveBeenCalled()
    expect(createPoseLandmarker).not.toHaveBeenCalled()
    expect(createFaceLandmarker).not.toHaveBeenCalled()
    expect(createGestureRecognizer).not.toHaveBeenCalled()
    expect(f.actor.getSnapshot().cameraError).toBeNull()
    for (const change of [
      { model: 'constructor' },
      { mirror: 'yes' },
      { halfLifeMs: 0 },
      { maxAgeMs: NaN },
      { loadAvatar: null },
    ])
      expect(() => createNativePlaybackResources({ ...f.options, ...change } as never)).toThrow(
        'Invalid native playback resources',
      )
  })
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotReadableError', 'busy'],
    ['NotFoundError', 'not-found'],
    ['Error', 'unknown'],
  ])('keeps only fixed kind for %s', async (name, kind) => {
    const f = setup()
    vi.mocked(openCamera).mockRejectedValueOnce(
      name === 'Error'
        ? new Error('PRIVATE_CAMERA_VALUE')
        : new DOMException('PRIVATE_CAMERA_VALUE', name),
    )
    await f.prepare()
    await f.actor.close()
    expect(f.actor.getSnapshot().cameraError).toBe(kind)
    expect(f.notices).toEqual([{ type: 'error', generation: 1, reason: 'camera-error' }])
    expect(createPoseLandmarker).not.toHaveBeenCalled()
    expect(JSON.stringify(f.actor.getSnapshot())).not.toContain('PRIVATE_CAMERA_VALUE')
  })
  it('passes explicit configuration and binds native detect to its instance', async () => {
    const f = setup()
    await f.prepare()
    expect(createPoseLandmarker).toHaveBeenCalledWith('lite')
    expect(createFaceLandmarker).not.toHaveBeenCalled()
    expect(createBodyFaceVideoSource).not.toHaveBeenCalled()
    expect(createBodyHandVideoSource).not.toHaveBeenCalled()
    expect(createGestureRecognizer).not.toHaveBeenCalled()
    const [video] = vi.mocked(openCamera).mock.calls[0]
    expect(video.hidden && video.muted && video.playsInline).toBe(true)
    expect(video.isConnected).toBe(false)
    expect(prepareOwnedAvatarPair).toHaveBeenCalledWith(expect.anything(), {
      load: f.options.loadAvatar,
      mirror: true,
      halfLifeMs: 50,
      maxAgeMs: 250,
    })
    expect(f.actor.start(1)).toBe(true)
    const ports = vi.mocked(createVideoPoseSource).mock.calls[0][1]
    const input = {} as VideoFrame
    ports.detect(input, 100)
    expect(f.native.detectForVideo).toHaveBeenCalledWith(input, 100)
    expect(f.native.detectForVideo.mock.contexts[0]).toBe(f.native)
    await f.controller.close()
    await f.actor.close()
    expect(f.source.dispose).toHaveBeenCalledTimes(1)
    expect(f.native.close).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
  })
  it('reclaims a late camera after cancellation without a denied label or SDK', async () => {
    const f = setup(),
      gate = deferred<MediaStream>()
    vi.mocked(openCamera).mockReturnValueOnce(gate.promise)
    const preparing = f.prepare()
    await drain()
    const closing = f.actor.close()
    await drain()
    expect(createPoseLandmarker).not.toHaveBeenCalled()
    gate.resolve(f.stream)
    await preparing
    await closing
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(f.actor.getSnapshot().cameraError).toBeNull()
    expect(f.notices.some((n) => (n as { type: string }).type === 'ready')).toBe(false)
  })
  it('closes a late SDK once after cancellation before avatar preparation', async () => {
    const f = setup(),
      gate = deferred<typeof f.loaded>()
    vi.mocked(createPoseLandmarker).mockReturnValueOnce(gate.promise)
    const preparing = f.prepare()
    await drain()
    const closing = f.actor.close()
    await drain()
    gate.resolve(f.loaded)
    await preparing
    await closing
    expect(f.native.close).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(prepareOwnedAvatarPair).not.toHaveBeenCalled()
  })
  it('preserves a late SDK cleanup failure and still closes the camera', async () => {
    const f = setup(),
      gate = deferred<typeof f.loaded>()
    f.native.close.mockImplementationOnce(() => {
      throw new Error('PRIVATE_CLOSE_VALUE')
    })
    vi.mocked(createPoseLandmarker).mockReturnValueOnce(gate.promise)
    const preparing = f.prepare()
    await drain()
    const closing = f.actor.close(),
      rejected = expect(closing).rejects.toBeInstanceOf(ResourceCleanupError)
    gate.resolve(f.loaded)
    await preparing
    await rejected
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(f.actor.getSnapshot().poisoned).toBe(true)
    expect(f.actor.start(2)).toBe(false)
  })
  it.each(['sdk', 'avatar'] as const)(
    'reclaims earlier owned resources on %s failure',
    async (stage) => {
      const f = setup()
      if (stage === 'sdk')
        vi.mocked(createPoseLandmarker).mockRejectedValueOnce(new Error('PRIVATE_NATIVE_VALUE'))
      else
        vi.mocked(prepareOwnedAvatarPair).mockRejectedValueOnce(new Error('PRIVATE_NATIVE_VALUE'))
      await f.prepare()
      await f.actor.close()
      expect(closeCamera).toHaveBeenCalledTimes(1)
      expect(f.native.close).toHaveBeenCalledTimes(stage === 'sdk' ? 0 : 1)
      expect(f.notices).toEqual([
        {
          type: 'error',
          generation: 1,
          reason: stage === 'sdk' ? 'inference-error' : 'asset-error',
        },
      ])
    },
  )
  it('retries by explicit fresh bridge and does not reuse a failed camera label', async () => {
    const f = setup()
    vi.mocked(openCamera).mockRejectedValueOnce(new DOMException('', 'NotAllowedError'))
    await f.prepare()
    await f.actor.close()
    const next = setup()
    await next.prepare()
    expect(next.actor.getSnapshot().cameraError).toBeNull()
    expect(next.actor.start(1)).toBe(true)
    await next.controller.close()
    await next.actor.close()
  })
  it('rejects invalid explicit head configuration before acquiring resources', () => {
    const f = setup()
    for (const change of [
      { bone: 'upperarm_l' },
      { matrixLayout: 'automatic' },
      { cameraReference: [0, 0, 0, 0] },
      { cameraReference: [NaN, 0, 0, 1] },
      { cameraReference: null },
      { sceneFromCamera: [0, 1, 1, 1] },
      { sceneFromCamera: [0, 0, 1] },
    ])
      expect(() =>
        createNativePlaybackResources({
          ...f.options,
          head: { ...headAlignment(), ...change },
        } as never),
      ).toThrow('Invalid native playback resources')
    expect(openCamera).not.toHaveBeenCalled()
    expect(createFaceLandmarker).not.toHaveBeenCalled()
  })
  it.each(['column-major', 'row-major'] as const)(
    'copies %s head alignment before any await and binds both native detectors',
    async (layout) => {
      const head = headAlignment(layout),
        f = setup(head)
      head.cameraReference[3] = 0
      head.sceneFromCamera[1] = 1
      head.bone = 'upperarm_l'
      await f.prepare()
      expect(prepareOwnedAvatarPair).toHaveBeenCalledWith(expect.anything(), {
        load: f.options.loadAvatar,
        mirror: true,
        halfLifeMs: 50,
        maxAgeMs: 250,
        head: { bone: 'head', cameraReference: [0, 0, 0, 1], sceneFromCamera: [0, 0, 0, 1] },
      })
      expect(f.actor.start(1)).toBe(true)
      const ports = vi.mocked(createBodyFaceVideoSource).mock.calls[0][1],
        input = {} as VideoFrame
      ports.detectBody(input, 100)
      ports.detectFace(input, 100)
      expect(ports.matrixLayout).toBe(layout)
      expect(f.native.detectForVideo).toHaveBeenCalledWith(input, 100)
      expect(f.face.detectForVideo).toHaveBeenCalledWith(input, 100)
      expect(f.native.detectForVideo.mock.contexts[0]).toBe(f.native)
      expect(f.face.detectForVideo.mock.contexts[0]).toBe(f.face)
      expect(createVideoPoseSource).not.toHaveBeenCalled()
      await f.controller.close()
      await f.actor.close()
      expect(f.native.close).toHaveBeenCalledTimes(1)
      expect(f.face.close).toHaveBeenCalledTimes(1)
      expect(closeCamera).toHaveBeenCalledTimes(1)
      expect(() => ports.detectFace(input, 101)).toThrow()
    },
  )
  it('reclaims the earlier body SDK and camera when face initialization fails', async () => {
    const f = setup(headAlignment())
    vi.mocked(createFaceLandmarker).mockRejectedValueOnce(new Error('PRIVATE_FACE_FAILURE'))
    await f.prepare()
    await f.actor.close()
    expect(f.native.close).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(prepareOwnedAvatarPair).not.toHaveBeenCalled()
    expect(f.notices).toEqual([{ type: 'error', generation: 1, reason: 'inference-error' }])
    expect(JSON.stringify(f.actor.getSnapshot())).not.toContain('PRIVATE_FACE_FAILURE')
  })
  it('does not initialize face after body initialization failure', async () => {
    const f = setup(headAlignment())
    vi.mocked(createPoseLandmarker).mockRejectedValueOnce(new Error('PRIVATE_BODY_FAILURE'))
    await f.prepare()
    await f.actor.close()
    expect(createFaceLandmarker).not.toHaveBeenCalled()
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(f.notices).toEqual([{ type: 'error', generation: 1, reason: 'inference-error' }])
  })
  it('keeps a partial initialization cleanup failure fixed and still releases camera', async () => {
    const f = setup(headAlignment())
    vi.mocked(createFaceLandmarker).mockRejectedValueOnce(new Error('PRIVATE_FACE_FAILURE'))
    f.native.close.mockImplementation(() => {
      throw new Error('PRIVATE_BODY_CLOSE_FAILURE')
    })
    await f.prepare()
    await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
    expect(f.native.close).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(f.actor.getSnapshot().poisoned).toBe(true)
    expect(JSON.stringify(f.actor.getSnapshot())).not.toContain('PRIVATE_BODY_CLOSE_FAILURE')
  })
  it('reclaims both SDKs once when face initialization returns after cancellation', async () => {
    const f = setup(headAlignment()),
      gate = deferred<typeof f.loadedFace>()
    vi.mocked(createFaceLandmarker).mockReturnValueOnce(gate.promise)
    const preparing = f.prepare()
    await drain()
    const closing = f.actor.close()
    await drain()
    expect(f.native.close).toHaveBeenCalledTimes(1)
    gate.resolve(f.loadedFace)
    await preparing
    await closing
    expect(f.native.close).toHaveBeenCalledTimes(1)
    expect(f.face.close).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(prepareOwnedAvatarPair).not.toHaveBeenCalled()
  })
  it.each(['face', 'body'] as const)(
    'preserves %s cleanup failure while releasing all resources',
    async (stage) => {
      const f = setup(headAlignment())
      await f.prepare()
      const closingNative = stage === 'face' ? f.face : f.native
      closingNative.close.mockImplementation(() => {
        throw new Error('PRIVATE_CLOSE_FAILURE')
      })
      await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
      await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
      expect(f.face.close).toHaveBeenCalledTimes(1)
      expect(f.native.close).toHaveBeenCalledTimes(1)
      expect(closeCamera).toHaveBeenCalledTimes(1)
      expect(f.actor.getSnapshot().poisoned).toBe(true)
    },
  )
  it('keeps both SDKs alive until the pending source has returned its borrowed input', async () => {
    const f = setup(headAlignment()),
      gate = deferred<void>()
    f.source.dispose.mockReturnValueOnce(gate.promise)
    await f.prepare()
    expect(f.actor.start(1)).toBe(true)
    const closing = f.actor.close()
    await drain()
    expect(f.source.dispose).toHaveBeenCalledTimes(1)
    expect(f.face.close).not.toHaveBeenCalled()
    expect(f.native.close).not.toHaveBeenCalled()
    expect(closeCamera).not.toHaveBeenCalled()
    gate.resolve()
    await closing
    expect(f.face.close).toHaveBeenCalledTimes(1)
    expect(f.native.close).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
  })
})

describe('optional native hand ownership', () => {
  it.each([false, true])(
    'copies hands before awaits and binds all configured instances (face=%s)',
    async (withFace) => {
      const hands = handAlignment(),
        f = setup(withFace ? headAlignment() : undefined, hands)
      hands.cameraReferences.left[3] = 99
      hands.cameraReferences.right[0] = 99
      hands.sceneFromCamera[1] = 99
      await f.prepare()
      expect(createGestureRecognizer).toHaveBeenCalledOnce()
      expect(createFaceLandmarker).toHaveBeenCalledTimes(withFace ? 1 : 0)
      expect(prepareOwnedAvatarPair).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ hands: handAlignment() }),
      )
      expect(f.actor.start(1)).toBe(true)
      const ports = vi.mocked(createBodyHandVideoSource).mock.calls[0][1],
        input = {} as VideoFrame
      ports.detectBody(input, 100)
      ports.detectHands(input, 100)
      expect(f.gesture.recognizeForVideo).toHaveBeenCalledWith(input, 100)
      expect(f.gesture.recognizeForVideo.mock.contexts[0]).toBe(f.gesture)
      if (withFace) {
        ports.face?.detectFace(input, 100)
        expect(ports.face?.matrixLayout).toBe('column-major')
        expect(f.face.detectForVideo.mock.contexts[0]).toBe(f.face)
      } else expect(ports).not.toHaveProperty('face')
      expect(createBodyFaceVideoSource).not.toHaveBeenCalled()
      await f.actor.close()
      expect(f.gesture.close).toHaveBeenCalledOnce()
      expect(f.native.close).toHaveBeenCalledOnce()
      expect(f.face.close).toHaveBeenCalledTimes(withFace ? 1 : 0)
      expect(closeCamera).toHaveBeenCalledOnce()
      expect(() => ports.detectHands(input, 101)).toThrow()
    },
  )
  it('rejects invalid hand alignment without acquiring camera or SDK', () => {
    const f = setup()
    for (const hands of [
      null,
      {},
      { ...handAlignment(), sceneFromCamera: [0, 0, 0, 0] },
      { ...handAlignment(), cameraReferences: { left: [0, NaN, 0, 1] } },
    ])
      expect(() => createNativePlaybackResources({ ...f.options, hands } as never)).toThrow(
        'Invalid native playback resources',
      )
    expect(openCamera).not.toHaveBeenCalled()
    expect(createGestureRecognizer).not.toHaveBeenCalled()
  })
  it('reclaims both earlier SDKs after hand initialization fails even when face close throws', async () => {
    const f = setup(headAlignment(), handAlignment())
    vi.mocked(createGestureRecognizer).mockRejectedValueOnce(new Error('PRIVATE_HAND_INIT'))
    f.face.close.mockImplementation(() => {
      throw new Error('PRIVATE_FACE_CLOSE')
    })
    await f.prepare()
    await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
    expect(f.face.close).toHaveBeenCalledOnce()
    expect(f.native.close).toHaveBeenCalledOnce()
    expect(closeCamera).toHaveBeenCalledOnce()
    expect(prepareOwnedAvatarPair).not.toHaveBeenCalled()
    expect(f.actor.getSnapshot().poisoned).toBe(true)
  })
  it('does not initialize hands after face failure', async () => {
    const f = setup(headAlignment(), handAlignment())
    vi.mocked(createFaceLandmarker).mockRejectedValueOnce(new Error('PRIVATE_FACE_INIT'))
    await f.prepare()
    await f.actor.close()
    expect(createGestureRecognizer).not.toHaveBeenCalled()
    expect(f.native.close).toHaveBeenCalledOnce()
  })
  it('closes a late hand SDK once after cancellation and keeps camera cleanup', async () => {
    const f = setup(headAlignment(), handAlignment()),
      gate = deferred<typeof f.loadedHands>()
    vi.mocked(createGestureRecognizer).mockReturnValueOnce(gate.promise)
    const preparing = f.prepare()
    await drain()
    const closing = f.actor.close()
    await drain()
    expect(f.native.close).toHaveBeenCalledOnce()
    expect(f.face.close).toHaveBeenCalledOnce()
    gate.resolve(f.loadedHands)
    await preparing
    await closing
    expect(f.gesture.close).toHaveBeenCalledOnce()
    expect(closeCamera).toHaveBeenCalledOnce()
    expect(prepareOwnedAvatarPair).not.toHaveBeenCalled()
  })
  it.each(['body', 'face', 'hands'] as const)(
    'attempts all release operations after %s close failure',
    async (stage) => {
      const f = setup(headAlignment(), handAlignment())
      await f.prepare()
      const native = stage === 'body' ? f.native : stage === 'face' ? f.face : f.gesture
      native.close.mockImplementation(() => {
        throw new Error('PRIVATE_SDK_CLOSE')
      })
      await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
      await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
      for (const sdk of [f.native, f.face, f.gesture]) expect(sdk.close).toHaveBeenCalledOnce()
      expect(closeCamera).toHaveBeenCalledOnce()
      expect(f.actor.getSnapshot().poisoned).toBe(true)
    },
  )
  it('holds three SDKs and camera until pending source disposal returns', async () => {
    const f = setup(headAlignment(), handAlignment()),
      gate = deferred<void>()
    f.source.dispose.mockReturnValueOnce(gate.promise)
    await f.prepare()
    expect(f.actor.start(1)).toBe(true)
    const closing = f.actor.close()
    await drain()
    for (const sdk of [f.native, f.face, f.gesture]) expect(sdk.close).not.toHaveBeenCalled()
    expect(closeCamera).not.toHaveBeenCalled()
    gate.resolve()
    await closing
    for (const sdk of [f.native, f.face, f.gesture]) expect(sdk.close).toHaveBeenCalledOnce()
    expect(closeCamera).toHaveBeenCalledOnce()
  })
})
