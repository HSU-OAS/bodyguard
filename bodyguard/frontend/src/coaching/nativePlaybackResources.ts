// FR-M-01/02/07·FR-A-01/03·FR-S-02/04/NFR-07/08: native ownership, no public consumer.

import type { HeadDisplayAlignment } from '../avatar/headOrientationRig'
import { copyHandAlignment, type HandDisplayAlignment } from '../avatar/observedHandRig'
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import { OBSERVED_TRUNK_BINDING } from '../avatar/observedTrunk'
import { prepareOwnedAvatarPair } from '../avatar/ownedAvatarPair'
import {
  copyReferenceProgram,
  type ReferenceCue,
  type ReferenceProgram,
} from '../avatar/referencePlayback'
import {
  copyFeedbackProgram,
  type FeedbackFrame,
  type FeedbackProgram,
} from '../avatar/surfaceFeedback'
import { createBodyFaceVideoSource } from '../pose/bodyFaceVideoSource'
import { createBodyHandVideoSource } from '../pose/bodyHandVideoSource'
import { type CameraErrorKind, cameraErrorKind, closeCamera, openCamera } from '../pose/camera'
import { POSE_MODELS, type PoseModel } from '../pose/constants'
import { createFaceLandmarker } from '../pose/face'
import { createGestureRecognizer } from '../pose/hands'
import { createPoseLandmarker } from '../pose/landmarker'
import { createVideoPoseSource } from '../pose/videoPoseSource'
import { createWorkerPoseInference } from '../pose/workerInference'
import { copyCapturedImage } from '../posture/capturedImage'
import type { CoachingState } from '../stretch/progression'
import { createOwnedPlaybackResources } from './ownedPlaybackResources'
import { ResourceCleanupError, type ResourceContext, type ResourceNotice } from './resources'

type Pair = Awaited<ReturnType<typeof prepareOwnedAvatarPair>>
type Rig = Parameters<typeof prepareOwnedAvatarPair>[1]
type Bridge = Parameters<typeof createOwnedPlaybackResources>[0]
// FR-S-03/04: the evaluator owns a real session state. Supplying it is not clinical validation.
export type NativeFeedbackDecision = Readonly<{
  state: CoachingState
  errors: FeedbackFrame['errors']
}>
type Options = Readonly<{
  model: PoseModel
  /** Private explicit opt-in until actual SDK/browser and integration gates pass. */
  inferenceThread?: 'main' | 'worker'
  // Private opt-in: discard one actual frame before playback becomes ready.
  warmupInference?: boolean
  loadAvatar: Rig['load']
  /** Renderer-owned readiness before replay; explicit private opt-in, no capture/clinical cue. */
  prepareAvatar?: (
    models: NonNullable<Pair['models']>,
    context: ResourceContext,
  ) => void | Promise<void>
  mirror: boolean
  halfLifeMs: number
  maxAgeMs: number
  trunk?: boolean
  head?: HeadDisplayAlignment & Readonly<{ matrixLayout: 'column-major' | 'row-major' }>
  hands?: HandDisplayAlignment
  reference?: ReferenceProgram
  feedback?: Readonly<{
    program: FeedbackProgram
    evaluate(frame: PoseRigFrame): NativeFeedbackDecision | null
  }>
  scheduler: Bridge['scheduler']
  render(pair: Pair): unknown
  onFailure(notice: Extract<ResourceNotice, { type: 'error' }>): void | Promise<void>
}>

// Abort listeners never throw native errors. Explicit disposal preserves cleanup failure.
function ownNative(context: ResourceContext, close: () => void) {
  let disposed = false,
    failed = false
  function dispose() {
    if (!disposed) {
      disposed = true
      context.signal.removeEventListener('abort', aborted)
      try {
        close()
      } catch {
        failed = true
      }
    }
    if (failed) throw new ResourceCleanupError()
  }
  function aborted() {
    try {
      dispose()
    } catch {
      /* The later explicit dispose observes the fixed failure. */
    }
  }
  context.signal.addEventListener('abort', aborted, { once: true })
  if (context.signal.aborted) {
    dispose()
    context.signal.throwIfAborted()
  }
  return dispose
}

