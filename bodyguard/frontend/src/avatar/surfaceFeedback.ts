// FR-A-01/03·FR-M-07: private display of supplied errors, never a pose classifier.
import {
  Color,
  Float32BufferAttribute,
  type Material,
  type Object3D,
  type SkinnedMesh,
} from 'three'
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import { OBSERVED_LIMB_BINDINGS } from './directionalRig'
import type { PoseCoverage } from './observedPoseRig'
import { OBSERVED_TRUNK_BINDING } from './observedTrunk'
import {
  PROJECTED_SURFACE_REGIONS,
  type ProjectedSurfaceRegion,
  projectedSurfaceEnvelope,
} from './projectedSurfaceRegions'

export type FeedbackProgram = Readonly<{
  motionId: string
  version: string
  regions: readonly Readonly<{
    id: string
    bones: readonly string[]
    projection?: ProjectedSurfaceRegion
  }>[]
}>
export type FeedbackFrame = Readonly<{
  generation: number
  sequence: number
  at: number
  motionId: string
  version: string
  errors: readonly Readonly<{
    regionId: string
    severity: 'attention' | 'deviation'
    code?: string
  }>[]
}>
const invalid = () => new Error('Invalid avatar feedback')
const named = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= 128 &&
  !Array.from(value).some((character) => character.charCodeAt(0) < 32)
const time = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER

export function copyFeedbackProgram(input: FeedbackProgram): FeedbackProgram {
  try {
    const motionId = input.motionId,
      version = input.version,
      regions = input.regions
    if (
      !named(motionId) ||
      !named(version) ||
      !Array.isArray(regions) ||
      !regions.length ||
      regions.length > 8
    )
      throw invalid()
    const ids = new Set<string>(),
      usedBones = new Set<string>()
    const copied = Array.from(regions).map((region) => {
      const id = region.id,
        supplied = region.bones,
        projection: ProjectedSurfaceRegion | undefined = region.projection
      if (
        !named(id) ||
        ids.has(id) ||
        !Array.isArray(supplied) ||
        !supplied.length ||
        supplied.length > 8
      )
        throw invalid()
      ids.add(id)
      const bones = Array.from(supplied)
      if (projection !== undefined) {
        if (!Object.hasOwn(PROJECTED_SURFACE_REGIONS, projection)) throw invalid()
        const mask = PROJECTED_SURFACE_REGIONS[projection]
        if (bones.length !== mask.length || !mask.every((bone) => bones.includes(bone)))
          throw invalid()
      }
      if (bones.includes(OBSERVED_TRUNK_BINDING.bone) && bones.length !== 1) throw invalid()
      for (const bone of bones) {
        // FR-A-03/FR-M-07: only the observed aggregate axis; no inferred spine/pelvis coverage.
        if (
          (projection === undefined &&
            !OBSERVED_LIMB_BINDINGS.some((binding) => binding.bone === bone) &&
            bone !== OBSERVED_TRUNK_BINDING.bone) ||
          usedBones.has(bone)
        )
          throw invalid()
        usedBones.add(bone)
      }
      return Object.freeze({
        id,
        bones: Object.freeze(bones),
        ...(projection !== undefined ? { projection } : {}),
      })
    })
    return Object.freeze({ motionId, version, regions: Object.freeze(copied) })
  } catch {
    throw invalid()
  }
}

// Preserve the current material's eight-weight compiler. These attributes affect colour only;
// they follow existing skinned vertices and never change position, normals, weights or alpha.
export function feedbackShader(vertex: string, fragment: string) {
  if (
    !vertex.includes('#include <begin_vertex>') ||
    !fragment.includes('#include <color_fragment>')
  )
    throw invalid()
  return {
    vertex: `attribute float bodyguardFeedbackWeight;\nattribute vec3 bodyguardFeedbackTint;\nvarying float vBodyguardFeedbackWeight;\nvarying vec3 vBodyguardFeedbackTint;\n${vertex.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBodyguardFeedbackWeight = bodyguardFeedbackWeight;\nvBodyguardFeedbackTint = bodyguardFeedbackTint;')}`,
    fragment: `varying float vBodyguardFeedbackWeight;\nvarying vec3 vBodyguardFeedbackTint;\n${fragment.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vBodyguardFeedbackTint, clamp(vBodyguardFeedbackWeight, 0.0, 1.0));')}`,
  }
}

