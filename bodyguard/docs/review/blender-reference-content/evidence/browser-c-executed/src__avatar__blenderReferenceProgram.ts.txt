// FR-S-03/04·FR-A-01/03: source-matched authored phases; no judgement/hold prescription.
import {
  AnimationClip,
  type Bone,
  type Interpolant,
  InterpolateDiscrete,
  InterpolateLinear,
  type Object3D,
  QuaternionKeyframeTrack,
  type SkinnedMesh,
  VectorKeyframeTrack,
} from 'three'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { type ReferenceMotion, referenceMotion } from './referenceContentAssets'
import { copyReferenceProgram, type ReferenceProgram } from './referencePlayback'

const invalid = () => new Error('Blender reference unavailable')
const tolerance = 0.000005 // Float export precision only, not anatomical/clinical tolerance.
const plans = {
  'neck-side': [
    ['left', 12, 40, 48, 72],
    ['right', 72, 104, 112, 144],
  ],
  'shoulder-shrug': [['both', 12, 36, 44, 72]],
  'arm-overhead': [
    ['left', 12, 44, 52, 72],
    ['right', 72, 108, 116, 144],
  ],
} as const

function near(a: readonly number[], b: readonly number[], quaternion = false) {
  if (a.length !== b.length) return false
  const sign = quaternion && a.reduce((sum, value, i) => sum + value * b[i], 0) < 0 ? -1 : 1
  return a.every(
    (value, i) =>
      Number.isFinite(value) && Number.isFinite(b[i]) && Math.abs(value - sign * b[i]) <= tolerance,
  )
}
function named(root: Object3D) {
  const map = new Map<string, Object3D>()
  root.traverse((node) => {
    if (!node.name) return
    if (map.has(node.name)) throw invalid()
    map.set(node.name, node)
  })
  return map
}

/** Original body bones must match the export; never guess rest axes or rename by substring. */
export function assertBlenderReferenceBinding(body: Object3D, animation: Object3D) {
  const nodes = named(animation),
    all = named(body),
    bound = new Set<Bone>()
  body.traverse((node) => {
    if ((node as SkinnedMesh).isSkinnedMesh)
      for (const bone of (node as SkinnedMesh).skeleton.bones) bound.add(bone)
  })
  if (bound.size !== 163) throw invalid()
  for (const bone of bound) {
    const source = nodes.get(bone.name)
    if (
      !source ||
      all.get(bone.name) !== bone ||
      !near(bone.position.toArray(), source.position.toArray()) ||
      !near(bone.scale.toArray(), source.scale.toArray()) ||
      !near(bone.quaternion.toArray(), source.quaternion.toArray(), true) ||
      bone.parent?.name !== source.parent?.name
    )
      throw invalid()
  }
  return bound.size
}

export function blenderReferenceProgram(
  motion: ReferenceMotion,
  asset: Pick<GLTF, 'scene' | 'animations'>,
): ReferenceProgram {
  if (!referenceMotion(motion) || asset.animations.length !== 1) throw invalid()
  const animation = asset.animations[0],
    nodes = named(asset.scene),
    tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = []
  let meshes = false
  asset.scene.traverse((node) => {
    if ((node as SkinnedMesh).isMesh) meshes = true
  })
  if (
    meshes ||
    animation.tracks.length !== 489 ||
    !Number.isFinite(animation.duration) ||
    animation.duration < 2 ||
    animation.duration > 7
  )
    throw invalid()
  const seen = new Set<string>()
  for (const source of animation.tracks) {
    const match = /^([A-Za-z0-9_-]+)\.(quaternion|position|scale)$/.exec(source.name)
    const node = match && nodes.get(match[1]),
      mode = source.getInterpolation()
    if (
      !match ||
      !node ||
      seen.has(source.name) ||
      (mode !== InterpolateDiscrete && mode !== InterpolateLinear)
    )
      throw invalid()
    seen.add(source.name)
    const rotation = match[2] === 'quaternion',
      size = rotation ? 4 : 3
    if (
      rotation
        ? !(source instanceof QuaternionKeyframeTrack)
        : !(source instanceof VectorKeyframeTrack)
    )
      throw invalid()
    const times = Array.from(source.times),
      values = Array.from(source.values),
      rest = node[match[2] as 'quaternion' | 'position' | 'scale'].toArray()
    if (
      !times.length ||
      times.length > 1000 ||
      values.length !== times.length * size ||
      times.some(
        (time, i) =>
          !Number.isFinite(time) ||
          time < 0 ||
          time > animation.duration ||
          (i > 0 && time <= times[i - 1]),
      ) ||
      values.some((value) => !Number.isFinite(value))
    )
      throw invalid()
    if (rotation)
      for (let i = 0; i < values.length; i += 4)
        if (Math.abs(Math.hypot(...values.slice(i, i + 4)) - 1) > 0.00001) throw invalid()
    const constantRest = times.every((_, i) =>
      near(values.slice(i * size, (i + 1) * size), rest, rotation),
    )
    if (!rotation) {
      if (
        !times.every((_, i) => near(values.slice(i * size, (i + 1) * size), values.slice(0, size)))
      )
        throw invalid()
      // Preserve the export's static vector transform too (female scale decomposition differs).
      if (!constantRest) tracks.push(new VectorKeyframeTrack(source.name, times, values, mode))
    }
    if (!constantRest && rotation)
      tracks.push(new QuaternionKeyframeTrack(source.name, times, values, mode))
  }
  if (!tracks.length) throw invalid()
  const slice = (phase: string, from: number, to: number) => {
    const start = (from - 1) / 24,
      end = (to - 1) / 24
    if (start < 0 || end <= start || end > animation.duration + tolerance) throw invalid()
    return new AnimationClip(
      phase,
      -1, // Infer from Float32 key times; rounding must not put a key after clip.duration.
      tracks.map((track) => {
        const times = [
          start,
          ...Array.from(track.times).filter((t) => t > start + 0.000001 && t < end - 0.000001),
          end,
        ]
        const interpolant = (
          track as (QuaternionKeyframeTrack | VectorKeyframeTrack) & {
            createInterpolant(): Interpolant
          }
        ).createInterpolant()
        const values = times.flatMap((time) => Array.from(interpolant.evaluate(time)))
        const Track =
          track instanceof QuaternionKeyframeTrack ? QuaternionKeyframeTrack : VectorKeyframeTrack
        return new Track(
          track.name,
          times.map((time) => time - start),
          values,
          track.getInterpolation(),
        )
      }),
    )
  }
  return copyReferenceProgram({
    motionId: motion,
    version: 'blender-preview-v1',
    blendMs: 120,
    maxAgeMs: 1000,
    steps: plans[motion].map(([id, start, target, hold, end]) => ({
      id,
      clips: {
        'waiting-start': slice('waiting-start', 1, 12),
        'seeking-target': slice('seeking-target', start, target),
        holding: slice('holding', target, hold),
        'waiting-return': slice('waiting-return', hold, end),
      },
    })),
  })
}
