// @vitest-environment happy-dom
// FR-A-01/03·NFR-08: renderer/loader faults only, not real model or body accuracy.
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createHeadRotationRig } from './headOrientationRig'
import { createObservedHandRig } from './observedHandRig'
import { prepareOwnedAvatarPair } from './ownedAvatarPair'
import { REVIEW_AVATAR_ASSETS } from './reviewAvatarAssets'
import { prepareWorkspaceAvatar } from './workspaceAvatar'

const gpu = vi.hoisted(() => ({
  instances: [] as Record<string, ReturnType<typeof vi.fn>>[],
  draws: [] as unknown[],
  compile: undefined as Promise<void> | undefined,
}))
const parser = vi.hoisted(() => ({ parse: vi.fn() }))
vi.mock('three', async (original) => ({
  ...(await original<typeof import('three')>()),
  WebGLRenderer: class {
    constructor() {
      const instance = Object.fromEntries(
        [
          'setPixelRatio',
          'setSize',
          'setViewport',
          'setScissor',
          'setScissorTest',
          'clear',
          'dispose',
          'compileAsync',
        ].map((key) => [key, vi.fn()]),
      )
      instance.compileAsync.mockImplementation(() => gpu.compile ?? Promise.resolve())
      instance.render = vi.fn((scene, camera) => {
        gpu.draws.push({
          visible: scene.children
            .filter((n: Group) => n.name === 'reference' || n.name === 'user')
            .map((n: Group) => [n.name, n.visible]),
          top: camera.top,
          bottom: camera.bottom,
        })
      })
      gpu.instances.push(instance)
      Object.assign(this, instance)
    }
  },
}))
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    parseAsync = parser.parse
  },
}))
vi.mock('./ownedAvatarPair', () => ({ prepareOwnedAvatarPair: vi.fn() }))
const details = vi.hoisted(() => ({
  head: { push: vi.fn(), render: vi.fn(), dispose: vi.fn() },
  hands: { push: vi.fn(), render: vi.fn(), dispose: vi.fn() },
}))
vi.mock('./headOrientationRig', async (original) => ({
  ...(await original<typeof import('./headOrientationRig')>()),
  createHeadRotationRig: vi.fn(() => details.head),
}))
vi.mock('./observedHandRig', async (original) => ({
  ...(await original<typeof import('./observedHandRig')>()),
  createObservedHandRig: vi.fn(() => details.hands),
}))
function fixture() {
  const models = ['reference', 'user'].map((name) => {
    const root = new Group()
    root.name = name
    const mesh = new Mesh(new BoxGeometry(0.5, 1.7, 0.2), new MeshStandardMaterial())
    mesh.position.y = 0.85
    root.add(mesh)
    return root
  })
  const pair = { models, observe: vi.fn(() => true), render: vi.fn(), dispose: vi.fn() }
  vi.mocked(prepareOwnedAvatarPair).mockImplementation(async (context, options) => {
    await options.load(context)
    return pair as unknown as Awaited<ReturnType<typeof prepareOwnedAvatarPair>>
  })
  const canvas = document.createElement('canvas')
  Object.defineProperties(canvas, { clientWidth: { value: 1000 }, clientHeight: { value: 500 } })
  const abort = new AbortController()
  const onFailure = vi.fn()
  return {
    pair,
    canvas,
    abort,
    onFailure,
    start: () =>
      prepareWorkspaceAvatar(
        { generation: 7, signal: abort.signal },
        { canvas, gender: 'male', onFailure },
      ),
  }
}
beforeEach(() => {
  gpu.instances.length = 0
  gpu.draws.length = 0
  gpu.compile = undefined
  parser.parse.mockResolvedValue({ scene: new Group() })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('synthetic-bytes')),
  )
  vi.stubGlobal('crypto', {
    subtle: {
      digest: vi.fn(
        async () =>
          Uint8Array.from(REVIEW_AVATAR_ASSETS.male.sha256.match(/../g) ?? [], (x) =>
            Number.parseInt(x, 16),
          ).buffer,
      ),
    },
  })
  vi.stubGlobal('devicePixelRatio', 2)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
})
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('requires an explicit request and a subsequently captured frame for head alignment', async () => {
  const f = fixture(),
    view = await f.start()
  const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const observation = (sequence: number, at: number) => ({
    generation: 7,
    sequence,
    at,
    result: { landmarks: [body], worldLandmarks: [body], headOrientation: [0, 0, 0, 1] },
  })
  view.observe(observation(1, 90))
  expect(createHeadRotationRig).not.toHaveBeenCalled()
  vi.spyOn(performance, 'now').mockReturnValue(100)
  expect(view.alignOnNextFrame()).toBe(true)
  view.observe(observation(2, 99))
  expect(createHeadRotationRig).not.toHaveBeenCalled()
  view.observe(observation(3, 100))
  expect(createHeadRotationRig).toHaveBeenCalledExactlyOnceWith(
    f.pair.models[1],
    expect.objectContaining({ cameraReference: [0, 0, 0, 1], mirror: true }),
  )
  expect(createObservedHandRig).not.toHaveBeenCalled()
  expect(view.getAlignmentStatus()).toBe('partial')
  expect(details.head.push).toHaveBeenLastCalledWith(
    expect.objectContaining({ sequence: 3, rotation: [0, 0, 0, 1] }),
  )
  view.observe({
    ...observation(4, 110),
    result: { landmarks: [], worldLandmarks: [], headOrientation: [0, 0, 0, 1] },
  })
  expect(details.head.push).toHaveBeenLastCalledWith(
    expect.objectContaining({ sequence: 4, rotation: null }),
  )
  view.render(110, 10, 'full')
  expect(details.head.render).toHaveBeenCalledWith(110, 10)
  f.abort.abort()
  view.dispose()
  expect(details.head.dispose).toHaveBeenCalledTimes(1)
  expect(view.alignOnNextFrame()).toBe(false)
})

