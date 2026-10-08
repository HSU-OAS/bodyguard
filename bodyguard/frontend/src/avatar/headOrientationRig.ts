// FR-A-01/03·FR-M-02/07: private head display; never cervical measurement or classification.
import { type Bone, Matrix4, type Object3D, Quaternion, Vector3 } from 'three'
import type { ResourceContext } from '../coaching/resources'

type Layout = 'column-major' | 'row-major'
type Rotation = readonly number[]
type FaceResult = Readonly<{
  faceLandmarks: readonly (readonly Readonly<{ x: number; y: number; z: number }>[])[]
  facialTransformationMatrixes: readonly Readonly<{
    rows: number
    columns: number
    data: readonly number[]
  }>[]
}>
type Frame = Readonly<{
  generation: number
  sequence: number
  at: number
  result: FaceResult | null
}>
type Options = Readonly<{
  context: ResourceContext
  bone: string
  matrixLayout: Layout
  mirror: boolean
  cameraReference: Rotation
  sceneFromCamera: Rotation
  halfLifeMs: number
  maxAgeMs: number
}>
// Float32 affine/orthogonality roundoff only, not an anatomical angle or quality threshold.
const ROUND_OFF = 1e-5
function similarityRotation(matrix: Matrix4): Quaternion | null {
  const e = matrix.elements
  if (
    !e.every(Number.isFinite) ||
    [e[3], e[7], e[11]].some((v) => Math.abs(v) > ROUND_OFF) ||
    Math.abs(e[15] - 1) > ROUND_OFF
  )
    return null
  const axes = [
    new Vector3(e[0], e[1], e[2]),
    new Vector3(e[4], e[5], e[6]),
    new Vector3(e[8], e[9], e[10]),
  ]
  const sizes = axes.map((v) => Math.hypot(v.x, v.y, v.z))
  if (sizes.some((s) => !Number.isFinite(s) || s <= 0)) return null
  if (sizes.some((s) => Math.abs(s / sizes[0] - 1) > ROUND_OFF)) return null
  axes.forEach((v, i) => {
    v.divideScalar(sizes[i])
  })
  const [x, y, z] = axes
  if (
    Math.max(Math.abs(x.dot(y)), Math.abs(x.dot(z)), Math.abs(y.dot(z))) > ROUND_OFF ||
    Math.abs(x.clone().cross(y).dot(z) - 1) > ROUND_OFF
  )
    return null
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)).normalize()
}

/** Declared layout, never inferred from translation. SDK matrices map canonical face to
 * detected face; one accepted face does not prove a single person or pose/face identity.
 * Only copied rotation leaves this boundary; no landmarks or translation are retained.
 */
export function readHeadOrientation(result: FaceResult, layout: Layout): Rotation | null {
  try {
    if (layout !== 'column-major' && layout !== 'row-major') return null
    const faces = result.faceLandmarks
    const matrices = result.facialTransformationMatrixes
    if (
      !Array.isArray(faces) ||
      faces.length !== 1 ||
      !Array.isArray(matrices) ||
      matrices.length !== 1
    )
      return null
    const points = faces[0]
    if (
      !Array.isArray(points) ||
      ![468, 478].includes(points.length) ||
      !Array.from(points).every(
        (p) =>
          p && [p.x, p.y, p.z].every(Number.isFinite) && p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1,
      )
    )
      return null
    const { rows, columns, data } = matrices[0]
    if (rows !== 4 || columns !== 4 || !Array.isArray(data) || data.length !== 16) return null
    const matrix = new Matrix4().fromArray(data)
    if (layout === 'row-major') matrix.transpose()
    const rotation = similarityRotation(matrix)
    return rotation ? Object.freeze(rotation.toArray()) : null
  } catch {
    return null
  }
}

function unit(value: Rotation): Quaternion | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite)) return null
  const length = Math.hypot(...value)
  return Math.abs(length - 1) <= ROUND_OFF ? new Quaternion().fromArray(value).normalize() : null
}
const mirrorX = (q: Quaternion) => new Quaternion(q.x, -q.y, -q.z, q.w)

/** Caller owns a private cloned model. Explicit camera reference is display alignment,
 * NOT automatically sampled, clinically neutral, or reusable across camera/session changes.
 * This rotates only the named head bone; it does not invent individual neck/torso rotations.
 * Missing input freezes local pose. A parent's movement is not a head observation.
 */
