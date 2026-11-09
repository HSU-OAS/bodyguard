// FR-A-01/03·FR-M-07: calibrated projected display, NOT measured clavicle rotation.
import { type Bone, Matrix4, type Object3D, Vector3 } from 'three'
import type { ResourceContext } from '../coaching/resources'
import { observeShoulderShrug } from '../posture/shoulderShrugObservation'
import { copyShrugReviewCriteria, type ShrugReviewCriteria } from '../posture/thresholds'
import { createShrugCandidateClassifier } from '../stretch/shrugCandidateClassifier'
import type { PoseRigFrame } from './observedPoseRig'

export const PROJECTED_SHOULDER_BINDINGS = Object.freeze([
  Object.freeze({ bone: 'clavicleL', anchor: 'upperarm01L' }),
  Object.freeze({ bone: 'clavicleR', anchor: 'upperarm01R' }),
])
export function createObservedShoulderElevation(
  model: Object3D,
  context: ResourceContext,
  supplied: ShrugReviewCriteria,
  mirror: boolean,
) {
  const criteria = copyShrugReviewCriteria(supplied),
    classifier = createShrugCandidateClassifier(criteria, context.generation),
    invalid = () => new Error('Projected shoulder display unavailable')
  const nodes = new Map<string, Bone[]>()
  model.traverse((n) => {
    if ((n as Bone).isBone) {
      const list = nodes.get(n.name) ?? []
      list.push(n as Bone)
      nodes.set(n.name, list)
    }
  })
  const exact = (name: string) => {
    const list = nodes.get(name)
    if (list?.length !== 1) throw invalid()
    return list[0]
  }
  if (typeof mirror !== 'boolean' || context.signal.aborted) throw invalid()
  model.updateWorldMatrix(true, true)
  const inverse = new Matrix4().copy(model.matrixWorld)
  if (!inverse.elements.every(Number.isFinite) || inverse.determinant() === 0) throw invalid()
  inverse.invert()
  const point = (name: string) => exact(name).getWorldPosition(new Vector3()).applyMatrix4(inverse)
  const hipWidth = Math.abs(point('upperleg01L').x - point('upperleg01R').x)
  const rest = PROJECTED_SHOULDER_BINDINGS.map(({ bone, anchor }) => ({
    bone,
    value: point(anchor).sub(point(bone)),
  }))
  if (
    !(hipWidth > 0) ||
    !Number.isFinite(hipWidth) ||
    rest.some((r) => !r.value.toArray().every(Number.isFinite) || r.value.x === 0)
  )
    throw invalid()
  let baseline: readonly number[] | undefined,
    after: number | undefined,
    closed = false,
    sequence = -1,
    token: object | undefined
  const empty = () => Object.freeze({}) as Readonly<Record<string, readonly number[]>>
  return Object.freeze({
    align(now: number) {
      if (closed || context.signal.aborted || !Number.isFinite(now) || now < 0) return false
      baseline = undefined
      token = {}
      after = now
      return true
    },
    observe(frame: PoseRigFrame, now: number): Readonly<Record<string, readonly number[]>> {
      const before = token
      let own: object | undefined
      try {
        const stamp = { generation: frame.generation, sequence: frame.sequence, at: frame.at }
        if (
          closed ||
          context.signal.aborted ||
          token !== before ||
          stamp.generation !== context.generation ||
          !Number.isSafeInteger(stamp.sequence) ||
          stamp.sequence <= sequence
        )
          return empty()
        own = {}
        token = own
        sequence = stamp.sequence
        const copied = { ...stamp, image: frame.image, result: frame.result }
        const decision = classifier.classify(copied, now, {
          stepId: 'both',
          phase: 'waiting-start',
        })
        const observed = observeShoulderShrug({
          frame: copied,
          now,
          minimumConfidence: criteria.minimumConfidence,
          maxAgeMs: criteria.maxFrameAgeMs,
        })
        if (
          closed ||
          context.signal.aborted ||
          own !== token ||
          !decision ||
          observed.status !== 'available'
        )
          return empty()
        const heights = [
          observed.leftShoulderHeightHipWidths,
          observed.rightShoulderHeightHipWidths,
        ]
        if (after !== undefined && stamp.at >= after && decision.classification === 'start') {
          baseline = Object.freeze(heights)
          after = undefined
        }
        if (!baseline) return empty()
        const directions: Record<string, readonly number[]> = {},
          angle = (mirror ? -1 : 1) * observed.hipImageAngleRad
        for (let i = 0; i < rest.length; i++) {
          const { bone, value } = rest[i],
            y = value.y + (heights[i] - baseline[i]) * hipWidth,
            side = value.x * value.x + value.y * value.y - y * y
          // Never clamp an impossible target into a valid-looking shoulder pose.
          if (!(side > 0) || !Number.isFinite(side)) return empty()
          const x = Math.sign(value.x) * Math.sqrt(side),
            direction = [
              x * Math.cos(angle) - y * Math.sin(angle),
              x * Math.sin(angle) + y * Math.cos(angle),
              value.z,
            ]
          if (!direction.every(Number.isFinite)) return empty()
          directions[bone] = Object.freeze(direction)
        }
        return Object.freeze(directions)
      } catch {
        if (own === token) {
          closed = true
          baseline = undefined
          classifier.close()
        }
        return empty()
      }
    },
    close() {
      closed = true
      token = undefined
      baseline = undefined
      after = undefined
      classifier.close()
    },
  })
}
