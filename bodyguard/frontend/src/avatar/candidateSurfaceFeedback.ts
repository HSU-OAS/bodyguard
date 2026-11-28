// FR-A-01/03·FR-M-07: avatar colour for supplied candidate errors of one motion program.
// Same contract as the neck display: colour only the current same-frame decision, drop it with
// the frame, and show head regions only while the head display is tracking.
import type { Object3D } from 'three'
import type { ResourceContext } from '../coaching/resources'
import type { createObservedComparison } from './observedComparison'
import { hasSingleDisplayBody } from './observedDetailAlignment'
import type { PoseRigFrame } from './observedPoseRig'
import { createSurfaceFeedback, type FeedbackFrame, type FeedbackProgram } from './surfaceFeedback'

type Coverage = ReturnType<ReturnType<typeof createObservedComparison>['getCoverage']>
export type CandidateFeedbackSpec = Readonly<{
  motionId: string
  version: string
  maxFrameAgeMs: number
  regions: FeedbackProgram['regions']
}>

export function createCandidateSurfaceFeedback(
  model: Object3D,
  context: ResourceContext,
  spec: CandidateFeedbackSpec,
) {
  const { motionId, version, maxFrameAgeMs } = spec
  if (!Number.isFinite(maxFrameAgeMs) || maxFrameAgeMs <= 0)
    throw new Error('Invalid candidate feedback')
  const surface = createSurfaceFeedback(model, {
      context,
      program: { motionId, version, regions: spec.regions },
      maxAgeMs: maxFrameAgeMs,
    }),
    regionIds = new Set(spec.regions.map((region) => region.id)),
    headRegions = new Set(
      spec.regions
        .filter((region) => region.projection === 'neck-head-line')
        .map((region) => region.id),
    )
  let stamp:
      | Readonly<{ generation: number; sequence: number; at: number; available: boolean }>
      | undefined,
    decision: FeedbackFrame | undefined,
    applied: FeedbackFrame | undefined,
    appliedKey = '',
    lastUpdate = -1,
    closed = false
  const clear = () => {
    decision = undefined
    applied = undefined
    appliedKey = ''
    surface.observe(null)
  }
  return Object.freeze({
    observe(frame: PoseRigFrame) {
      if (closed || context.signal.aborted) return
      try {
        if (
          frame.generation !== context.generation ||
          !Number.isSafeInteger(frame.sequence) ||
          frame.sequence <= (stamp?.sequence ?? -1)
        )
          return
        stamp = Object.freeze({
          generation: frame.generation,
          sequence: frame.sequence,
          at: frame.at,
          available: hasSingleDisplayBody(frame),
        })
        decision = undefined
        if (!stamp.available) clear()
      } catch {
        stamp = undefined
        clear()
      }
    },
    update(frame: FeedbackFrame) {
      const current = stamp
      if (closed || context.signal.aborted || !current?.available) return false
      try {
        if (
          frame.generation !== context.generation ||
          frame.sequence !== current.sequence ||
          frame.sequence <= lastUpdate ||
          frame.at !== current.at ||
          frame.motionId !== motionId ||
          frame.version !== version ||
          !Array.isArray(frame.errors) ||
          frame.errors.length > regionIds.size
        )
          return false
        lastUpdate = frame.sequence
        const seen = new Set<string>()
        const errors = Array.from(frame.errors, ({ regionId, severity, code }) => {
          if (!regionIds.has(regionId) || seen.has(regionId) || severity !== 'deviation')
            throw new Error()
          seen.add(regionId)
          return Object.freeze({ regionId, severity, code })
        })
        decision = Object.freeze({ ...frame, errors: Object.freeze(errors) })
        return true
      } catch {
        if (stamp === current) clear()
        return false
      }
    },
    render(now: number, coverage: Coverage) {
      const current = stamp,
        accepted = decision
      if (
        closed ||
        context.signal.aborted ||
        !current?.available ||
        !coverage ||
        coverage.generation !== current.generation ||
        coverage.sequence !== current.sequence ||
        coverage.at !== current.at ||
        !Number.isFinite(now) ||
        now < current.at ||
        now - current.at > maxFrameAgeMs
      ) {
        clear()
        return surface.render(now, false)
      }
      const key = `${current.sequence}:${coverage.headTracking}`
      if (accepted !== applied || key !== appliedKey) {
        const sameFrame = applied?.sequence === current.sequence
        applied = accepted
        appliedKey = key
        const projectedRegions = coverage.headTracking
          ? (['neck-head-line', 'shoulder-line'] as const)
          : (['shoulder-line'] as const)
        // Same-frame loss may revoke colour, never re-consume an old decision to add evidence.
        if (sameFrame) surface.observe(null)
        else {
          surface.observe(Object.freeze({ ...coverage, projectedRegions }), true)
          if (accepted)
            surface.update({
              ...accepted,
              errors: accepted.errors.filter(
                (error) => !headRegions.has(error.regionId) || coverage.headTracking,
              ),
            })
        }
      }
      return surface.render(now)
    },
    clear,
    dispose() {
      closed = true
      stamp = decision = applied = undefined
      surface.dispose()
    },
  })
}
