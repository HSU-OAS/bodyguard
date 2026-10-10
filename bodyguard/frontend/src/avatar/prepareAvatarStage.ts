import type { Camera, Scene } from 'three'

type Renderer = Readonly<{
  compileAsync: (scene: Scene, camera: Camera) => Promise<unknown>
  render: (scene: Scene, camera: Camera) => void
}>

// FR-A-02/NFR-07/08: borrowed scene/renderer readiness, not capture or coaching progress.
// Configure lighting/models first. The caller owns disposal and awaits pending preparation.
export async function prepareAvatarStage(
  renderer: Renderer,
  scene: Scene,
  camera: Camera,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted()
  await renderer.compileAsync(scene, camera)
  signal.throwIfAborted()
  renderer.render(scene, camera)
  signal.throwIfAborted()
}