it('expires a requested alignment without a fresh frame instead of waiting forever or auto-retrying', async () => {
  const f = fixture(),
    view = await f.start()
  vi.spyOn(performance, 'now').mockReturnValue(100)
  view.alignOnNextFrame()
  view.render(1101, 16, 'full')
  expect(view.getAlignmentStatus()).toBe('unavailable')
  expect(createHeadRotationRig).not.toHaveBeenCalled()
  view.dispose()
})

it('renders one shared canvas as independent left-user/right-reference viewports and disposes once', async () => {
  const f = fixture(),
    view = await f.start()
  expect(fetch).toHaveBeenCalledWith(
    REVIEW_AVATAR_ASSETS.male.url,
    expect.objectContaining({ signal: f.abort.signal, credentials: 'omit' }),
  )
  expect(gpu.instances[0].setSize).toHaveBeenCalledWith(1000, 500, false)
  expect(gpu.draws.at(-1)).toEqual(
    expect.objectContaining({
      visible: [
        ['reference', true],
        ['user', true],
      ],
    }),
  )
  const full = (gpu.draws.at(-1) as { top: number }).top
  view.render(100, 16, 'detail')
  expect(gpu.draws.slice(-2)).toEqual([
    expect.objectContaining({
      visible: [
        ['reference', false],
        ['user', true],
      ],
    }),
    expect.objectContaining({
      visible: [
        ['reference', true],
        ['user', false],
      ],
    }),
  ])
  expect((gpu.draws.at(-1) as { top: number }).top).toBeLessThan(full)
  expect(f.pair.render).toHaveBeenCalledWith(100, 16)
  expect(f.pair.models.every((m) => m.visible)).toBe(true)
  expect(f.pair.models[0].position.x).toBeGreaterThan(0)
  expect(f.pair.models[1].position.x).toBeLessThan(0)
  const frame = {
    generation: 7,
    sequence: 1,
    at: 100,
    result: { landmarks: [], worldLandmarks: [] },
  }
  view.observe(frame)
  expect(f.pair.observe).toHaveBeenCalledWith(frame)
  f.abort.abort()
  view.dispose()
  expect(f.pair.dispose).toHaveBeenCalledTimes(1)
  expect(gpu.instances[0].dispose).toHaveBeenCalledTimes(1)
  expect(view.observe(frame)).toBe(false)
})

it('rejects a changed GLB before parsing or creating a renderer, without exposing bytes/errors', async () => {
  const f = fixture()
  vi.mocked(crypto.subtle.digest).mockResolvedValue(new Uint8Array(32).buffer)
  await expect(f.start()).rejects.toThrow('Workspace avatar unavailable')
  expect(parser.parse).not.toHaveBeenCalled()
  expect(gpu.instances).toHaveLength(0)
})

it('waits for in-flight shader preparation after abort and reclaims the late pair/renderer', async () => {
  const f = fixture()
  let finish!: () => void
  gpu.compile = new Promise<void>((resolve) => {
    finish = resolve
  })
  const loading = f.start()
  await vi.waitFor(() => expect(gpu.instances).toHaveLength(1))
  const rejected = expect(loading).rejects.toThrow('Workspace avatar unavailable')
  f.abort.abort()
  expect(gpu.instances[0].dispose).not.toHaveBeenCalled()
  finish()
  await rejected
  expect(f.pair.dispose).toHaveBeenCalledTimes(1)
  expect(gpu.instances[0].dispose).toHaveBeenCalledTimes(1)
})

it('notifies context loss without automatic camera/renderer restart', async () => {
  const f = fixture(),
    view = await f.start()
  f.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(f.onFailure).toHaveBeenCalledTimes(1)
  expect(gpu.instances).toHaveLength(1)
  view.dispose()
  f.canvas.dispatchEvent(new Event('webglcontextlost'))
  expect(f.onFailure).toHaveBeenCalledTimes(1)
})
