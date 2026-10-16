// FR-A-01/03·FR-M-02/07: current camera generation drives only the user copy, never a verdict.
import type { Bone, Object3D, Quaternion } from 'three'
import type { ShrugReviewCriteria } from '../posture/thresholds'
import { OBSERVED_LIMB_BINDINGS } from './directionalRig'
import { createHeadRotationRig } from './headOrientationRig'
import { hasSingleDisplayBody, readDetailAlignment } from './observedDetailAlignment'
import { copyHandObservations, createObservedHandRig } from './observedHandRig'
import { createObservedPoseRig, type PoseRigFrame } from './observedPoseRig'
import { OBSERVED_TRUNK_BINDING } from './observedTrunk'

export type ComparisonStatus = 'waiting' | 'tracking' | 'partial' | 'aligned' | 'unavailable'
export function createObservedComparison(
  model: Object3D,
  signal: AbortSignal,
  shoulders?: ShrugReviewCriteria,
) {
  const rest: { bone: Bone; rotation: Quaternion }[] = []
  model.traverse((node) => {
    if ((node as Bone).isBone) rest.push({ bone: node as Bone, rotation: node.quaternion.clone() })
  })
  const reset = (detailsOnly = false) => {
    for (const { bone, rotation } of rest)
      if (!detailsOnly || /^(head|wrist[LR]|finger\d-\d[LR])$/.test(bone.name))
        bone.quaternion.copy(rotation)
    model.updateMatrixWorld(true)
  }
  let body: ReturnType<typeof createObservedPoseRig> | undefined,
    head: ReturnType<typeof createHeadRotationRig> | undefined,
    hands: ReturnType<typeof createObservedHandRig> | undefined,
    generation: number | undefined,
    sequence = 0,
    requestedAfter: number | undefined,
    headSequence: number | undefined,
    headTracking = false,
    closed = false
  let status: ComparisonStatus = 'waiting'
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
    generation = requestedAfter = undefined
    sequence = 0
    headSequence = undefined
    headTracking = false
    status = 'waiting'
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
        mirror: true,
        halfLifeMs: 50,
        maxAgeMs: 1000,
        bindings: [...OBSERVED_LIMB_BINDINGS, OBSERVED_TRUNK_BINDING],
        ...(shoulders ? { shoulders } : {}),
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
      if (requestedAfter !== undefined && frame.at >= requestedAfter) {
        const aligned = readDetailAlignment(frame, generation, now, 1000)
        const common = {
          context: { generation, signal },
          mirror: true,
          halfLifeMs: 50,
          maxAgeMs: 1000,
        }
        head?.dispose()
        hands?.dispose()
        head = hands = undefined
        reset(true)
        try {
          if (aligned?.head) head = createHeadRotationRig(model, { ...common, ...aligned.head })
          if (aligned?.hands) hands = createObservedHandRig(model, { ...common, ...aligned.hands })
          status = head && hands ? 'aligned' : head || hands ? 'partial' : 'unavailable'
        } catch {
          head?.dispose()
          hands?.dispose()
          head = hands = undefined
          status = 'unavailable'
        }
        requestedAfter = undefined
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
    align() {
      if (closed || signal.aborted || !body) return false
      requestedAfter = performance.now()
      body.alignShoulders(requestedAfter)
      headTracking = false
      headSequence = undefined
      status = 'waiting'
      return true
    },
    render(now: number, delta: number) {
      if (closed || signal.aborted || !body) {
        model.visible = false
        return 'waiting' as const
      }
      const state = body.render(now, delta)
      snapshot = Object.freeze({ status: state.status, tracked: state.tracked, total: state.total })
      headTracking =
        head?.render(now, delta).status === 'tracking' &&
        headSequence === sequence &&
        requestedAfter === undefined
      hands?.render(now, delta)
      model.visible = state.status === 'tracking' || state.status === 'partial'
      if (requestedAfter !== undefined && now - requestedAfter > 1000) {
        requestedAfter = undefined
        status = 'unavailable'
      }
      if (!model.visible) return 'waiting' as const
      return status === 'aligned' || status === 'unavailable'
        ? status
        : state.status === 'partial'
          ? ('partial' as const)
          : ('tracking' as const)
    },
    suspend,
    getSnapshot: () => snapshot,
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
