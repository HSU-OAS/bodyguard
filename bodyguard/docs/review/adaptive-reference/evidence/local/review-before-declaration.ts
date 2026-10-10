// FR-S-03/04, FR-A-01/02: private authored display, never clinical/record progress.
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  Group,
  type KeyframeTrack,
  LoopOnce,
  type Object3D,
  QuaternionKeyframeTrack,
  type SkinnedMesh,
  VectorKeyframeTrack,
} from 'three'
import type { ResourceContext } from '../coaching/resources'
import type { CoachingState } from '../stretch/progression'

const phases = ['waiting-start', 'seeking-target', 'holding', 'waiting-return'] as const
type Phase = CoachingState['phase']
export type ReferenceCorrection = Readonly<{
  id: string
  errorCode: string
  regionId: string
  phases: readonly Phase[]
  clip: AnimationClip
}>
export type ReferenceProgram = Readonly<{
  motionId: string
  version: string
  blendMs: number
  maxAgeMs: number
  steps: readonly Readonly<{
    id: string
    clips: Readonly<Record<Phase, AnimationClip>>
    corrections?: readonly ReferenceCorrection[]
  }>[]
}>
export type ReferenceCue = Readonly<{
  generation: number
  sequence: number
  at: number
  motionId: string
  version: string
  stepId: string
  phase: Phase
  status: CoachingState['status']
  correction?: Readonly<{ id: string; sampledAt: number }>
}>
type Status = 'waiting' | 'playing' | 'paused' | 'stale' | 'unavailable' | 'ended' | 'closed'
type FactoryTrack = KeyframeTrack & {
  createInterpolant: (...args: unknown[]) => unknown
}
const invalid = () => new Error('Invalid reference playback')
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200
const clock = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
const positive = (value: number) => clock(value) && value > 0
const path = /^([A-Za-z0-9_-]+)\.(position|quaternion|scale)$/
const correctionName = (value: unknown): value is string =>
  id(value) &&
  value.trim() === value &&
  value.trim().length > 0 &&
  !Array.from(value).some((character) => character.charCodeAt(0) < 32)

