// FR-S-06/FR-M-07: purpose + observed camera coverage, NOT therapeutic need or release.
import { createCameraFraming, motionFramingRequirement } from '../posture/cameraFraming'
import { JOINT_COUNT } from '../posture/landmarks'
import { previewMotions } from './motions'

export type RecommendationPurpose = 'neck' | 'shoulder' | 'torso'
export type CameraRecommendations = Readonly<{
  scope: 'camera-match-candidate-only'
  purpose: RecommendationPurpose
  status: 'checking' | 'adjust' | 'one-person' | 'none' | 'ready'
  motionIds: readonly string[]
}>
type Frame = Parameters<ReturnType<typeof createCameraFraming>['accept']>[0]

export function createCameraRecommendations(purpose: RecommendationPurpose) {
  if (!['neck', 'shoulder', 'torso'].includes(purpose))
    throw new Error('Invalid recommendation purpose')
  const motions = previewMotions.filter(
    (m) => m.region === purpose && m.reviewMode === 'coaching-candidate',
  )
  const make = () =>
    motions.map((m) => {
      const requirement = motionFramingRequirement(m.id)
      if (!requirement) throw new Error('Missing recommendation framing')
      return { id: m.id, observer: createCameraFraming(requirement) }
    })
  let entries = make(),
    token = {},
    generation: number | null = null,
    sequence = -1,
    at = -Infinity
  let cached: CameraRecommendations | undefined,
    key = ''
  function invalidate() {
    entries = make()
    cached = undefined
    key = ''
  }
  function reset() {
    token = {}
    invalidate()
    generation = null
    sequence = -1
    at = -Infinity
  }
  function accept(frame: Frame, now: number) {
    const own = {}
    token = own
    try {
      const next = { generation: frame.generation, sequence: frame.sequence, at: frame.at }
      if (
        !Number.isSafeInteger(next.generation) ||
        next.generation <= 0 ||
        (generation !== null && generation !== next.generation) ||
        !Number.isSafeInteger(next.sequence) ||
        next.sequence <= sequence ||
        !Number.isFinite(next.at) ||
        next.at < 0 ||
        next.at > Number.MAX_SAFE_INTEGER ||
        next.at > now ||
        !Number.isFinite(now) ||
        now < 0 ||
        now > Number.MAX_SAFE_INTEGER ||
        next.at <= at
      )
        throw new Error()
      if (own !== token) return
      generation = next.generation
      sequence = next.sequence
      at = next.at
      // One ephemeral copy for all coverage checks; never retain points/history in state.
      const people = frame.result.landmarks
      if (!Array.isArray(people) || people.length > 2) throw new Error()
      const landmarks = people.map((points) => {
        if (!Array.isArray(points) || points.length !== JOINT_COUNT) throw new Error()
        return points.map((p) =>
          p && typeof p === 'object'
            ? { x: p.x, y: p.y, z: p.z, visibility: p.visibility, presence: p.presence }
            : p,
        )
      })
      if (own !== token) return
      for (const entry of entries) entry.observer.accept({ ...next, result: { landmarks } }, now)
    } catch {
      if (own === token) invalidate()
    }
  }
  function read(now: number): CameraRecommendations {
    const states = entries.map((e) => ({ id: e.id, state: e.observer.read(now) })),
      ids = states.filter((e) => e.state === 'in-frame').map((e) => e.id),
      status = !entries.length
        ? 'none'
        : ids.length
          ? 'ready'
          : states.some((e) => e.state === 'one-person')
            ? 'one-person'
            : states.some((e) => e.state === 'position' || e.state === 'adjust')
              ? 'adjust'
              : 'checking',
      nextKey = `${status}:${ids.join(',')}`
    if (!cached || nextKey !== key) {
      key = nextKey
      cached = Object.freeze({
        scope: 'camera-match-candidate-only',
        purpose,
        status,
        motionIds: Object.freeze(ids),
      })
    }
    return cached
  }
  return Object.freeze({ accept, read, reset })
}
