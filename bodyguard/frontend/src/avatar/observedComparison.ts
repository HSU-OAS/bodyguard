// FR-A-01/03·FR-M-02/07: current camera generation drives only the user copy, never a verdict.
import type { Bone, Object3D, Quaternion } from 'three'
import { OBSERVED_LIMB_BINDINGS } from './directionalRig'
import { createHeadRotationRig } from './headOrientationRig'
import { hasSingleDisplayBody, readDetailAlignment } from './observedDetailAlignment'
import { copyHandObservations, createObservedHandRig } from './observedHandRig'
import { createObservedPoseRig, type PoseRigFrame } from './observedPoseRig'
import { OBSERVED_CLAVICLES } from './observedShoulders'
import { OBSERVED_TRUNK_BINDING } from './observedTrunk'

export type ComparisonStatus = 'waiting' | 'tracking' | 'partial' | 'aligned' | 'unavailable'
export type DetailAlignmentTarget = 'head' | 'hands' | 'all'

const MAX_DETAIL_AGE_MS = 1000

export function createObservedComparison(model: Object3D, signal: AbortSignal, mirror = true) {
  const hasClavicles = OBSERVED_CLAVICLES.every((name) => {
    let count = 0
    model.traverse((node) => {
      if (node.name === name && (node as Bone).isBone) count++
    })
    return count === 1
  })
  const rest: { bone: Bone; rotation: Quaternion }[] = []
  model.traverse((node) => {
    if ((node as Bone).isBone) rest.push({ bone: node as Bone, rotation: node.quaternion.clone() })
  })
  const reset = (target: DetailAlignmentTarget = 'all') => {
    for (const { bone, rotation } of rest)
      if (
        target === 'all' ||
        (target === 'head' && bone.name === 'head') ||
        (target === 'hands' && /^(wrist[LR]|finger\d-\d[LR])$/.test(bone.name))
      )
        bone.quaternion.copy(rotation)
    model.updateMatrixWorld(true)
  }
  let body: ReturnType<typeof createObservedPoseRig> | undefined,
    head: ReturnType<typeof createHeadRotationRig> | undefined,
    hands: ReturnType<typeof createObservedHandRig> | undefined,
    generation: number | undefined,
    sequence = 0,
    headSequence: number | undefined,
    headTracking = false,
    handTracking = false,
    closed = false
  const pending: Partial<Record<'head' | 'hands', number>> = {}
  let alignmentRequested = false
  let snapshot: Readonly<{
    status: 'untracked' | 'tracking' | 'partial' | 'closed'
    tracked: number
    total: number
  }> = Object.freeze({ status: 'untracked', tracked: 0, total: 9 })
  model.visible = false
  function suspend() {
    body?.dispose()
    head?.dispose()
    hands?.dispose()
    body = head = hands = undefined
    generation = pending.head = pending.hands = undefined
    sequence = 0
    headSequence = undefined
    headTracking = handTracking = alignmentRequested = false
    snapshot = Object.freeze({ status: 'untracked', tracked: 0, total: 9 })
    model.visible = false
    reset()
  }
  return Object.freeze({
    begin(next: number) {
      if (closed || signal.aborted || !Number.isSafeInteger(next) || next <= 0) return false
      suspend()
      generation = next
      body = createObservedPoseRig(model, {
        context: { generation: next, signal },
        mirror,
        halfLifeMs: 50,
        maxAgeMs: 1000,
        bindings: [...OBSERVED_LIMB_BINDINGS, OBSERVED_TRUNK_BINDING],
        // FR-A-01: natural display — adaptive smoothing, elbow/knee shaping, trunk roll,
        // shrugs after the upright reference, and long-missing limbs easing back to rest.
        natural: true,
        shoulders: hasClavicles,
        relaxAfterMs: 600,
      })
      return true
    },
    observe(frame: PoseRigFrame) {
      if (
        closed ||
        signal.aborted ||
        !body ||
        frame.generation !== generation ||
        frame.sequence <= sequence
      )
        return false
      if (!body.observe(frame)) return false
      sequence = frame.sequence
      headTracking = false
      headSequence = undefined
      const now = performance.now()
      const eligible = (after: number | undefined) =>
        after !== undefined && frame.at >= after && now - after <= MAX_DETAIL_AGE_MS
      const wantsHead = eligible(pending.head),
        wantsHands = eligible(pending.hands)
      if (wantsHead || wantsHands) {
        const aligned = readDetailAlignment(frame, generation, now, MAX_DETAIL_AGE_MS)
        const common = {
          context: { generation, signal },
          mirror,
          halfLifeMs: 50,
          maxAgeMs: MAX_DETAIL_AGE_MS,
        }
        if (wantsHead && aligned?.head) {
          pending.head = undefined
          head?.dispose()
          reset('head')
          try {
            head = createHeadRotationRig(model, { ...common, ...aligned.head })
          } catch {
            head = undefined
          }
        }
        if (wantsHands && aligned?.hands) {
          pending.hands = undefined
          hands?.dispose()
          reset('hands')
          try {
            hands = createObservedHandRig(model, { ...common, ...aligned.hands })
          } catch {
            hands = undefined
          }
        }
      }
      const single = hasSingleDisplayBody(frame)
      const stamp = { generation: frame.generation, sequence: frame.sequence, at: frame.at }
      if (
        head?.push({ ...stamp, rotation: single ? (frame.result.headOrientation ?? null) : null })
      )
        headSequence = frame.sequence
      hands?.push({ ...stamp, hands: single ? copyHandObservations(frame.result.hands) : [] })
      return true
    },
    align(target: DetailAlignmentTarget = 'all') {
      if (closed || signal.aborted || !body) return false
      const now = performance.now()
      if (target !== 'hands') {
        pending.head = now
        headTracking = false
        headSequence = undefined
      }
      if (target !== 'head') {
        pending.hands = now
        handTracking = false
      }
      // Front alignment also means "standing upright now": remove the camera/depth tilt.
      if (target !== 'hands') body.calibrateUpright()
      alignmentRequested = true
      return true
    },
    render(now: number, delta: number) {
      if (closed || signal.aborted || !body) {
        model.visible = false
        return 'waiting' as const
      }
      const state = body.render(now, delta)
      snapshot = Object.freeze({ status: state.status, tracked: state.tracked, total: state.total })
      for (const target of ['head', 'hands'] as const) {
        const after = pending[target]
        if (after !== undefined && now - after > MAX_DETAIL_AGE_MS) pending[target] = undefined
      }
      headTracking =
        head?.render(now, delta).status === 'tracking' &&
        headSequence === sequence &&
        pending.head === undefined
      handTracking = (hands?.render(now, delta).tracked ?? 0) > 0 && pending.hands === undefined
      model.visible = state.status === 'tracking' || state.status === 'partial'
      if (!model.visible) return 'waiting' as const
      if (pending.head === undefined && pending.hands === undefined) {
        if (head && hands) return 'aligned' as const
        if (alignmentRequested && !head && !hands) return 'unavailable' as const
      }
      return state.status === 'partial' ? ('partial' as const) : ('tracking' as const)
    },
    suspend,
    getSnapshot: () => snapshot,
    getDetailStatus: () => ({
      handsPending: pending.hands !== undefined,
      handTracking,
      upright: body?.getUprightCalibration() ?? ('none' as const),
    }),
    getCoverage() {
      const coverage = body?.getCoverage()
      return !closed && !signal.aborted && model.visible && coverage
        ? Object.freeze({ ...coverage, headTracking })
        : null
    },
    dispose() {
      if (!closed) {
        closed = true
        suspend()
      }
    },
  })
}
