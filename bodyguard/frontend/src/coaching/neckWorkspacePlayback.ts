// FR-M-01/02/07·FR-S-02/03/04: one owned native cohort for the existing DEV workspace.
import type { ReferenceCommand, ReferenceStage, ReferenceView } from '../avatar/referenceStage'
import { prepareReferenceStage } from '../avatar/referenceStage'
import type { AvatarGender } from '../avatar/reviewAvatarAssets'
import { closeCamera, openCamera } from '../pose/camera'
import { DEFAULT_POSE_MODEL } from '../pose/constants'
import { createVideoPoseSource } from '../pose/videoPoseSource'
import { createWorkerPoseInference } from '../pose/workerInference'
import { copyNeckReviewCriteria, type NeckReviewCriteria } from '../posture/thresholds'
import type { NeckCandidateError } from '../stretch/neckCandidateClassifier'
import type { CoachingState } from '../stretch/progression'
import { createNeckCandidateFeedback } from './neckCandidateFeedback'
import { createOwnedPlaybackResources } from './ownedPlaybackResources'
import { ResourceCleanupError, type ResourceContext } from './resources'
import type { SessionSnapshot } from './session'
import type { PlaybackInput } from './useRecordedPlayback'

export function createNeckWorkspacePlayback(
  input: PlaybackInput,
  options: Readonly<{
    canvas(context: ResourceContext): Promise<HTMLCanvasElement>
    criteria: NeckReviewCriteria
    gender: AvatarGender
    session(): Readonly<{ getSnapshot(): SessionSnapshot }> | null
    view(): ReferenceView
    feedback(error: NeckCandidateError | null): void
  }>,
) {
  if (!import.meta.env.DEV) throw new Error('Candidate workspace unavailable')
  const criteria = copyNeckReviewCriteria(options.criteria)
  let evaluator: ReturnType<typeof createNeckCandidateFeedback> | undefined,
    latest: CoachingState | undefined,
    issue: NeckCandidateError | null = null,
    sampledAt = -Infinity,
    lastKey = '',
    revision = 0,
    closed = false
  const publish = (next: NeckCandidateError | null) => {
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
          motion: 'neck-side',
          onFailure: () =>
            input.onFailure({
              type: 'error',
              generation: context.generation,
              reason: 'asset-error',
            }),
        })
        if (!stage.beginObservation(context.generation)) throw new Error()
        const owned = stage
        evaluator = createNeckCandidateFeedback({
          criteria,
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
            const decision = evaluator?.evaluate(frame)
            if (decision) {
              latest = decision.state
              sampledAt = frame.at
              publish((decision.errors[0]?.code as NeckCandidateError | undefined) ?? null)
            }
            return true
          },
          render(now: number, delta: number) {
            input.tick()
            if (now - sampledAt > criteria.maxFrameAgeMs) publish(null)
            const state = latest,
              step = state?.plan.steps[state.stepIndex]?.id,
              phase =
                issue === 'neck-head-position' || issue === 'neck-shoulder-line'
                  ? 'waiting-start'
                  : (state?.phase ?? 'waiting-start'),
              key = `${step}:${phase}:${issue ?? ''}`
            if (lastKey !== key) {
              lastKey = key
              revision++
            }
            const command: ReferenceCommand = {
              phase,
              stepId: step === 'right' ? 'right' : 'left',
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