/** Caller supplies a privately owned USER model and copied observation coverage. Program names
 * define display regions, not medically validated rules. All state stays in browser memory.
 * Native/pair owners must separately guard authority. No public UI or diagnostic fallback.
 */
export function createSurfaceFeedback(
  model: Object3D,
  options: Readonly<{
    context: ResourceContext
    program: FeedbackProgram
    maxAgeMs: number
  }>,
) {
  const program = copyFeedbackProgram(options.program),
    { generation, signal } = options.context,
    maxAgeMs = options.maxAgeMs
  if (
    !Number.isSafeInteger(generation) ||
    generation <= 0 ||
    !signal ||
    signal.aborted ||
    !time(maxAgeMs) ||
    maxAgeMs <= 0
  )
    throw invalid()
  const regions = new Map(program.regions.map((region) => [region.id, region]))
  const projectedPeaks = new Map(
    program.regions
      .filter((region) => region.projection !== undefined)
      .map((region) => [region.id, 0]),
  )
  const attention = new Color('#ef9a32'),
    deviation = new Color('#e85a63')
  const owned: {
    mesh: SkinnedMesh
    originalGeometry: SkinnedMesh['geometry']
    geometry: SkinnedMesh['geometry']
    originalMaterial: SkinnedMesh['material']
    material: SkinnedMesh['material']
    materials: Material[]
    influence: Map<string, Float32Array>
    weights: Float32BufferAttribute
    tints: Float32BufferAttribute
  }[] = []
  let closed = false,
    failed = false,
    trunkPeak = 0,
    coverage: PoseCoverage | null = null,
    consumedSequence = -1,
    lastNow = -Infinity
  let dirty = false,
    paintedKey = ''
  let active: readonly string[] = Object.freeze([])
  let pending: FeedbackFrame['errors'] | null = null
  function clear() {
    paintedKey = ''
    if (!active.length) return
    active = Object.freeze([])
    for (const entry of owned) {
      entry.weights.array.fill(0)
      entry.tints.array.fill(0)
      entry.weights.needsUpdate = true
      entry.tints.needsUpdate = true
    }
  }
  function dispose() {
    if (!closed) {
      closed = true
      coverage = null
      pending = null
      active = Object.freeze([])
      signal.removeEventListener('abort', aborted)
      for (const entry of owned) {
        if (entry.mesh.geometry === entry.geometry) entry.mesh.geometry = entry.originalGeometry
        if (entry.mesh.material === entry.material) entry.mesh.material = entry.originalMaterial
        for (const resource of [entry.geometry, ...entry.materials]) {
          try {
            resource.dispose()
          } catch {
            failed = true
          }
        }
      }
    }
    if (failed) throw new ResourceCleanupError()
  }
  function aborted() {
    try {
      dispose()
    } catch {
      /* Explicit owner dispose observes failure. */
    }
  }
  try {
    model.traverse((node) => {
      const mesh = node as SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      const originalGeometry = mesh.geometry,
        originalMaterial = mesh.material
      const palette = mesh.skeleton.bones.map((bone) => bone.name)
      for (const region of program.regions)
        for (const bone of region.bones)
          if (palette.filter((name) => name === bone).length !== 1) throw invalid()
      if (
        originalGeometry.hasAttribute('bodyguardFeedbackWeight') ||
        originalGeometry.hasAttribute('bodyguardFeedbackTint')
      )
        throw invalid()
      const position = originalGeometry.getAttribute('position'),
        first = originalGeometry.getAttribute('skinWeight'),
        firstIndex = originalGeometry.getAttribute('skinIndex')
      const extra = originalGeometry.getAttribute('skinWeight1'),
        extraIndex = originalGeometry.getAttribute('skinIndex1')
      if (
        !position ||
        !first ||
        !firstIndex ||
        first.count !== position.count ||
        firstIndex.count !== position.count ||
        first.itemSize !== 4 ||
        firstIndex.itemSize !== 4 ||
        Boolean(extra) !== Boolean(extraIndex) ||
        (extra &&
          (extra.count !== position.count ||
            extraIndex.count !== position.count ||
            extra.itemSize !== 4 ||
            extraIndex.itemSize !== 4))
      )
        throw invalid()
      // Bounded typed region masks avoid one Map/object per skinned vertex.
      const influence = new Map(
        program.regions.map((region) => [region.id, new Float32Array(position.count)]),
      )
      const boneRegions = new Map(
        program.regions.flatMap((region) => region.bones.map((bone) => [bone, region.id] as const)),
      )
      const weightSets = [[first, firstIndex], ...(extra ? [[extra, extraIndex]] : [])]
      for (let vertex = 0; vertex < position.count; vertex++) {
        let sum = 0
        for (const [weights, indices] of weightSets)
          for (let component = 0; component < 4; component++) {
            const weight = weights.getComponent(vertex, component),
              index = indices.getComponent(vertex, component)
            if (
              !Number.isFinite(weight) ||
              weight < 0 ||
              !Number.isInteger(index) ||
              index < 0 ||
              index >= palette.length
            )
              throw invalid()
            sum += weight
            const id = boneRegions.get(palette[index]),
              values = id === undefined ? undefined : influence.get(id)
            if (values) values[vertex] += weight
          }
        if (Math.abs(sum - 1) > 1e-5) throw invalid()
      }
      for (const region of program.regions) {
        if (!region.projection) continue
        const envelope = projectedSurfaceEnvelope(mesh, region.projection),
          values = influence.get(region.id)
        if (!values) throw invalid()
        let peak = projectedPeaks.get(region.id) ?? 0
        for (let vertex = 0; vertex < values.length; vertex++) {
          values[vertex] *= envelope[vertex]
          peak = Math.max(peak, values[vertex])
        }
        projectedPeaks.set(region.id, peak)
      }
      // FR-A-03: unequal authored influence peaks must not hide this aggregate region.
      // Normalize its colour only; preserve exact nonzero membership and all skin weights.
      for (const region of program.regions) {
        if (region.bones[0] !== OBSERVED_TRUNK_BINDING.bone) continue
        const values = influence.get(region.id)
        if (!values) throw invalid()
        let peak = 0
        for (const value of values) peak = Math.max(peak, value)
        trunkPeak = Math.max(trunkPeak, peak)
      }
      const geometry = originalGeometry.clone(),
        materials: Material[] = []
      const weights = new Float32BufferAttribute(new Float32Array(position.count), 1),
        tints = new Float32BufferAttribute(new Float32Array(position.count * 3), 3)
      const entry = {
        mesh,
        originalGeometry,
        originalMaterial,
        geometry,
        material: originalMaterial,
        materials,
        influence,
        weights,
        tints,
      }
      owned.push(entry)
      geometry.setAttribute('bodyguardFeedbackWeight', weights)
      geometry.setAttribute('bodyguardFeedbackTint', tints)
      const cloneMaterial = (base: Material) => {
        if (!(base as Material & { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial)
          throw invalid()
        const result = base.clone()
        materials.push(result)
        const compiler = base.onBeforeCompile,
          key = base.customProgramCacheKey()
        result.onBeforeCompile = (shader, renderer) => {
          compiler.call(result, shader, renderer)
          const patched = feedbackShader(shader.vertexShader, shader.fragmentShader)
          shader.vertexShader = patched.vertex
          shader.fragmentShader = patched.fragment
        }
        result.customProgramCacheKey = () => `${key}|bodyguard-surface-feedback-v1`
        return result
      }
      entry.material = Array.isArray(originalMaterial)
        ? originalMaterial.map(cloneMaterial)
        : cloneMaterial(originalMaterial)
      mesh.geometry = geometry
      mesh.material = entry.material
    })
    if (
      !owned.length ||
      [...projectedPeaks.values()].some((peak) => peak <= 0) ||
      (program.regions.some((region) => region.bones[0] === OBSERVED_TRUNK_BINDING.bone) &&
        trunkPeak <= 0)
    )
      throw invalid()
    // One model-wide colour scale preserves relative influence across submeshes.
    // Exact zero weights remain neutral; a tiny share is never amplified independently.
    const trunkId = program.regions.find(
      (region) => region.bones[0] === OBSERVED_TRUNK_BINDING.bone,
    )?.id
    if (trunkId)
      for (const entry of owned) {
        const values = entry.influence.get(trunkId)
        if (!values) throw invalid()
        for (let vertex = 0; vertex < values.length; vertex++) values[vertex] /= trunkPeak
      }
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) throw invalid()
  } catch (error) {
    dispose()
    if (error instanceof ResourceCleanupError) throw error
    throw invalid()
  }

  function observe(next: PoseCoverage | null, deferPaint = false) {
    if (closed || signal.aborted) return
    coverage = next
    pending = null
    dirty = true
    if (!deferPaint || !next) clear()
  }
  function update(frame: FeedbackFrame): boolean {
    if (closed || signal.aborted || !coverage) return false
    const current = coverage
    try {
      const suppliedGeneration = frame.generation,
        sequence = frame.sequence,
        at = frame.at,
        motionId = frame.motionId,
        version = frame.version
      if (
        suppliedGeneration !== generation ||
        current.generation !== generation ||
        sequence !== current.sequence ||
        sequence <= consumedSequence ||
        at !== current.at ||
        !time(at) ||
        at < lastNow - maxAgeMs ||
        motionId !== program.motionId ||
        version !== program.version
      )
        return false
      const requested = frame.errors
      if (!Array.isArray(requested) || requested.length > regions.size) throw invalid()
      const errors = requested.map((value) => ({
          regionId: value.regionId,
          severity: value.severity,
        })),
        seen = new Set<string>(),
        observed = new Set(current.bones)
      for (const value of errors) {
        const region = regions.get(value.regionId)
        if (
          !region ||
          seen.has(value.regionId) ||
          !['attention', 'deviation'].includes(value.severity) ||
          (region.projection === undefined
            ? region.bones.some((bone) => !observed.has(bone))
            : !current.projectedRegions?.includes(region.projection))
        )
          throw invalid()
        seen.add(value.regionId)
      }
      if (closed || signal.aborted || coverage !== current) return false
      consumedSequence = sequence
      pending = Object.freeze(errors.map((value) => Object.freeze({ ...value })))
      return true
    } catch {
      if (!closed && coverage === current) {
        pending = null
        clear()
      }
      return false
    }
  }
  function paint(errors: FeedbackFrame['errors']) {
    const key = JSON.stringify(errors.map(({ regionId, severity }) => [regionId, severity]))
    if (key === paintedKey) return
    for (const entry of owned) {
      entry.weights.array.fill(0)
      entry.tints.array.fill(0)
      for (const value of errors) {
        const influence = entry.influence.get(value.regionId),
          tint = value.severity === 'deviation' ? deviation : attention
        if (!influence) continue
        for (let vertex = 0; vertex < influence.length; vertex++) {
          const share = influence[vertex]
          entry.weights.array[vertex] += share
          entry.tints.array[vertex * 3] += tint.r * share
          entry.tints.array[vertex * 3 + 1] += tint.g * share
          entry.tints.array[vertex * 3 + 2] += tint.b * share
        }
      }
      for (let vertex = 0; vertex < entry.weights.count; vertex++) {
        const weight = entry.weights.getX(vertex)
        if (weight)
          for (let channel = 0; channel < 3; channel++)
            entry.tints.array[vertex * 3 + channel] /= weight
      }
      entry.weights.needsUpdate = true
      entry.tints.needsUpdate = true
    }
    active = Object.freeze(errors.map((value) => value.regionId))
    paintedKey = key
  }
  function render(now: number, observed = true) {
    if (!closed && (!time(now) || now < lastNow)) {
      coverage = null
      pending = null
      clear()
    }
    if (time(now) && now >= lastNow) lastNow = now
    if (!closed && coverage) {
      if (now - coverage.at > maxAgeMs) {
        pending = null
        clear()
      } else if (!observed || now < coverage.at) clear()
      else if (pending) {
        paint(pending)
        pending = null
      } else if (dirty) clear()
      dirty = false
    }
    return Object.freeze({
      status: closed ? 'closed' : active.length ? 'highlighting' : 'neutral',
      activeRegionIds: active,
    })
  }
  return Object.freeze({ observe, update, render, dispose })
}