/** Fresh bridge per recorded owner. Caller supplies the explicit model, owned source loader,
 * validated rig controls, renderer and scheduler. No release asset/model or clinical defaults.
 * Current SDK behavior is unchanged; a production egress policy still requires approval.
 */
export function createNativePlaybackResources(options: Options) {
  const { model, loadAvatar, mirror, halfLifeMs, maxAgeMs, scheduler, render, onFailure } = options
  // Snapshot caller-owned alignment before camera/SDK awaits. Numeric roundoff only,
  // not a neutral-pose detector, anatomical angle or clinical acceptance threshold.
  let head: Options['head']
  let hands: HandDisplayAlignment | undefined
  let reference: ReferenceProgram | undefined
  let feedback: FeedbackProgram | undefined
  let evaluateFeedback: NonNullable<Options['feedback']>['evaluate'] | undefined
  let prepareAvatar: Options['prepareAvatar']
  let trunk = false
  let inferenceThread: 'main' | 'worker' = 'main'
  let warmupInference = false
  try {
    const requestedThread = options.inferenceThread
    prepareAvatar = options.prepareAvatar
    if (prepareAvatar !== undefined && typeof prepareAvatar !== 'function') throw new Error()
    if (requestedThread !== undefined && requestedThread !== 'main' && requestedThread !== 'worker')
      throw new Error()
    inferenceThread = requestedThread ?? 'main'
    const requestedWarmup = options.warmupInference
    if (requestedWarmup !== undefined && typeof requestedWarmup !== 'boolean') throw new Error()
    warmupInference = requestedWarmup === true
    const requestedTrunk = options.trunk
    if (requestedTrunk !== undefined && typeof requestedTrunk !== 'boolean') throw new Error()
    trunk = requestedTrunk === true
    const requestedFeedback = options.feedback
    if (requestedFeedback !== undefined) {
      feedback = copyFeedbackProgram(requestedFeedback.program)
      evaluateFeedback = requestedFeedback.evaluate
      if (typeof evaluateFeedback !== 'function') throw new Error()
    }
    if (
      !trunk &&
      feedback?.regions.some((region) => region.bones.includes(OBSERVED_TRUNK_BINDING.bone))
    )
      throw new Error()
    const requestedReference = options.reference
    if (requestedReference !== undefined) reference = copyReferenceProgram(requestedReference)
    if (
      reference &&
      feedback &&
      (reference.motionId !== feedback.motionId || reference.version !== feedback.version)
    )
      throw new Error()
    for (const step of reference?.steps ?? [])
      for (const correction of step.corrections ?? [])
        if (!feedback?.regions.some((region) => region.id === correction.regionId))
          throw new Error()
    const requestedHands = options.hands
    if (requestedHands !== undefined) hands = copyHandAlignment(requestedHands)
    const requested = options.head
    if (requested !== undefined) {
      if (
        !requested ||
        !Array.isArray(requested.cameraReference) ||
        !Array.isArray(requested.sceneFromCamera) ||
        requested.cameraReference.length !== 4 ||
        requested.sceneFromCamera.length !== 4
      )
        throw new Error()
      head = Object.freeze({
        bone: requested.bone,
        matrixLayout: requested.matrixLayout,
        cameraReference: Object.freeze(Array.from(requested.cameraReference)),
        sceneFromCamera: Object.freeze(Array.from(requested.sceneFromCamera)),
      })
    }
  } catch {
    throw new Error('Invalid native playback resources')
  }
  if (
    typeof model !== 'string' ||
    !Object.hasOwn(POSE_MODELS, model) ||
    typeof loadAvatar !== 'function' ||
    typeof mirror !== 'boolean' ||
    !Number.isFinite(halfLifeMs) ||
    halfLifeMs <= 0 ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs <= 0 ||
    (head &&
      (head.bone !== 'head' ||
        (head.matrixLayout !== 'column-major' && head.matrixLayout !== 'row-major') ||
        [head.cameraReference, head.sceneFromCamera].some(
          (q) =>
            q.length !== 4 || !q.every(Number.isFinite) || Math.abs(Math.hypot(...q) - 1) > 1e-5,
        )))
  )
    throw new Error('Invalid native playback resources')
  let cameraError: CameraErrorKind | null = null
  let pendingCue: ReferenceCue | undefined
  const adaptive = reference?.steps.some((step) => step.corrections?.length) ?? false
  let currentObservation:
    | Readonly<{
        generation: number
        sequence: number
        sampledAt: number
        stepId: string
        phase: ReferenceCue['phase']
        correction?: NonNullable<ReferenceCue['correction']>
      }>
    | undefined
  let issueCommand: (generation: number, action: (pair: Pair) => boolean) => boolean = () => false
  const bridge = createOwnedPlaybackResources({
    async camera(context) {
      cameraError = null
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.hidden = true
      try {
        const stream = await openCamera(video, context.signal)
        const dispose = ownNative(context, () => {
          try {
            closeCamera(video, stream)
          } finally {
            video.remove()
          }
        })
        return { video, stream, dispose }
      } catch (error) {
        video.remove()
        if (!context.signal.aborted) cameraError = cameraErrorKind(error)
        throw error
      }
    },
    async inference(context) {
      if (inferenceThread === 'worker')
        return createWorkerPoseInference(context, {
          model,
          face: Boolean(head),
          hands: Boolean(hands),
          matrixLayout: head?.matrixLayout ?? 'column-major',
        })
      const native = await createPoseLandmarker(model)
      const disposeBody = ownNative(context, () => native.landmarker.close())
      let face: Awaited<ReturnType<typeof createFaceLandmarker>> | undefined
      let disposeFace: (() => void) | undefined
      let gesture: Awaited<ReturnType<typeof createGestureRecognizer>> | undefined
      let disposeHands: (() => void) | undefined
      function disposeInference() {
        let failed = false
        for (const release of [disposeHands, disposeFace, disposeBody]) {
          try {
            release?.()
          } catch {
            failed = true
          }
        }
        if (failed) throw new ResourceCleanupError()
      }
      try {
        if (head) {
          const ownedFace = await createFaceLandmarker()
          face = ownedFace
          disposeFace = ownNative(context, () => ownedFace.landmarker.close())
        }
        if (hands) {
          const ownedHands = await createGestureRecognizer()
          gesture = ownedHands
          disposeHands = ownNative(context, () => ownedHands.recognizer.close())
        }
      } catch (error) {
        // Attempt every earlier release, even when one close failed.
        disposeInference()
        throw error
      }
      const detectBody = (frame: VideoFrame, at: number) => {
        context.signal.throwIfAborted()
        return native.landmarker.detectForVideo(frame, at)
      }
      return {
        thread: 'main' as const,
        dispose: disposeInference,
        detect: detectBody,
        detectBody,
        detectFace(frame: VideoFrame, at: number) {
          context.signal.throwIfAborted()
          if (!face) throw new Error('Face inference unavailable')
          return face.landmarker.detectForVideo(frame, at)
        },
        detectHands(frame: VideoFrame, at: number) {
          context.signal.throwIfAborted()
          if (!gesture) throw new Error('Hand inference unavailable')
          return gesture.recognizer.recognizeForVideo(frame, at)
        },
      }
    },
    async avatars(context): Promise<Pair> {
      const owned = await prepareOwnedAvatarPair(context, {
        load: loadAvatar,
        mirror,
        halfLifeMs,
        maxAgeMs,
        ...(trunk ? { trunk: true } : {}),
        ...(hands ? { hands } : {}),
        ...(reference ? { reference } : {}),
        ...(feedback ? { feedback } : {}),
        ...(head
          ? {
              head: {
                bone: head.bone,
                cameraReference: head.cameraReference,
                sceneFromCamera: head.sceneFromCamera,
              },
            }
          : {}),
      })
      // FR-A-02/NFR-07/08: the factory owns a partial pair until renderer preparation
      // settles. Cancellation cannot publish late ready or lose an unclaimed model.
      if (prepareAvatar) {
        try {
          context.signal.throwIfAborted()
          const models = owned.models
          if (!models) throw new Error('Avatar preparation unavailable')
          await prepareAvatar(models, context)
          context.signal.throwIfAborted()
        } catch (error) {
          try {
            owned.dispose()
          } catch {
            throw new ResourceCleanupError()
          }
          throw error
        }
      }
      if (!reference && !feedback) return owned
      let lastRendered: ReturnType<Pair['render']> | undefined
      let observationToken: object | undefined
      // FR-M-07·FR-S-03/04: the same accepted native delivery feeds the current owner session.
      // No evaluator default, background async classifier, raw logging or fresh stamp synthesis.
      function observe(frame: PoseRigFrame): boolean {
        if (!feedback) return issueCommand(context.generation, () => owned.observe(frame))
        const evaluator = evaluateFeedback
        if (!evaluator) return false
        if (!issueCommand(context.generation, () => true)) return false
        const token = {}
        observationToken = token
        let delivery: PoseRigFrame
        try {
          const image = copyCapturedImage(frame.image)
          delivery = Object.freeze({
            generation: frame.generation,
            sequence: frame.sequence,
            at: frame.at,
            ...(image === undefined ? {} : { image }),
            result: frame.result,
          })
        } catch {
          return issueCommand(context.generation, () => {
            if (observationToken !== token) return false
            throw new Error('Invalid native feedback state')
          })
        }
        if (
          observationToken !== token ||
          !issueCommand(context.generation, () => {
            const accepted = owned.observe(delivery)
            if (accepted && observationToken === token && adaptive) {
              currentObservation = undefined
              pendingCue = undefined
            }
            return accepted
          })
        )
          return false
        try {
          const rejectDecision = () =>
            issueCommand(context.generation, () => {
              if (observationToken !== token) return false
              if (adaptive) owned.suspendReference()
              return true
            })
          const supplied = evaluator(delivery)
          if (supplied === null) return rejectDecision()
          if (typeof (supplied as unknown as PromiseLike<unknown>).then === 'function') {
            void Promise.resolve(supplied).catch(() => {})
            throw new Error()
          }
          const state = supplied.state,
            plan = state.plan
          const cue: Omit<ReferenceCue, 'sequence'> = {
            generation: state.generation,
            at: state.lastNow,
            motionId: plan.motionId,
            version: plan.version,
            stepId: plan.steps[state.stepIndex]?.id ?? '',
            phase: state.phase,
            status: state.status,
          }
          const sequence = state.lastSequence,
            at = state.lastSampledAt,
            observedAt = state.lastObservationAt,
            ageLimit = plan.maxFrameAgeMs
          if (
            cue.generation !== context.generation ||
            delivery.generation !== cue.generation ||
            cue.status !== 'running' ||
            cue.motionId !== feedback.motionId ||
            cue.version !== feedback.version ||
            !cue.stepId ||
            !['waiting-start', 'seeking-target', 'holding', 'waiting-return'].includes(cue.phase) ||
            !Number.isFinite(ageLimit) ||
            ageLimit <= 0 ||
            ageLimit > Number.MAX_SAFE_INTEGER ||
            sequence !== delivery.sequence ||
            at !== delivery.at ||
            observedAt !== cue.at ||
            !Number.isFinite(cue.at) ||
            cue.at < delivery.at ||
            cue.at > Number.MAX_SAFE_INTEGER ||
            cue.at - delivery.at > Math.min(maxAgeMs, ageLimit)
          )
            return rejectDecision()
          const errors = supplied.errors
          if (!Array.isArray(errors) || errors.length > feedback.regions.length) throw new Error()
          const copied = Object.freeze(
            Array.from(errors, (error) => {
              const regionId = error.regionId,
                severity = error.severity,
                code = error.code
              if (
                code !== undefined &&
                (typeof code !== 'string' ||
                  code.trim() !== code ||
                  !code ||
                  code.length > 200 ||
                  Array.from(code).some((c) => c.charCodeAt(0) < 32))
              )
                throw new Error()
              return Object.freeze({ regionId, severity, ...(code !== undefined ? { code } : {}) })
            }),
          )
          return issueCommand(context.generation, () => {
            if (observationToken !== token) return false
            const accepted = owned.updateFeedback(
              Object.freeze({
                generation: cue.generation,
                sequence,
                at: delivery.at,
                motionId: cue.motionId,
                version: cue.version,
                errors: copied,
              }),
            )
            if (accepted && reference) {
              // Exact supplied cause + region + phase, in authored presentation order only.
              const correction = reference.steps
                .find((step) => step.id === cue.stepId)
                ?.corrections?.find(
                  (item) =>
                    item.phases.includes(cue.phase) &&
                    copied.some(
                      (error) => error.code === item.errorCode && error.regionId === item.regionId,
                    ),
                )
              const guide = correction
                ? Object.freeze({ id: correction.id, sampledAt: delivery.at })
                : undefined
              if (adaptive)
                currentObservation = Object.freeze({
                  generation: cue.generation,
                  sequence,
                  sampledAt: delivery.at,
                  stepId: cue.stepId,
                  phase: cue.phase,
                  ...(guide ? { correction: guide } : {}),
                })
              queueReference({ ...cue, ...(guide ? { correction: guide } : {}) })
            } else if (adaptive) owned.suspendReference()
            return true
          })
        } catch {
          return issueCommand(context.generation, () => {
            if (observationToken !== token) return false
            throw new Error('Invalid native feedback state')
          })
        }
      }
      // FR-S-03/04: session clocks may follow the current RAF stamp. Apply only when
      // the original render time reaches the cue; never restamp either input.
      return Object.freeze({
        get models(): Pair['models'] {
          let models: Pair['models'] = null
          issueCommand(context.generation, () => {
            models = owned.models
            return true
          })
          return models
        },
        observe,
        updateReference: (cue) =>
          !adaptive && issueCommand(context.generation, () => owned.updateReference(cue)),
        suspendReference: () => issueCommand(context.generation, () => owned.suspendReference()),
        updateFeedback: (frame) =>
          !feedback && issueCommand(context.generation, () => owned.updateFeedback(frame)),
        render(now: number, deltaMs: number) {
          // FR-U-04: retained renderer handles cannot revive a retired cohort.
          let result: ReturnType<Pair['render']> = Object.freeze({
            status: 'untracked',
            tracked: 0,
            total: lastRendered?.total ?? (trunk ? 9 : 8),
          })
          issueCommand(context.generation, () => {
            const cue = pendingCue
            if (cue && cue.generation === context.generation && cue.at <= now) {
              pendingCue = undefined
              owned.updateReference(cue)
            }
            result = owned.render(now, deltaMs)
            lastRendered = result
            return true
          })
          return result
        },
        dispose() {
          observationToken = undefined
          if (currentObservation?.generation === context.generation) currentObservation = undefined
          if (pendingCue?.generation === context.generation) pendingCue = undefined
          owned.dispose()
        },
      })
    },
    source: (context, camera, inference) =>
      inference.thread === 'worker'
        ? createVideoPoseSource(context, {
            video: camera.video,
            stream: camera.stream,
            detect: inference.detect,
          })
        : hands
          ? createBodyHandVideoSource(context, {
              video: camera.video,
              stream: camera.stream,
              detectBody: inference.detectBody,
              detectHands: inference.detectHands,
              ...(head
                ? { face: { detectFace: inference.detectFace, matrixLayout: head.matrixLayout } }
                : {}),
            })
          : head
            ? createBodyFaceVideoSource(context, {
                video: camera.video,
                stream: camera.stream,
                detectBody: inference.detectBody,
                detectFace: inference.detectFace,
                matrixLayout: head.matrixLayout,
              })
            : createVideoPoseSource(context, {
                video: camera.video,
                stream: camera.stream,
                detect: inference.detect,
              }),
    ...(warmupInference
      ? {
          async prepareSource(source: ReturnType<typeof createVideoPoseSource>) {
            if (!(await source.read())) throw new Error('Native preparation frame unavailable')
          },
        }
      : {}),
    scheduler,
    render,
    onFailure,
  })
  issueCommand = bridge.command
  // FR-S-03/04·FR-U-04: called with the current immutable state from this owner's session.
  // Snapshot before the final authority check; no animation observation/progress synthesis.
  let referenceGeneration = 0,
    sequence = 0,
    lastCueAt = -Infinity
  function synchronize(state: CoachingState): boolean {
    if (!reference) return false
    const expectedObservation = currentObservation
    let generation: number, cue: Omit<ReferenceCue, 'sequence'>
    try {
      generation = state.generation
    } catch {
      return false
    }
    try {
      cue = {
        generation,
        at: state.lastNow,
        motionId: state.plan.motionId,
        version: state.plan.version,
        stepId: state.plan.steps[state.stepIndex]?.id ?? '',
        phase: state.phase,
        status: state.status,
      }
      if (adaptive && cue.status === 'running') {
        const observed = expectedObservation
        if (
          !observed ||
          observed.generation !== generation ||
          observed.sequence !== state.lastSequence ||
          observed.sampledAt !== state.lastSampledAt ||
          observed.stepId !== cue.stepId ||
          observed.phase !== cue.phase
        )
          return false
        const age = state.plan.maxFrameAgeMs
        if (currentObservation !== expectedObservation) return false
        if (
          !Number.isFinite(age) ||
          age <= 0 ||
          !Number.isFinite(cue.at) ||
          cue.at < observed.sampledAt ||
          cue.at - observed.sampledAt > Math.min(maxAgeMs, age, reference.maxAgeMs)
        ) {
          return bridge.command(generation, (pair) => {
            if (currentObservation !== expectedObservation) return false
            pendingCue = undefined
            return pair.suspendReference()
          })
        }
        if (observed.correction) cue = { ...cue, correction: observed.correction }
      }
    } catch {
      return bridge.command(generation, () => {
        if (adaptive && currentObservation !== expectedObservation) return false
        throw new Error('Invalid native reference state')
      })
    }
    if (adaptive && currentObservation !== expectedObservation) return false
    return queueReference(cue)
  }
  function queueReference(cue: Omit<ReferenceCue, 'sequence'>): boolean {
    if (!reference) return false
    const generation = cue.generation
    return bridge.command(generation, () => {
      if (referenceGeneration !== generation) {
        referenceGeneration = generation
        sequence = 0
        lastCueAt = -Infinity
      }
      if (
        !Number.isFinite(cue.at) ||
        cue.at < 0 ||
        cue.at > Number.MAX_SAFE_INTEGER ||
        sequence >= Number.MAX_SAFE_INTEGER
      )
        throw new Error('Invalid native reference state')
      if (cue.at < lastCueAt) return false
      lastCueAt = cue.at
      pendingCue = Object.freeze({ ...cue, sequence: ++sequence })
      return true
    })
  }
  return Object.freeze({
    ports: bridge.ports,
    start: bridge.start,
    synchronize,
    close: () => {
      pendingCue = undefined
      currentObservation = undefined
      return bridge.close()
    },
    getSnapshot: () => Object.freeze({ ...bridge.getSnapshot(), cameraError }),
  })
}
