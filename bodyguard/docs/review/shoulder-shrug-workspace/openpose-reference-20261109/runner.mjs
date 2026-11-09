// Research-only adapter: no camera, raw coordinates, diagnosis or production thresholds.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
const input = '/private/tmp/bodyguard-real-shoulder-reference/corpus'
const output = '/private/tmp/bodyguard-real-shoulder-reference/aggregate.json'
assert(!existsSync(output), 'Never overwrite evidence')
const names = readdirSync(input).filter((n) => /^shouldershrug_(good|bad)_\d+\.npy$/.test(n)).sort()
assert.equal(names.length, 32)
const aggregate = {
  version: 1,
  source: 'stevenzchen/pose-trainer 7d54c527722c89feeb71d98ebd1ba585b0886338',
  disclaimers: [
    'OpenPose 18-keypoint model output is not actual joint ground truth or MediaPipe output',
    'Confidence fields differ between OpenPose and MediaPipe; 0.5 is an exploratory mapping',
    '1024x1024 pixel space preserves 2D distances but does not validate actual camera boundaries',
    'Author good/bad exercise labels are not independent expert posture annotations',
    'The classifier uses an arbitrary synthetic test profile, not validated clinical thresholds',
    'Single-frame seeking-target output is not a full repetition or correctness result',
  ],
  checksum: '',
  groups: {},
}
const checksum = createHash('sha256')
const mapping = [[0,0],[7,17],[8,16],[11,5],[12,2],[13,6],[14,3],[15,7],[16,4],[23,11],[24,8]]
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
try {
  const { observeShoulderShrug } = await server.ssrLoadModule('/src/posture/shoulderShrugObservation.ts')
  const { createShrugCandidateClassifier } = await server.ssrLoadModule('/src/stretch/shrugCandidateClassifier.ts')
  const { shrugCriteria } = await server.ssrLoadModule('/e2e/fixtures/shrugCandidate.ts')
  for (const name of names) {
    const bytes = readFileSync(resolve(input, name))
    checksum.update(name).update(bytes)
    assert.equal(bytes.subarray(0, 8).toString('hex'), '934e554d50590100')
    const headerLength = bytes.readUInt16LE(8), header = bytes.subarray(10, 10 + headerLength).toString('latin1')
    assert(header.includes("'descr': '<f8'") && header.includes("'fortran_order': False"))
    const match = /'shape':\s*\((\d+),\s*18,\s*3\)/.exec(header)
    assert(match)
    const samples = Number(match[1]), offset = 10 + headerLength
    assert.equal(bytes.length - offset, samples * 18 * 3 * 8)
    const key = name.includes('_good_') ? 'author_good' : 'author_bad'
    const group = aggregate.groups[key] ??= { files: 0, samples: 0, available: 0, unavailable: 0, classifications: {}, errors: {} }
    group.files++
    const classifier = createShrugCandidateClassifier(shrugCriteria(), 1)
    for (let sample = 0; sample < samples; sample++) {
      const points = Array.from({length:33}, () => undefined)
      for (const [target, source] of mapping) {
        const n = offset + (sample * 18 * 3 + source * 3) * 8
        const x = bytes.readDoubleLE(n), y = bytes.readDoubleLE(n+8), score = bytes.readDoubleLE(n+16)
        // No missing landmark is synthesized; zero-confidence points remain unusable.
        points[target] = { x: x/1024, y: y/1024, z: 0, visibility: score }
      }
      const at = sample + 1
      const frame = { generation:1, sequence:sample+1, at, image:{width:1024,height:1024,imageIsMirrored:false}, result:{landmarks:[points]} }
      const observation = observeShoulderShrug({frame, now:at, minimumConfidence:0.5, maxAgeMs:120})
      const decision = classifier.classify(frame, at, { stepId:'both', phase:'seeking-target' })
      group.samples++
      group[observation.status]++
      const category = decision?.classification ?? 'none'
      group.classifications[category] = (group.classifications[category] ?? 0) + 1
      for (const error of decision?.errors ?? []) group.errors[error] = (group.errors[error] ?? 0) + 1
    }
    classifier.close()
  }
  aggregate.checksum = checksum.digest('hex')
  writeFileSync(output, JSON.stringify(aggregate, null, 2), { flag:'wx' })
  console.log(JSON.stringify(aggregate, null, 2))
} finally {
  await server.close()
}
