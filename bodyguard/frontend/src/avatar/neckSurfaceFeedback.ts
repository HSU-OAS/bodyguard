// FR-A-01/03·FR-M-07: projected error regions, never individual cervical/clavicle measurements.
import type { Object3D } from 'three'
import type { ResourceContext } from '../coaching/resources'
import { observeCapturedNeckSide } from '../posture/neckSideObservation'
import { observeShoulderShrug } from '../posture/shoulderShrugObservation'
import {
  copyNeckReviewCriteria,
  copyShrugReviewCriteria,
  type NeckReviewCriteria,
  type ShrugReviewCriteria,
} from '../posture/thresholds'
import type { createObservedComparison } from './observedComparison'
import type { PoseRigFrame } from './observedPoseRig'
import { OBSERVED_TRUNK_BINDING } from './observedTrunk'
import { PROJECTED_SURFACE_REGIONS } from './projectedSurfaceRegions'
import { createSurfaceFeedback, type FeedbackFrame } from './surfaceFeedback'

type Coverage = ReturnType<ReturnType<typeof createObservedComparison>['getCoverage']>
export function createNeckSurfaceFeedback(
  model: Object3D,
  context: ResourceContext,
  supplied: NeckReviewCriteria | ShrugReviewCriteria,
  motion: 'neck-side' | 'shoulder-shrug' = 'neck-side',
) {
  if (motion !== 'neck-side' && motion !== 'shoulder-shrug')
    throw new Error('Invalid avatar feedback')
  const criteria =
      motion === 'shoulder-shrug'
        ? copyShrugReviewCriteria(supplied as ShrugReviewCriteria)
        : copyNeckReviewCriteria(supplied as NeckReviewCriteria),
    program = Object.freeze({
      motionId: motion,
      version: criteria.version,
      regions: [
        {
          id: 'head-position',
          bones: PROJECTED_SURFACE_REGIONS['neck-head-line'],
          projection: 'neck-head-line' as const,
        },
        {
          id: 'shoulder-line',
          bones: PROJECTED_SURFACE_REGIONS['shoulder-line'],
          projection: 'shoulder-line' as const,
        },
        ...(motion === 'shoulder-shrug'
          ? [{ id: 'trunk', bones: [OBSERVED_TRUNK_BINDING.bone] }]
          : []),
      ],
    }),
    surface = createSurfaceFeedback(model, { context, program, maxAgeMs: criteria.maxFrameAgeMs })
  let stamp:
      | Readonly<{ generation: number; sequence: number; at: number; available: boolean }>
      | undefined,
    decision: FeedbackFrame | undefined,
    applied: FeedbackFrame | undefined,
    appliedKey = '',
    lastUpdate = -1,
    observationToken: object | undefined,
    updateToken: object | undefined,
    closed = false
  const clear = () => {
    updateToken = undefined
    decision = undefined
    applied = undefined
    appliedKey = ''
    surface.observe(null)
  }
  return Object.freeze({
    observe(frame: PoseRigFrame) {
      if (closed || context.signal.aborted) return
      let token = observationToken
      const before = observationToken
      try {
        const next = { generation: frame.generation, sequence: frame.sequence, at: frame.at }
        if (
          next.generation !== context.generation ||
          !Number.isSafeInteger(next.sequence) ||
          next.sequence <= (stamp?.sequence ?? -1)
        )
          return
        if (observationToken !== before || closed || context.signal.aborted) return
        token = {}
        observationToken = token
        stamp = Object.freeze({ ...next, available: false })
        decision = undefined
        const observe = motion === 'shoulder-shrug' ? observeShoulderShrug : observeCapturedNeckSide
        const projection = observe({
          frame: { ...next, image: frame.image, result: frame.result },
          now: performance.now(),
          minimumConfidence: criteria.minimumConfidence,
          maxAgeMs: criteria.maxFrameAgeMs,
        })
        if (closed || context.signal.aborted || observationToken !== token) return
        stamp = Object.freeze({ ...next, available: projection.status === 'available' })
        if (!stamp.available) clear()
      } catch {
        if (observationToken === token) {
          stamp = undefined
          clear()
        }
      }
    },
    update(frame: FeedbackFrame) {
      if (closed || context.signal.aborted || !stamp?.available) return false
      const current = stamp
      try {
        const { generation, sequence, at, motionId, version } = frame
        if (
          generation !== context.generation ||
          sequence !== current.sequence ||
          sequence <= lastUpdate ||
          at !== current.at ||
          motionId !== motion ||
          version !== criteria.version
        )
          return false
        lastUpdate = sequence
        const token = {}
        updateToken = token
        const requested = frame.errors
        if (!Array.isArray(requested) || requested.length > (motion === 'shoulder-shrug' ? 3 : 2))
          throw new Error()
        const seen = new Set<string>(),
          errors = Array.from(requested, (error) => {
            const { regionId, severity, code } = error
            if (
              seen.has(regionId) ||
              severity !== 'deviation' ||
              (motion === 'shoulder-shrug'
                ? !(regionId === 'head-position'
                    ? code === 'shrug-head'
                    : regionId === 'trunk'
                      ? code === 'shrug-trunk'
                      : regionId === 'shoulder-line' &&
                        ['shrug-arms', 'shrug-asymmetry', 'shrug-range'].includes(code ?? ''))
                : regionId === 'shoulder-line'
                  ? code !== 'neck-shoulder-line'
                  : regionId !== 'head-position' ||
                    !['neck-head-position', 'neck-wrong-direction', 'neck-range'].includes(
                      code ?? '',
                    ))
            )
              throw new Error()
            seen.add(regionId)
            return Object.freeze({ regionId, severity, code })
          })
        if (closed || context.signal.aborted || stamp !== current || updateToken !== token)
          return false
        decision = Object.freeze({
          generation,
          sequence,
          at,
          motionId,
          version,
          errors: Object.freeze(errors),
        })
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
        now - current.at > criteria.maxFrameAgeMs
      ) {
        clear()
        return surface.render(now, false)
      }
      const shoulderTracking =
        motion === 'neck-side' || coverage.projectedRegions?.includes('shoulder-line') === true
      const key = `${current.sequence}:${coverage.headTracking}:${shoulderTracking}`
      if (accepted !== applied || key !== appliedKey) {
        const wasSameFrame = applied?.sequence === current.sequence
        applied = accepted
        appliedKey = key
        const projectedRegions = [
          ...(coverage.headTracking ? ['neck-head-line' as const] : []),
          ...(shoulderTracking ? ['shoulder-line' as const] : []),
        ]
        // Same-frame loss may revoke colour, never re-consume an old decision to add evidence.
        if (wasSameFrame) surface.observe(null)
        else {
          surface.observe(Object.freeze({ ...coverage, projectedRegions }), true)
          if (accepted)
            surface.update({
              ...accepted,
              errors: accepted.errors.filter(
                (error) =>
                  (error.regionId !== 'head-position' || coverage.headTracking) &&
                  (error.regionId !== 'shoulder-line' || shoulderTracking),
              ),
            })
        }
      }
      return surface.render(now)
    },
    clear,
    dispose() {
      closed = true
      observationToken = updateToken = undefined
      stamp = decision = applied = undefined
      surface.dispose()
    },
  })
}