/** Local Three/GLTFLoader clips, not arbitrary executable animation plugins. */
export function copyReferenceProgram(input: ReferenceProgram): ReferenceProgram {
  try {
    const { motionId, version, blendMs, maxAgeMs } = input
    if (
      !id(motionId) ||
      !id(version) ||
      !positive(blendMs) ||
      !positive(maxAgeMs) ||
      !Array.isArray(input.steps) ||
      !input.steps.length
    )
      throw invalid()
    const ids = new Set<string>()
    const steps = input.steps.map((step) => {
      const stepId = step.id
      if (!id(stepId) || ids.has(stepId)) throw invalid()
      ids.add(stepId)
      const copyClip = (clip: AnimationClip, label: string) => {
        if (
          !(clip instanceof AnimationClip) ||
          !positive(clip.duration * 1000) ||
          !clip.tracks.length
        )
          throw invalid()
        const names = new Set<string>()
        const tracks = clip.tracks.map((source) => {
          const name = source.name,
            match = path.exec(name)
          if (!match || names.has(name)) throw invalid()
          names.add(name)
          const quaternion = match[2] === 'quaternion'
          if (
            quaternion
              ? !(source instanceof QuaternionKeyframeTrack)
              : !(source instanceof VectorKeyframeTrack)
          )
            throw invalid()
          const factory = (source as FactoryTrack).createInterpolant
          const cubic = Boolean(
            (factory as unknown as { isInterpolantFactoryMethodGLTFCubicSpline?: boolean })
              ?.isInterpolantFactoryMethodGLTFCubicSpline,
          )
          const native: readonly unknown[] = [
            source.InterpolantFactoryMethodDiscrete,
            source.InterpolantFactoryMethodLinear,
            source.InterpolantFactoryMethodSmooth,
            source.InterpolantFactoryMethodBezier,
          ]
          if (typeof factory !== 'function' || (!cubic && !native.includes(factory)))
            throw invalid()
          if (factory === source.InterpolantFactoryMethodBezier && !source.settings) throw invalid()
          const times = Array.from(source.times),
            values = Array.from(source.values),
            size = quaternion ? 4 : 3
          if (
            !times.length ||
            times.some(
              (t, i) =>
                !Number.isFinite(t) || t < 0 || t > clip.duration || (i > 0 && t <= times[i - 1]),
            ) ||
            values.length !== times.length * size * (cubic ? 3 : 1) ||
            values.some((v) => !Number.isFinite(v))
          )
            throw invalid()
          for (let i = 0; i < times.length; i++) {
            const offset = i * size * (cubic ? 3 : 1) + (cubic ? size : 0)
            if (quaternion && Math.hypot(...values.slice(offset, offset + 4)) < 1e-12)
              throw invalid()
            if (
              match[2] === 'scale' &&
              values.slice(offset, offset + 3).some((v) => Math.abs(v) < 1e-12)
            )
              throw invalid()
          }
          const copy = quaternion
            ? new QuaternionKeyframeTrack(name, times, values)
            : new VectorKeyframeTrack(name, times, values)
          ;(copy as FactoryTrack).createInterpolant = factory
          if (source.settings) {
            const inTangents = Array.from(source.settings.inTangents),
              outTangents = Array.from(source.settings.outTangents)
            if (
              inTangents.length !== times.length * size * 2 ||
              outTangents.length !== inTangents.length ||
              [...inTangents, ...outTangents].some((v) => !Number.isFinite(v))
            )
              throw invalid()
            copy.settings = { inTangents, outTangents }
          }
          // Float32 conversion must keep distinct frame times separate.
          if (copy.times.some((t, i) => i > 0 && t <= copy.times[i - 1])) throw invalid()
          return copy
        })
        return new AnimationClip(label, clip.duration, tracks)
      }
      const clips = Object.fromEntries(
        phases.map((phase) => [phase, copyClip(step.clips[phase], phase)]),
      ) as Record<Phase, AnimationClip>
      const supplied = step.corrections
      let corrections: readonly ReferenceCorrection[] | undefined
      if (supplied !== undefined) {
        if (!Array.isArray(supplied) || supplied.length > 32) throw invalid()
        const correctionIds = new Set<string>(),
          matchKeys = new Set<string>()
        corrections = Object.freeze(
          Array.from(supplied, (item) => {
            const { id: correctionId, errorCode, regionId } = item
            const permitted = item.phases
            if (
              !correctionName(correctionId) ||
              !correctionName(errorCode) ||
              !correctionName(regionId) ||
              correctionIds.has(correctionId) ||
              !Array.isArray(permitted) ||
              !permitted.length ||
              permitted.length > phases.length
            )
              throw invalid()
            for (const phase of copiedPhases) {
              const key = JSON.stringify([errorCode, regionId, phase])
              if (matchKeys.has(key)) throw invalid()
              matchKeys.add(key)
            }
            correctionIds.add(correctionId)
            const copiedPhases = Array.from(permitted)
            if (
              new Set(copiedPhases).size !== copiedPhases.length ||
              copiedPhases.some((phase) => !phases.includes(phase))
            )
              throw invalid()
            return Object.freeze({
              id: correctionId,
              errorCode,
              regionId,
              phases: Object.freeze(copiedPhases),
              clip: copyClip(item.clip, correctionId),
            })
          }),
        )
      }
      return Object.freeze({
        id: stepId,
        clips: Object.freeze(clips),
        ...(corrections ? { corrections } : {}),
      })
    })
    return Object.freeze({ motionId, version, blendMs, maxAgeMs, steps: Object.freeze(steps) })
  } catch {
    throw invalid()
  }
}

const pose = (bone: Bone) => ({
  position: bone.position.clone(),
  quaternion: bone.quaternion.clone(),
  scale: bone.scale.clone(),
})
function validPose(bone: Pick<Bone, 'position' | 'quaternion' | 'scale'>) {
  return (
    [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()].every(
      Number.isFinite,
    ) &&
    bone.quaternion.lengthSq() > 1e-12 &&
    bone.scale.toArray().every((v) => Math.abs(v) > 1e-12)
  )
}

