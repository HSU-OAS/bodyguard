// FR-A-01/03·FR-S-03: actual own GLB data/CPU transforms, NOT clinical/WebGL proof.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type Bone, Box3, type Object3D } from 'three'
import { type GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { beforeAll, expect, it } from 'vitest'
import { assertBlenderReferenceBinding, blenderReferenceProgram } from './blenderReferenceProgram'
import { cloneEightWeightPair } from './eightWeightSkin'
import { type ReferenceMotion, referenceContentAsset } from './referenceContentAssets'
import { referenceFraming } from './referenceFraming'
import { createReferencePlayback } from './referencePlayback'

const bodies = new Map<string, GLTF>(),
  animations = new Map<string, GLTF>()
const motions: ReferenceMotion[] = ['neck-side', 'shoulder-shrug', 'arm-overhead']
function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('Fixture missing')
  return value
}
const fingerprint = (root: Object3D) => {
  const data: unknown[] = []
  root.traverse((node) => {
    if ((node as Bone).isBone)
      data.push([
        node.name,
        node.position.toArray(),
        node.quaternion.toArray(),
        node.scale.toArray(),
      ])
  })
  return JSON.stringify(data)
}
const parse = (bytes: Buffer) => new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '')
beforeAll(async () => {
  for (const gender of ['male', 'female'] as const) {
    const bytes = execFileSync(
      'git',
      [
        'show',
        `2be0ebe:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${gender}-candidate.glb`,
      ],
      { maxBuffer: 16_000_000 },
    )
    bodies.set(gender, await parse(bytes))
    for (const motion of motions) {
      const path = new URL(
        `../../../docs/review/blender-reference-content/animations/${gender}-${motion}.glb`,
        import.meta.url,
      )
      const raw = readFileSync(path),
        asset = referenceContentAsset(gender, motion)
      expect(raw.length).toBe(asset.bytes)
      expect(createHash('sha256').update(raw).digest('hex')).toBe(asset.sha256)
      animations.set(`${gender}/${motion}`, await parse(raw))
    }
  }
})

it.each(['male', 'female'])(
  '%s three actual Blender clips bind163 bones and complete phase transforms without touching user/source/structure',
  (gender) => {
    const body = required(bodies.get(gender))
    const restBounds = new Box3().setFromObject(body.scene, true)
    const bodyHeight = restBounds.max.y - restBounds.min.y
    const source = fingerprint(body.scene)
    for (const motion of motions) {
      const animation = required(animations.get(`${gender}/${motion}`))
      expect(assertBlenderReferenceBinding(body.scene, animation.scene)).toBe(163)
      const oldTracks = JSON.stringify(animation.animations[0].toJSON())
      const program = blenderReferenceProgram(motion, animation)
      const pair = cloneEightWeightPair(body.scene),
        [guide, user] = pair.copies
      const userBefore = fingerprint(user),
        abort = new AbortController()
      const player = createReferencePlayback(guide, {
        context: { generation: 1, signal: abort.signal },
        program,
      })
      let now = 0,
        sequence = 0
      for (const step of program.steps)
        for (const phase of [
          'waiting-start',
          'seeking-target',
          'holding',
          'waiting-return',
        ] as const) {
          const start = now,
            duration = step.clips[phase].duration * 1000
          do {
            expect(
              player.update({
                generation: 1,
                sequence: ++sequence,
                at: now,
                motionId: motion,
                version: program.version,
                stepId: step.id,
                phase,
                status: 'running',
              }),
            ).toBe(true)
            expect(player.render(now, 100).status).toBe('playing')
            now += 100
          } while (now - start < duration + 300)
          if (phase === 'seeking-target') expect(fingerprint(guide)).not.toBe(source)
          if (phase === 'holding') {
            const posed = new Box3().setFromObject(guide, true)
            for (const [width, height] of [
              [1288, 720],
              [640, 630],
            ]) {
              const f = referenceFraming(bodyHeight, width, height, 'full', motion)
              expect(posed.max.x + f.guideX).toBeLessThan(f.halfX - 0.01)
              expect(posed.min.x + f.guideX).toBeGreaterThan(-f.halfX + 0.01)
              expect(posed.max.y).toBeLessThan(restBounds.min.y + f.centerY + f.halfY - 0.01)
              expect(posed.min.y).toBeGreaterThan(restBounds.min.y + f.centerY - f.halfY + 0.01)
            }
          }
          if (phase === 'waiting-return') {
            const rotations: number[] = []
            guide.traverse((node) => {
              if ((node as Bone).isBone)
                rotations.push(
                  node.quaternion.angleTo(
                    required(body.scene.getObjectByName(node.name)).quaternion,
                  ),
                )
            })
            expect(Math.max(...rotations)).toBeLessThan(0.001)
          }
          expect(fingerprint(user)).toBe(userBefore)
        }
      expect(fingerprint(body.scene)).toBe(source)
      expect(JSON.stringify(animation.animations[0].toJSON())).toBe(oldTracks)
      abort.abort()
      expect(player.render(now, 0).status).toBe('closed')
      pair.dispose()
    }
  },
)

function editable() {
  const original = required(animations.get('male/neck-side'))
  return {
    ...original,
    scene: original.scene.clone(true),
    animations: original.animations.map((clip) => clip.clone()),
  }
}
it('rejects wrong/missing/duplicate content rather than inventing a reference', () => {
  expect(() => blenderReferenceProgram('unknown' as ReferenceMotion, editable())).toThrow()
  const absent = editable()
  absent.animations = []
  expect(() => blenderReferenceProgram('neck-side', absent)).toThrow()
  const duplicate = editable()
  duplicate.animations[0].tracks[0].name = duplicate.animations[0].tracks[1].name
  expect(() => blenderReferenceProgram('neck-side', duplicate)).toThrow()
})
it('rejects translation changes/nonfinite keys and mismatched body rest bindings', () => {
  const moved = editable(),
    track = required(moved.animations[0].tracks.find((item) => item.name.endsWith('.position')))
  track.values[0] += 0.1
  expect(() => blenderReferenceProgram('neck-side', moved)).toThrow()
  const corrupt = editable()
  corrupt.animations[0].tracks[0].times[0] = Number.NaN
  expect(() => blenderReferenceProgram('neck-side', corrupt)).toThrow()
  const rest = editable()
  required(rest.scene.getObjectByName('head')).position.x += 0.1
  expect(() =>
    assertBlenderReferenceBinding(required(bodies.get('male')).scene, rest.scene),
  ).toThrow()
})
it('retains the actual female export static scale instead of discarding its values', () => {
  const animation = required(animations.get('female/neck-side'))
  const source = required(animation.animations[0].tracks.find((t) => t.name === 'tongue01.scale'))
  const program = blenderReferenceProgram('neck-side', animation)
  const retained = required(
    program.steps[0].clips.holding.tracks.find((t) => t.name === source.name),
  )
  expect(Array.from(retained.values.slice(0, 3))).toEqual(Array.from(source.values.slice(0, 3)))
})
