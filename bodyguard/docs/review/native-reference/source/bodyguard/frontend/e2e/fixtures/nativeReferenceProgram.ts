// FR-S-03/04·FR-A-01/02: TEST ONLY reuse of preserved Blender fixture + unchanged GLB rest.
import { AnimationClip, Quaternion, QuaternionKeyframeTrack } from 'three'
import type { ReferenceProgram } from '../../src/avatar/referencePlayback'

type Sample = { seconds: number; bones: Record<string, number[]> }
export async function nativeReferenceProgram(gender: 'male' | 'female'): Promise<ReferenceProgram> {
  const [asset, authored] = await Promise.all([
    fetch(`/__private-native-${gender}.glb`).then((r) => r.arrayBuffer()),
    fetch('/__private-native-reference-fixture.json').then((r) => r.json()) as Promise<{
      fixture_not_release: boolean
      reports: { gender: string; phases: Record<string, Sample[]> }[]
    }>,
  ])
  const view = new DataView(asset)
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(16, true) !== 0x4e4f534a ||
    view.getUint32(8, true) !== asset.byteLength
  )
    throw new Error('Private native reference fixture unavailable')
  const document = JSON.parse(
    new TextDecoder().decode(new Uint8Array(asset, 20, view.getUint32(12, true))),
  ) as {
    nodes: { name?: string; rotation?: number[] }[]
  }
  const report = authored.reports.find((r) => r.gender === gender)
  if (!authored.fixture_not_release || !report)
    throw new Error('Private native reference fixture unavailable')
  const clips = Object.fromEntries(
    Object.entries(report.phases).map(([phase, samples]) => [
      phase,
      new AnimationClip(
        phase,
        1,
        Object.keys(samples[0].bones).map((raw) => {
          const matches = document.nodes.filter((n) => n.name === raw)
          if (matches.length !== 1) throw new Error('Private native reference fixture unavailable')
          const rest = new Quaternion().fromArray(matches[0].rotation ?? [0, 0, 0, 1])
          return new QuaternionKeyframeTrack(
            `${raw.replaceAll('.', '')}.quaternion`,
            samples.map((s) => s.seconds),
            samples.flatMap((s) =>
              rest
                .clone()
                .multiply(new Quaternion().fromArray(s.bones[raw]).normalize())
                .normalize()
                .toArray(),
            ),
          )
        }),
      ),
    ]),
  ) as ReferenceProgram['steps'][number]['clips']
  return {
    motionId: 'fixture-not-release',
    version: 'synthetic-session-only',
    blendMs: 120,
    maxAgeMs: 500,
    steps: [{ id: 'synthetic-hold', clips }],
  }
}