export function createReferencePlayback(
  root: Object3D,
  options: Readonly<{ context: ResourceContext; program: ReferenceProgram }>,
) {
  const { generation, signal } = options.context
  if (!Number.isSafeInteger(generation) || generation <= 0 || !signal || signal.aborted)
    throw invalid()
  const {
      motionId,
      version,
      blendMs,
      maxAgeMs,
      steps: configured,
    } = copyReferenceProgram(options.program),
    steps = new Map(configured.map((s) => [s.id, s]))
  const bound = new Set<Bone>(),
    names = new Map<string, Bone>(),
    all = new Map<string, number>()
  const skins: { mesh: SkinnedMesh; bones: Bone[] }[] = []
  root.traverse((node) => {
    if ((node as Bone).isBone) all.set(node.name, (all.get(node.name) ?? 0) + 1)
    const mesh = node as SkinnedMesh
    if (mesh.isSkinnedMesh) {
      skins.push({ mesh, bones: [...mesh.skeleton.bones] })
      for (const bone of mesh.skeleton.bones) bound.add(bone)
    }
  })
  if (!bound.size) throw invalid()
  const sampleRoot = new Group()
  const bindings = [...bound].map((bone) => {
    if (!bone.isBone || !id(bone.name) || all.get(bone.name) !== 1 || !validPose(bone))
      throw invalid()
    names.set(bone.name, bone)
    const sample = new Bone()
    sample.name = bone.name
    sample.position.copy(bone.position)
    sample.quaternion.copy(bone.quaternion)
    sample.scale.copy(bone.scale)
    sampleRoot.add(sample)
    return {
      bone,
      sample,
      parent: bone.parent,
      rest: pose(bone),
      from: pose(bone),
      candidate: pose(bone),
    }
  })
  for (const step of steps.values())
    for (const clip of [
      ...Object.values(step.clips),
      ...(step.corrections ?? []).map((item) => item.clip),
    ])
      for (const track of clip.tracks)
        if (!names.has(path.exec(track.name)?.[1] ?? '')) throw invalid()
  const mixer = new AnimationMixer(sampleRoot)
  let status: Status = 'waiting',
    phase: Phase | null = null,
    stepId: string | null = null,
    correctionId: string | null = null,
    correctionAt: number | null = null,
    clip: AnimationClip | undefined,
    clipMs = 0,
    blendElapsed = 0,
    lastSequence = 0,
    lastAt = -Infinity,
    lastNow: number | null = null,
    skipDelta = true,
    released = false
  let updateToken: object | undefined
  function snapshot() {
    return Object.freeze({ status, phase, stepId, clipMs, correctionId })
  }
  function release() {
    if (released) return
    released = true
    updateToken = undefined
    signal.removeEventListener('abort', dispose)
    mixer.stopAllAction()
    mixer.uncacheRoot(sampleRoot)
    sampleRoot.clear()
    steps.clear()
    names.clear()
    bindings.splice(0)
    skins.splice(0)
    clip = undefined
  }
  function dispose() {
    status = 'closed'
    release()
  }
  function freeze(next: Status) {
    status = next
    skipDelta = true
    return snapshot()
  }
  function update(input: ReferenceCue) {
    if (released || signal.aborted) return false
    const token = {}
    updateToken = token
    let cue: ReferenceCue
    try {
      const suppliedCorrection = input.correction
      cue = {
        generation: input.generation,
        sequence: input.sequence,
        at: input.at,
        motionId: input.motionId,
        version: input.version,
        stepId: input.stepId,
        phase: input.phase,
        status: input.status,
        ...(suppliedCorrection !== undefined
          ? {
              correction: Object.freeze({
                id: suppliedCorrection.id,
                sampledAt: suppliedCorrection.sampledAt,
              }),
            }
          : {}),
      }
    } catch {
      if (!released && !signal.aborted && updateToken === token) freeze('unavailable')
      return false
    }
    if (released || signal.aborted || updateToken !== token) return false
    if (
      cue.generation !== generation ||
      !Number.isSafeInteger(cue.sequence) ||
      cue.sequence <= lastSequence ||
      !clock(cue.at) ||
      cue.at < lastAt
    )
      return false
    lastSequence = cue.sequence
    lastAt = cue.at
    const step = steps.get(cue.stepId)
    const selected =
      cue.correction === undefined
        ? undefined
        : step?.corrections?.find((item) => item.id === cue.correction?.id)
    if (
      cue.motionId !== motionId ||
      cue.version !== version ||
      !step ||
      !phases.includes(cue.phase) ||
      !['idle', 'preparing', 'running', 'paused', 'ended'].includes(cue.status) ||
      (cue.correction !== undefined &&
        (!selected?.phases.includes(cue.phase) ||
          !clock(cue.correction.sampledAt) ||
          cue.correction.sampledAt > cue.at ||
          cue.at - cue.correction.sampledAt > maxAgeMs))
    ) {
      freeze('unavailable')
      return false
    }
    if (cue.status === 'ended') {
      status = 'ended'
      release()
      return true
    }
    if (cue.status !== 'running') {
      freeze(cue.status === 'paused' ? 'paused' : 'waiting')
      return true
    }
    const nextCorrection = selected?.id ?? null
    if (phase !== cue.phase || stepId !== cue.stepId || correctionId !== nextCorrection) {
      // Native stop/uncache never touches the displayed reference.
      mixer.stopAllAction()
      for (const b of bindings) {
        b.from = pose(b.bone)
        b.sample.position.copy(b.rest.position)
        b.sample.quaternion.copy(b.rest.quaternion)
        b.sample.scale.copy(b.rest.scale)
      }
      phase = cue.phase
      stepId = cue.stepId
      correctionId = nextCorrection
      clip = selected?.clip ?? step.clips[phase]
      clipMs = 0
      blendElapsed = 0
      skipDelta = true
      const action = mixer.clipAction(clip)
      action.reset()
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      mixer.update(0)
      if (released || signal.aborted || updateToken !== token) return false
    }
    correctionAt = cue.correction?.sampledAt ?? null
    status = 'playing'
    return true
  }
  function render(now: number, deltaMs: number) {
    if (released || signal.aborted) {
      if (signal.aborted) dispose()
      return snapshot()
    }
    if (!clock(now) || !clock(deltaMs) || (lastNow !== null && now < lastNow))
      return freeze('unavailable')
    const elapsed = lastNow === null ? 0 : Math.min(deltaMs, now - lastNow)
    lastNow = now
    if (status === 'paused' || status === 'waiting') return snapshot()
    if (
      lastAt > now ||
      now - lastAt > maxAgeMs ||
      (correctionAt !== null && (correctionAt > now || now - correctionAt > maxAgeMs))
    )
      return freeze('stale')
    if (status !== 'playing' || !clip) return snapshot()
    const current = new Map<string, Bone>()
    let duplicate = false
    root.traverse((node) => {
      if (!(node as Bone).isBone) return
      if (current.has(node.name)) duplicate = true
      current.set(node.name, node as Bone)
    })
    if (
      duplicate ||
      skins.some(
        (s) =>
          s.bones.length !== s.mesh.skeleton.bones.length ||
          s.bones.some((bone, i) => s.mesh.skeleton.bones[i] !== bone),
      ) ||
      bindings.some(
        (b) =>
          b.bone.parent !== b.parent || current.get(b.bone.name) !== b.bone || !validPose(b.bone),
      )
    )
      return freeze('unavailable')
    const delta = skipDelta ? 0 : elapsed
    skipDelta = false
    clipMs = Math.min(clip.duration * 1000, clipMs + delta)
    blendElapsed = Math.min(blendMs, blendElapsed + delta)
    mixer.update(delta / 1000)
    if (signal.aborted || released) return snapshot()
    if (bindings.some((b) => !validPose(b.sample))) return freeze('unavailable')
    const fraction = blendElapsed / blendMs,
      alpha = fraction * fraction * (3 - 2 * fraction)
    for (const b of bindings) {
      b.candidate.position.lerpVectors(b.from.position, b.sample.position, alpha)
      b.candidate.quaternion.copy(b.from.quaternion)
      if (alpha > 0) b.candidate.quaternion.slerp(b.sample.quaternion, alpha).normalize()
      b.candidate.scale.lerpVectors(b.from.scale, b.sample.scale, alpha)
    }
    if (bindings.some((b) => !validPose(b.candidate))) return freeze('unavailable')
    for (const b of bindings) {
      b.bone.position.copy(b.candidate.position)
      b.bone.quaternion.copy(b.candidate.quaternion)
      b.bone.scale.copy(b.candidate.scale)
    }
    root.updateMatrixWorld(true)
    return snapshot()
  }
  signal.addEventListener('abort', dispose, { once: true })
  if (signal.aborted) dispose()
  // FR-M-07: owner can stop an obsolete guide without manufacturing a new session cue.
  const suspend = () => {
    if (released || signal.aborted) return false
    updateToken = undefined
    freeze('unavailable')
    return true
  }
  return Object.freeze({ update, render, snapshot, suspend, dispose })
}
