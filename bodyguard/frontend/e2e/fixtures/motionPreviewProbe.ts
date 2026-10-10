// TEST ONLY: preserved Blender fixture and GLBs, no camera, public route or clinical release.
import {
  AnimationMixer,
  type Bone,
  Color,
  DirectionalLight,
  HemisphereLight,
  LoopOnce,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { prepareOwnedAvatarPair } from '../../src/avatar/ownedAvatarPair'
import { createOwnedMotionPreview } from '../../src/avatar/ownedMotionPreview'
import { copyReferenceProgram } from '../../src/avatar/referencePlayback'
import { ResourceCleanupError } from '../../src/coaching/resources'
import { nativeReferenceProgram } from './nativeReferenceProgram'

export function mountMotionPreviewProbe() {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas')
  const trigger = document.querySelector<HTMLButtonElement>('#preview')
  const play = document.querySelector<HTMLButtonElement>('#play')
  if (!canvas || !trigger || !play) throw new Error('Private preview elements unavailable')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let generation = 0,
    loads = 0,
    releases = 0,
    frames = 0,
    live = 0,
    peak = 0,
    at = 0
  let signature = '',
    poster = '',
    gender: 'male' | 'female' = 'male',
    inactivePage = false,
    failNext = false,
    removed = false
  const ids = new Set<number>()
  const player = createOwnedMotionPreview({
    scheduler: {
      request(callback) {
        const id = requestAnimationFrame((now) => {
          ids.delete(id)
          callback(now)
        })
        ids.add(id)
        return id
      },
      cancel(id) {
        cancelAnimationFrame(id)
        ids.delete(id)
      },
    },
    async load(id, signal) {
      loads++
      if (failNext) {
        failNext = false
        throw new Error('Private fixture load failure')
      }
      const selected = id === 'female' ? 'female' : 'male'
      const context = { generation: ++generation, signal }
      const program = copyReferenceProgram(await nativeReferenceProgram(selected))
      // Fixture loader intentionally settles even after abort, so the controller must reclaim it.
      const pair = await prepareOwnedAvatarPair(
        { ...context, signal: new AbortController().signal },
        {
          load: async () =>
            (await new GLTFLoader().loadAsync(`/__private-native-${selected}.glb`)).scene,
          mirror: false,
          halfLifeMs: 30,
          maxAgeMs: 250,
        },
      )
      const model = pair.models?.[0],
        clip = program.steps[0].clips['seeking-target']
      if (!model) {
        pair.dispose()
        throw new Error('Private preview model unavailable')
      }
      const mixer = new AnimationMixer(model),
        action = mixer.clipAction(clip)
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      const scene = new Scene()
      scene.background = new Color('#f5f9fd')
      scene.add(model)
      scene.add(new HemisphereLight(0xffffff, 0xb8c8d8, 2.5))
      const key = new DirectionalLight(0xffffff, 3)
      key.position.set(2, 4, 3)
      scene.add(key)
      const camera = new OrthographicCamera(-0.82, 0.82, 1.15, -1.15, 0.01, 20)
      camera.position.set(0, 0.86, 4)
      camera.lookAt(0, 0.86, 0)
      let renderer: WebGLRenderer | undefined,
        released = false
      const close = () => {
        if (released) return
        released = true
        let bad = false
        for (const cleanup of [
          () => mixer.stopAllAction(),
          () => mixer.uncacheRoot(model),
          () => model.removeFromParent(),
          () => pair.dispose(),
          () => renderer?.dispose(),
        ]) {
          try {
            cleanup()
          } catch {
            bad = true
          }
        }
        releases++
        live--
        if (bad) throw new ResourceCleanupError()
      }
      live++
      peak = Math.max(peak, live)
      try {
        renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
        renderer.setSize(480, 680)
        renderer.setPixelRatio(1)
      } catch (error) {
        close()
        throw error
      }
      return {
        durationMs: clip.duration * 1000,
        draw(ms) {
          at = ms
          frames++
          action.reset().play()
          mixer.setTime(ms / 1000)
          model.updateMatrixWorld(true)
          const bones: string[] = []
          model.traverse((node) => {
            if ((node as Bone).isBone)
              bones.push(
                node.quaternion
                  .toArray()
                  .map((n) => n.toFixed(5))
                  .join(','),
              )
          })
          signature = bones.join(';')
          if (ms === 0) poster = signature
          if (!renderer) throw new Error('Private preview renderer unavailable')
          renderer.render(scene, camera)
        },
        dispose: close,
      }
    },
  })
  const pointer = () => player.update({ pointer: true })
  const leave = () => player.update({ pointer: false })
  const focus = () => player.update({ focus: true })
  const focusLeft = () => player.update({ focus: false })
  let manual = false
  const manualPlay = () => {
    manual = !manual
    player.update({ manual })
  }
  const visibility = () => player.update({ visible: !inactivePage && !document.hidden })
  const motion = () => player.update({ reducedMotion: reduced.matches })
  trigger.addEventListener('pointerenter', pointer)
  trigger.addEventListener('pointerleave', leave)
  trigger.addEventListener('focus', focus)
  trigger.addEventListener('focusout', focusLeft)
  play.addEventListener('click', manualPlay)
  document.addEventListener('visibilitychange', visibility)
  reduced.addEventListener('change', motion)
  motion()
  player.select(gender)
  return Object.freeze({
    snapshot: () => ({
      ...player.snapshot(),
      frames,
      loads,
      releases,
      live,
      peak,
      queued: ids.size,
      positionMs: at,
      poseIsPoster: signature === poster,
      removed,
      reducedMotion: reduced.matches,
    }),
    choose(next: 'male' | 'female') {
      gender = next
      manual = false
      player.select(next)
    },
    hide(value: boolean) {
      inactivePage = value
      visibility()
    },
    failNextLoad() {
      failNext = true
    },
    retry: player.retry,
    async remove() {
      removed = true
      trigger.removeEventListener('pointerenter', pointer)
      trigger.removeEventListener('pointerleave', leave)
      trigger.removeEventListener('focus', focus)
      trigger.removeEventListener('focusout', focusLeft)
      play.removeEventListener('click', manualPlay)
      document.removeEventListener('visibilitychange', visibility)
      reduced.removeEventListener('change', motion)
      await player.dispose()
    },
  })
}
