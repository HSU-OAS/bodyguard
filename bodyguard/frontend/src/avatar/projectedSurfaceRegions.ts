// FR-A-01/03·FR-M-07: fixed authored colour masks, NOT observed cervical/clavicle rotations.
import { Matrix4, type SkinnedMesh, Vector3 } from 'three'
export const PROJECTED_SURFACE_REGIONS = Object.freeze({
  'neck-head-line': Object.freeze(['neck01', 'neck02', 'neck03']),
  'shoulder-line': Object.freeze(['clavicleL', 'clavicleR', 'upperarm01L', 'upperarm01R']),
})
export type ProjectedSurfaceRegion = keyof typeof PROJECTED_SURFACE_REGIONS

/** Deform weights extend into the face/chest; bind-space feathering clips colour bleed
 * without moving a vertex or claiming to measure the named bones' rotations.
 */
export function projectedSurfaceEnvelope(mesh: SkinnedMesh, region: ProjectedSurfaceRegion) {
  const position = mesh.geometry.getAttribute('position'),
    bindPoint = (name: string) => {
      const index = mesh.skeleton.bones.findIndex((bone) => bone.name === name)
      if (
        index < 0 ||
        mesh.skeleton.bones.filter((bone) => bone.name === name).length !== 1 ||
        !mesh.skeleton.boneInverses[index].elements.every(Number.isFinite) ||
        mesh.skeleton.boneInverses[index].determinant() === 0
      )
        throw new Error('Invalid projected surface region')
      return new Vector3()
        .setFromMatrixPosition(new Matrix4().copy(mesh.skeleton.boneInverses[index]).invert())
        .applyMatrix4(mesh.bindMatrixInverse)
    },
    base = bindPoint('neck01'),
    middle = bindPoint('neck02'),
    top = bindPoint('neck03'),
    head = bindPoint('head'),
    left = bindPoint('upperarm01L'),
    right = bindPoint('upperarm01R'),
    up = top.clone().sub(base),
    neckLength = up.length(),
    lowerFeather = middle.distanceTo(base),
    upperFeather = head.distanceTo(top),
    across = left.clone().sub(right),
    shoulderSpan = across.length(),
    shoulder = left.clone().add(right).multiplyScalar(0.5)
  if (
    ![
      ...base.toArray(),
      ...middle.toArray(),
      ...top.toArray(),
      ...head.toArray(),
      ...left.toArray(),
      ...right.toArray(),
      neckLength,
      lowerFeather,
      upperFeather,
      shoulderSpan,
    ].every(Number.isFinite) ||
    Math.min(neckLength, lowerFeather, upperFeather, shoulderSpan) <= 0
  )
    throw new Error('Invalid projected surface region')
  up.divideScalar(neckLength)
  across.divideScalar(shoulderSpan)
  const shoulderHeight = base.clone().sub(shoulder).dot(up),
    collar = bindPoint('clavicleL').add(bindPoint('clavicleR')).multiplyScalar(0.5),
    neckStart = collar.clone().sub(base).dot(up),
    neckEnd = middle.clone().sub(base).dot(up)
  if (
    ![shoulderHeight, neckStart, neckEnd].every(Number.isFinite) ||
    shoulderHeight <= 0 ||
    neckStart >= neckEnd ||
    neckEnd <= 0 ||
    neckEnd >= neckLength ||
    !mesh.bindMatrixInverse.elements.every(Number.isFinite) ||
    mesh.bindMatrixInverse.determinant() === 0
  )
    throw new Error('Invalid projected surface region')
  const soft = (low: number, high: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)))
    return t * t * (3 - 2 * t)
  }
  const envelope = new Float32Array(position.count),
    point = new Vector3(),
    relative = new Vector3()
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i)
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z))
      throw new Error('Invalid projected surface region')
    if (region === 'neck-head-line') {
      const height = relative.copy(point).sub(base).dot(up)
      envelope[i] =
        soft(neckStart - lowerFeather, neckStart, height) * (1 - soft(neckEnd, neckLength, height))
    } else {
      relative.copy(point).sub(shoulder)
      // These fractions shape only the colour feather, not a body/clinical threshold.
      envelope[i] =
        soft(shoulderSpan / 6, shoulderSpan / 3, Math.abs(relative.dot(across))) *
        soft(-shoulderHeight / 2, 0, relative.dot(up))
    }
  }
  return envelope
}
