import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { SkinnedMesh } from 'three'
import { eightWeightGeometry as baseline } from '../../src/avatar/localEightWeightBaseline'
import { eightWeightGeometry as trial } from '../../src/avatar/eightWeightSkin'

export async function runWeightBench() {
  const result = []
  for (const gender of ['male', 'female']) {
    const scene = (await new GLTFLoader().loadAsync(`/__bodyguard/review-avatar/${gender}.glb`)).scene
    let mesh: SkinnedMesh | undefined
    scene.traverse((node) => { const m = node as SkinnedMesh; if (m.isSkinnedMesh && m.geometry.hasAttribute('weights_1')) mesh = m })
    if (!mesh) throw new Error('Eight-weight mesh missing')
    const geometry = mesh.geometry, boneCount = mesh.skeleton.bones.length
    const a = baseline(geometry, boneCount), b = trial(geometry, boneCount)
    const attrA = a.getAttribute('skinWeight'), attrB = b.getAttribute('skinWeight')
    let equal = attrA.count === attrB.count
    for (let i = 0; i < attrA.count && equal; i++) for (let j = 0; j < 4; j++) if (!Object.is(attrA.getComponent(i,j), attrB.getComponent(i,j))) equal = false
    a.dispose(); b.dispose()
    if (!equal) throw new Error('Normalized weights differ')
    const durations: Record<string, number[]> = { baseline: [], trial: [] }
    for (let round = 0; round < 10; round++) {
      for (const name of (round % 2 ? ['trial','baseline'] : ['baseline','trial'])) {
        const start = performance.now()
        const output = (name === 'baseline' ? baseline : trial)(geometry, boneCount)
        const elapsed = performance.now() - start
        output.dispose()
        if (round >= 2) durations[name].push(elapsed)
      }
    }
    result.push({gender, vertices: geometry.getAttribute('position').count, boneCount, normalizedWeightsExactlyEqual: equal, durations})
  }
  return result
}
