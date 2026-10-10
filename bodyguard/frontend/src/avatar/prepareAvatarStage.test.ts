// FR-A-02/NFR-07/08: borrowed renderer readiness; actual GPU is verified separately.
import { Camera, Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { prepareAvatarStage } from './prepareAvatarStage'

const setup = () => {
  const scene = new Scene(),
    camera = new Camera(),
    abort = new AbortController()
  const renderer = {
    compileAsync: vi.fn(async () => {}),
    render: vi.fn(),
    dispose: vi.fn(),
  }
  const prepare = () => prepareAvatarStage(renderer, scene, camera, abort.signal)
  return { scene, camera, abort, renderer, prepare }
}
describe('borrowed avatar stage preparation', () => {
  it('awaits compilation before the same-scene upload and borrows the renderer', async () => {
    const f = setup()
    let release!: () => void
    f.renderer.compileAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const preparing = f.prepare()
    expect(f.renderer.compileAsync).toHaveBeenCalledWith(f.scene, f.camera)
    expect(f.renderer.render).not.toHaveBeenCalled()
    release()
    await preparing
    expect(f.renderer.render).toHaveBeenCalledExactlyOnceWith(f.scene, f.camera)
    expect(f.renderer.dispose).not.toHaveBeenCalled()
  })
  it('does not touch a retired scene before compilation', async () => {
    const f = setup()
    f.abort.abort()
    await expect(f.prepare()).rejects.toMatchObject({ name: 'AbortError' })
    expect(f.renderer.compileAsync).not.toHaveBeenCalled()
    expect(f.renderer.render).not.toHaveBeenCalled()
  })
  it('does not draw when compilation completes after retirement', async () => {
    const f = setup()
    let release!: () => void
    f.renderer.compileAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const preparing = f.prepare()
    f.abort.abort()
    release()
    await expect(preparing).rejects.toMatchObject({ name: 'AbortError' })
    expect(f.renderer.render).not.toHaveBeenCalled()
    expect(f.renderer.dispose).not.toHaveBeenCalled()
  })
  it.each(['sync', 'async'] as const)('propagates %s compile failure', async (mode) => {
    const f = setup(),
      error = new Error('private compile failure')
    f.renderer.compileAsync.mockImplementationOnce(
      mode === 'sync'
        ? () => {
            throw error
          }
        : async () => {
            throw error
          },
    )
    await expect(f.prepare()).rejects.toBe(error)
    expect(f.renderer.render).not.toHaveBeenCalled()
    expect(f.renderer.dispose).not.toHaveBeenCalled()
  })
  it('propagates draw failure without claiming renderer ownership', async () => {
    const f = setup(),
      error = new Error('private upload failure')
    f.renderer.render.mockImplementationOnce(() => {
      throw error
    })
    await expect(f.prepare()).rejects.toBe(error)
    expect(f.renderer.dispose).not.toHaveBeenCalled()
  })
  it('does not return ready if the caller retires during upload', async () => {
    const f = setup()
    f.renderer.render.mockImplementationOnce(() => f.abort.abort())
    await expect(f.prepare()).rejects.toMatchObject({ name: 'AbortError' })
    expect(f.renderer.dispose).not.toHaveBeenCalled()
  })
})