export function createHeadOrientationRig(model: Object3D, options: Options) {
  const { generation, signal } = options.context
  const { matrixLayout, mirror, halfLifeMs, maxAgeMs } = options
  const invalid = () => new Error('Invalid head avatar rig')
  const reference = unit(options.cameraReference)
  const basis = unit(options.sceneFromCamera)
  if (
    !Number.isSafeInteger(generation) ||
    generation <= 0 ||
    !signal ||
    typeof options.bone !== 'string' ||
    !options.bone ||
    (matrixLayout !== 'column-major' && matrixLayout !== 'row-major') ||
    typeof mirror !== 'boolean' ||
    !reference ||
    !basis ||
    !Number.isFinite(halfLifeMs) ||
    halfLifeMs <= 0 ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs <= 0
  )
    throw invalid()
  const found: Object3D[] = []
  model.traverse((node) => {
    if (node.name === options.bone) found.push(node)
  })
  if (found.length !== 1 || !(found[0] as Bone).isBone) throw invalid()
  const head = found[0] as Bone
  const ancestors: Object3D[] = []
  for (let node: Object3D | null = head; node; node = node.parent) ancestors.push(node)
  const parents = ancestors.map((node) => node.parent)
  const validTransforms = () =>
    ancestors.every(
      (node, i) =>
        node.parent === parents[i] &&
        node.matrixAutoUpdate &&
        [...node.position.toArray(), ...node.scale.toArray(), ...node.quaternion.toArray()].every(
          Number.isFinite,
        ) &&
        node.scale.toArray().every((n) => n > 0) &&
        Math.abs(node.quaternion.lengthSq() - 1) <= ROUND_OFF,
    )
  model.updateWorldMatrix(true, true)
  const restWorld = similarityRotation(head.matrixWorld)
  if (!validTransforms() || !restWorld) throw invalid()
  const referenceInverse = (mirror ? mirrorX(reference) : reference).invert()
  const sceneBasis = basis.clone()
  const basisInverse = sceneBasis.clone().invert()
  const authoredWorld = restWorld.clone()
  let closed = false,
    initialized = false,
    lastNow = -Infinity
  let latest: { sequence: number; at: number; target: Quaternion | null } | null = null
  const state = (status: 'tracking' | 'untracked' | 'closed') =>
    Object.freeze({ status, tracked: status === 'tracking' ? 1 : 0, total: 1 })
  function dispose() {
    if (closed) return
    closed = true
    latest = null
    signal.removeEventListener('abort', dispose)
  }
  signal.addEventListener('abort', dispose, { once: true })
  if (signal.aborted) dispose()
  function push(frame: Frame): boolean {
    if (closed || signal.aborted || !frame) return false
    try {
      const suppliedGeneration = frame.generation,
        sequence = frame.sequence,
        at = frame.at
      if (
        suppliedGeneration !== generation ||
        !Number.isSafeInteger(sequence) ||
        sequence <= 0 ||
        !Number.isFinite(at) ||
        at < 0 ||
        (latest && (sequence <= latest.sequence || at <= latest.at)) ||
        lastNow - at > maxAgeMs
      )
        return false
      // Reserve stamps before reading foreign payload; fresh invalid/missing input revokes
      // the old observation instead of retaining a previous person's face.
      const accepted = { sequence, at, target: null as Quaternion | null }
      latest = accepted
      const result = frame.result
      const rotation = result ? readHeadOrientation(result, matrixLayout) : null
      if (closed || signal.aborted || latest !== accepted) return false
      if (!rotation) {
        initialized = false
        return true
      }
      const camera = new Quaternion().fromArray(rotation)
      const delta = (mirror ? mirrorX(camera) : camera).multiply(referenceInverse)
      accepted.target = sceneBasis
        .clone()
        .multiply(delta)
        .multiply(basisInverse)
        .multiply(authoredWorld)
        .normalize()
      return true
    } catch {
      initialized = false
      return false
    }
  }
  function render(now: number, deltaMs: number) {
    if (closed || signal.aborted) return state('closed')
    if (!Number.isFinite(now) || now < lastNow || !Number.isFinite(deltaMs) || deltaMs < 0)
      return state('untracked')
    lastNow = now
    if (!latest?.target || now < latest.at || now - latest.at > maxAgeMs || !validTransforms()) {
      initialized = false
      return state('untracked')
    }
    head.updateWorldMatrix(true, false)
    if (!similarityRotation(head.matrixWorld)) {
      initialized = false
      return state('untracked')
    }
    const parentRotation = head.parent
      ? similarityRotation(head.parent.matrixWorld)
      : new Quaternion()
    if (!parentRotation) {
      initialized = false
      return state('untracked')
    }
    const target = parentRotation.invert().multiply(latest.target).normalize()
    if (initialized) head.quaternion.slerp(target, 1 - 2 ** (-deltaMs / halfLifeMs))
    else {
      head.quaternion.copy(target)
      initialized = true
    }
    head.updateWorldMatrix(false, true)
    return state('tracking')
  }
  return Object.freeze({ push, render, dispose })
}
