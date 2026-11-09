// FR-M-01/02/07·FR-S-02/03/04: one owned native cohort for the existing DEV workspace.
import type { ReferenceCommand, ReferenceStage, ReferenceView } from '../avatar/referenceStage'
import { prepareReferenceStage } from '../avatar/referenceStage'
import type { AvatarGender } from '../avatar/reviewAvatarAssets'
import { closeCamera, openCamera } from '../pose/camera'
import { DEFAULT_POSE_MODEL } from '../pose/constants'
import { createVideoPoseSource } from '../pose/videoPoseSource'
import { createWorkerPoseInference } from '../pose/workerInference'
import {
  copyNeckReviewCriteria,
  copyShrugReviewCriteria,
  type NeckReviewCriteria,
  type ShrugReviewCriteria,
} from '../posture/thresholds'
import type { NeckCandidateError } from '../stretch/neckCandidateClassifier'
import type { CoachingState } from '../stretch/progression'
import type { ShrugCandidateError } from '../stretch/shrugCandidateClassifier'
import { createNeckCandidateFeedback } from './neckCandidateFeedback'
import { createOwnedPlaybackResources } from './ownedPlaybackResources'
import { ResourceCleanupError, type ResourceContext } from './resources'
import type { SessionSnapshot } from './session'
import { createShrugCandidateFeedback } from './shrugCandidateFeedback'
import type { PlaybackInput } from './useRecordedPlayback'

