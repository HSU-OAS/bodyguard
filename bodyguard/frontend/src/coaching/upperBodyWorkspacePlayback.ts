// FR-M-01/02/07·FR-S-02/03/04: one owned camera/inference/avatar cohort for the DEV
// shoulder-shrug and arm-overhead demo runs. Mirrors the neck workspace playback.
import type { CandidateFeedbackSpec } from '../avatar/candidateSurfaceFeedback'
import { PROJECTED_SURFACE_REGIONS } from '../avatar/projectedSurfaceRegions'
import type { ReferenceCommand, ReferenceStage, ReferenceView } from '../avatar/referenceStage'
import { prepareReferenceStage } from '../avatar/referenceStage'
import type { AvatarGender } from '../avatar/reviewAvatarAssets'
import { closeCamera, openCamera } from '../pose/camera'
import { DEFAULT_POSE_MODEL } from '../pose/constants'
import { createVideoPoseSource } from '../pose/videoPoseSource'
import { createWorkerPoseInference } from '../pose/workerInference'
import type { CoachingState } from '../stretch/progression'
import { createOverheadCandidateFeedback } from './overheadCandidateFeedback'
import { createOwnedPlaybackResources } from './ownedPlaybackResources'
import { ResourceCleanupError, type ResourceContext } from './resources'
import type { SessionSnapshot } from './session'
import { createShrugCandidateFeedback } from './shrugCandidateFeedback'
import {
  createCalibratedCandidateFeedback,
  OVERHEAD_DEMO_VERSION,
  overheadDemoCriteria,
  SHRUG_DEMO_VERSION,
  shrugDemoCriteria,
  UPPER_BODY_DEMO_FRAME_MS,
} from './upperBodyDemo'
import type { PlaybackInput } from './useRecordedPlayback'

export type UpperBodyMotion = 'shoulder-shrug' | 'arm-overhead'
// Shown while the upright baseline is measured; not a classifier error.
export const CALIBRATING = 'calibrating'

const head = {
  id: 'head-position',
  bones: PROJECTED_SURFACE_REGIONS['neck-head-line'],
  projection: 'neck-head-line' as const,
}
const trunk = { id: 'trunk', bones: ['spine05'] }
export const UPPER_BODY_FEEDBACK: Readonly<Record<UpperBodyMotion, CandidateFeedbackSpec>> =
  Object.freeze({
    'shoulder-shrug': Object.freeze({
      motionId: 'shoulder-shrug',
      version: SHRUG_DEMO_VERSION,
      maxFrameAgeMs: UPPER_BODY_DEMO_FRAME_MS,
      regions: Object.freeze([
        {
          id: 'shoulder-line',
          bones: PROJECTED_SURFACE_REGIONS['shoulder-line'],
          projection: 'shoulder-line' as const,
        },
        head,
        trunk,
        // Upper arms belong to the shoulder-line mask; forearms show arms lifted from the side.
        { id: 'arms', bones: ['lowerarm01L', 'lowerarm01R'] },
      ]),
    }),
    'arm-overhead': Object.freeze({
      motionId: 'arm-overhead',
      version: OVERHEAD_DEMO_VERSION,
      maxFrameAgeMs: UPPER_BODY_DEMO_FRAME_MS,
      regions: Object.freeze([
        head,
        trunk,
        { id: 'arm-left', bones: ['upperarm01L', 'lowerarm01L'] },
        { id: 'arm-right', bones: ['upperarm01R', 'lowerarm01R'] },
      ]),
    }),
  })
const armRegions = (active: 'left' | 'right') => {
  const other = active === 'left' ? 'right' : 'left'
  return Object.freeze({
    'overhead-head': 'head-position',
    'overhead-trunk': 'trunk',
    'overhead-other-arm': `arm-${other}`,
    'overhead-elbow': `arm-${active}`,
    'overhead-range': `arm-${active}`,
  })
}

export function createUpperBodyWorkspacePlayback(
  input: PlaybackInput,
  options: Readonly<{
    motion: UpperBodyMotion
    canvas(context: ResourceContext): Promise<HTMLCanvasElement>
    gender: AvatarGender
    session(): Readonly<{ getSnapshot(): SessionSnapshot }> | null
    view(): ReferenceView
    feedback(code: string | null): void
  }>,
) {
  if (!import.meta.env.DEV) throw new Error('Candidate workspace unavailable')
  const { motion } = options
  const spec = UPPER_BODY_FEEDBACK[motion]
  if (!spec) throw new Error('Candidate workspace unavailable')
  let evaluator: ReturnType<typeof createCalibratedCandidateFeedback> | undefined,
    latest: CoachingState | undefined,
    issue: string | null = null,
    sampledAt = -Infinity,
    lastKey = '',
    revision = 0,
    closed = false
  const publish = (next: string | null) => {
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
        hands: false,
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
          feedbackProgram: spec,
          onFailure: () =>
            input.onFailure({
              type: 'error',
              generation: context.generation,
              reason: 'asset-error',
            }),
        })
        if (!stage.beginObservation(context.generation)) throw new Error()
        const owned = stage
        const session = {
          getSnapshot() {
            const current = options.session()
            if (!current) throw new Error()
            return current.getSnapshot()
          },
        }
        const shared = {
          generation: context.generation,
          now: () => performance.now(),
          session,
          observe: input.observe,
        }
        evaluator =
          motion === 'shoulder-shrug'
            ? createCalibratedCandidateFeedback({
                ...shared,
                motionId: motion,
                build: shrugDemoCriteria,
                create: (criteria) =>
                  createShrugCandidateFeedback({
                    ...shared,
                    criteria,
                    regions: {
                      'shrug-head': 'head-position',
                      'shrug-trunk': 'trunk',
                      'shrug-arms': 'arms',
                      'shrug-asymmetry': 'shoulder-line',
                      'shrug-range': 'shoulder-line',
                    },
                  }),
                // FR-A-01/03: the measured upright pose is also the head display reference.
                onCalibrated: () => owned.alignObservation('head'),
              })
            : createCalibratedCandidateFeedback({
                ...shared,
                motionId: motion,
                build: overheadDemoCriteria,
                create: (criteria) =>
                  createOverheadCandidateFeedback({
                    ...shared,
                    criteria,
                    regions: { left: armRegions('left'), right: armRegions('right') },
                  }),
                onCalibrated: () => owned.alignObservation('head'),
              })
        return {
          align: owned.alignObservation,
          observe(frame: Parameters<ReferenceStage['observe']>[0]) {
            if (!owned.observe(frame)) return false
            const current = evaluator
            const decision = current?.evaluate(frame)
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
              publish(current?.calibrating() ? CALIBRATING : (decision.errors[0]?.code ?? null))
            }
            return true
          },
          render(now: number, delta: number) {
            input.tick()
            if (now - sampledAt > UPPER_BODY_DEMO_FRAME_MS) publish(null)
            const state = latest,
              step = state?.plan.steps[state.stepIndex]?.id,
              phase = state?.phase ?? 'waiting-start',
              key = `${step}:${phase}`
            if (lastKey !== key) {
              lastKey = key
              revision++
            }
            const command: ReferenceCommand = {
              phase,
              stepId: step === 'right' ? 'right' : step === 'left' ? 'left' : 'both',
              playing: state?.status === 'running' && now - sampledAt <= UPPER_BODY_DEMO_FRAME_MS,
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