export function createNeckWorkspacePlayback(
  input: PlaybackInput,
  options: Readonly<{
    canvas(context: ResourceContext): Promise<HTMLCanvasElement>
    criteria: NeckReviewCriteria | ShrugReviewCriteria
    motion?: 'neck-side' | 'shoulder-shrug'
    gender: AvatarGender
    session(): Readonly<{ getSnapshot(): SessionSnapshot }> | null
    view(): ReferenceView
    feedback(error: NeckCandidateError | ShrugCandidateError | null): void
  }>,
) {
  if (!import.meta.env.DEV) throw new Error('Candidate workspace unavailable')
  const motion = options.motion ?? 'neck-side'
  if (motion !== 'neck-side' && motion !== 'shoulder-shrug')
    throw new Error('Candidate workspace unavailable')
  const criteria =
    motion === 'shoulder-shrug'
      ? copyShrugReviewCriteria(options.criteria as ShrugReviewCriteria)
      : copyNeckReviewCriteria(options.criteria as NeckReviewCriteria)
  let evaluator:
      | ReturnType<typeof createNeckCandidateFeedback>
      | ReturnType<typeof createShrugCandidateFeedback>
      | undefined,
    latest: CoachingState | undefined,
    issue: NeckCandidateError | ShrugCandidateError | null = null,
    sampledAt = -Infinity,
    lastKey = '',
    revision = 0,
    closed = false
  const publish = (next: NeckCandidateError | ShrugCandidateError | null) => {
    if (next !== issue) {
      issue = next
      options.feedback(next)
    }
  }
  const bridge = createOwnedPlaybackResources({
    async camera(context) {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      try {
        const stream = await openCamera(video, context.signal)
        return {
          video,
          stream,
          dispose: () => {
            try {
              closeCamera(video, stream)
            } finally {
              video.remove()
            }
          },
        }
      } catch (error) {
        video.remove()
        if (error instanceof ResourceCleanupError) throw error
        throw new Error('Camera unavailable')
      }
    },
    inference: (context) =>
      createWorkerPoseInference(context, {
        model: DEFAULT_POSE_MODEL,
        face: true,
        hands: true,
        matrixLayout: 'column-major',
      }),
    async avatars(context: ResourceContext) {
      evaluator?.close()
      evaluator = undefined
      latest = undefined
      sampledAt = -Infinity
      lastKey = ''
      publish(null)
      let stage: ReferenceStage | undefined
      try {
        const canvas = await options.canvas(context)
        context.signal.throwIfAborted()
        stage = await prepareReferenceStage(context, {
          canvas,
          gender: options.gender,
          motion,
          feedback: criteria,
          onFailure: () =>
            input.onFailure({
              type: 'error',
              generation: context.generation,
              reason: 'asset-error',
            }),
        })
        if (!stage.beginObservation(context.generation)) throw new Error()
        if (motion === 'shoulder-shrug' && !stage.alignObservation()) throw new Error()
        const owned = stage
        const common = {
          generation: context.generation,
          now: () => performance.now(),
          session: {
            getSnapshot() {
              const session = options.session()
              if (!session) throw new Error()
              return session.getSnapshot()
            },
          },
          observe: input.observe,
        }
        evaluator =
          motion === 'shoulder-shrug'
            ? createShrugCandidateFeedback({
                ...common,
                criteria: criteria as ShrugReviewCriteria,
                regions: {
                  'shrug-head': 'head-position',
                  'shrug-trunk': 'trunk',
                  'shrug-arms': 'shoulder-line',
                  'shrug-asymmetry': 'shoulder-line',
                  'shrug-range': 'shoulder-line',
                },
              })
            : createNeckCandidateFeedback({
                ...common,
                criteria: criteria as NeckReviewCriteria,
                regions: {
                  'neck-shoulder-line': 'shoulder-line',
                  'neck-head-position': 'head-position',
                  'neck-wrong-direction': 'head-position',
                  'neck-range': 'head-position',
                },
              })
        return {
          align: owned.alignObservation,
          observe(frame: Parameters<ReferenceStage['observe']>[0]) {
            if (!owned.observe(frame)) return false
            const coverage = motion === 'shoulder-shrug' ? owned.getObservationCoverage() : null
            const shoulderDisplay =
              coverage?.generation === frame.generation &&
              coverage.sequence === frame.sequence &&
              coverage.at === frame.at &&
              coverage.projectedRegions?.includes('shoulder-line') === true
            const decision = evaluator?.evaluate(frame, motion === 'neck-side' || shoulderDisplay)
            if (decision) {
              latest = decision.state
              sampledAt = frame.at
              owned.updateFeedback({
                generation: frame.generation,
                sequence: frame.sequence,
                at: frame.at,
                motionId: decision.state.plan.motionId,
                version: decision.state.plan.version,
                errors: decision.errors,
              })
              publish(
                (decision.errors[0]?.code as
                  | NeckCandidateError
                  | ShrugCandidateError
                  | undefined) ?? null,
              )
            }
            return true
          },
          render(now: number, delta: number) {
            input.tick()
            if (now - sampledAt > criteria.maxFrameAgeMs) publish(null)
            const state = latest,
              step = state?.plan.steps[state.stepIndex]?.id,
              phase =
                issue === 'neck-head-position' ||
                issue === 'neck-shoulder-line' ||
                issue === 'shrug-head' ||
                issue === 'shrug-trunk' ||
                issue === 'shrug-arms'
                  ? 'waiting-start'
                  : (state?.phase ?? 'waiting-start'),
              key = `${step}:${phase}:${issue ?? ''}`
            if (lastKey !== key) {
              lastKey = key
              revision++
            }
            const command: ReferenceCommand = {
              phase,
              stepId: motion === 'shoulder-shrug' ? 'both' : step === 'right' ? 'right' : 'left',
              playing: state?.status === 'running' && now - sampledAt <= criteria.maxFrameAgeMs,
              revision,
              view: options.view(),
            }
            return (
              owned.render(now, delta, command) ?? {
                status: 'untracked' as const,
                tracked: 0,
                total: 9,
              }
            )
          },
          dispose() {
            evaluator?.close()
            evaluator = undefined
            latest = undefined
            owned.dispose()
          },
        }
      } catch (error) {
        stage?.dispose()
        throw error
      }
    },
    source: (context, camera, inference) =>
      createVideoPoseSource(context, {
        video: camera.video,
        stream: camera.stream,
        detect: inference.detect,
      }),
    // FR-M-07/NFR-07: discard the cold frame before GPU models; no observation or progress.
    prepareSourceBeforeAvatars: true,
    async prepareSource(source) {
      if (!(await source.read())) throw new Error('Native preparation frame unavailable')
    },
    // Actual callback time is used for display/expiry, never to restamp captured input.
    scheduler: {
      request: (tick) => requestAnimationFrame(() => tick(performance.now())),
      cancel: (handle) => cancelAnimationFrame(handle),
    },
    render() {},
    onFailure: input.onFailure,
  })
  return Object.freeze({
    ports: bridge.ports,
    start: bridge.start,
    align: () => (latest ? bridge.command(latest.generation, (pair) => pair.align()) : false),
    synchronize(state: CoachingState) {
      if (closed || options.session()?.getSnapshot().state !== state) return false
      latest = state
      return true
    },
    async close() {
      closed = true
      evaluator?.close()
      latest = undefined
      await bridge.close()
    },
  })
}
