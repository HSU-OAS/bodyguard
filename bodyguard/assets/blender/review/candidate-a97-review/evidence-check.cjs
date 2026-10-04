// A-02/A-08: reuse the stdlib evidence check; technical PASS is not appearance approval.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), zlib = require('node:zlib')
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name)))
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const root = path.resolve(__dirname, '../../../../..'), manifest = read('copy-manifest.json'), record = read('execution-record.json')
assert.equal(manifest.old_files_changed, 0)
assert.equal(manifest.copies.length, 93)
assert.equal(new Set(manifest.copies.map(x => x.file)).size, 93)
for (const item of manifest.copies) {
  const bytes = fs.readFileSync(path.join(__dirname, item.file))
  assert.equal(bytes.length, item.bytes)
  assert.equal(sha(bytes), item.sha256)
  assert.equal(sha(item.file.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes), item.decoded_sha256)
  if (item.file.endsWith('.png')) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
}
assert.equal(manifest.copies.filter(x => x.file.endsWith('.png')).length, 76)
assert.equal(manifest.copies.filter(x => x.file.endsWith('.gz')).length, 7)
for (const [prefix, count] of [['source/', 34], ['import/', 34], ['first/', 4], ['browser/', 4]]) assert.equal(manifest.copies.filter(x => x.file.startsWith(prefix) && x.file.endsWith('.png')).length, count)
assert.equal(record.directly_viewed.length, 20)
assert.equal(new Set(record.directly_viewed).size, 20)
for (const file of record.directly_viewed) assert(manifest.copies.some(x => x.file === file))
for (const item of [...record.unchanged_files, record.candidate]) {
  const bytes = fs.readFileSync(path.join(root, item.file))
  assert.equal(sha(bytes), item.sha256)
  if (item.bytes != null) assert.equal(bytes.length, item.bytes)
}
const localization = read('localization.json')
assert.equal(localization.source_saved, false)
assert.equal(localization.coordinates_changed, false)
assert.equal(localization.rows.length, 4)
for (const row of localization.rows) {
  assert.equal(row.bad_faces_touching_protected_hand, 0)
  assert(row.bad_longitudinal_min_m >= -.080001 && row.bad_longitudinal_max_m <= .009001)
}
const memory = read('memory-topology.json'), native = read('native-connectivity.json'), preserved = read('saved-preservation.json')
assert.deepEqual(memory.rows, native.rows)
assert.equal(memory.new_assets, 0)
assert.equal(native.new_assets, 1)
assert.equal(memory.appearance_approved, false)
assert.equal(native.appearance_approved, false)
assert(preserved.passed)
assert.equal(preserved.full_deformation_qa, false)
assert.equal(preserved.appearance_approved, false)
assert.equal(preserved.rows.length, 2)
for (const [index, row] of preserved.rows.entries()) {
  assert.equal(row.bones, 163)
  assert.equal(row.geometry_displacement_m, 0)
  assert(row.coordinates_named_skin_hands_rest_bones_matrices_outside_connectivity_exact)
  assert.equal(row.added_edges_faces, [1656, 1632][index])
  assert.equal(row.local_faces_added - row.local_faces_removed, row.added_edges_faces)
  assert.equal(native.rows[index].beautified.nonmanifold, 0)
  assert(native.rows[index].coordinates_skin_outside_faces_preserved)
}
for (const item of [record.unchanged_files[0], record.candidate]) assert.equal(preserved.inputs_sha256[item.file], item.sha256)
for (const [file, max] of [['source-deformation.json', record.deformation.source_max_edge_ratio], ['roundtrip-deformation.json', record.deformation.reimport_max_edge_ratio]]) {
  const qa = read(file), poses = qa.checks.filter(x => x.edge_ratio_max != null)
  assert(qa.candidate && qa.rendered && qa.passed)
  assert.deepEqual(qa.failures, [])
  assert.equal(qa.checks.length, 121)
  assert.equal(poses.length, 118)
  assert.equal(Math.max(...poses.map(x => x.edge_ratio_max)), max)
  assert(poses.every(x => Number.isFinite(x.edge_ratio_max) && x.edge_ratio_max <= 3))
  for (const row of qa.checks.filter(x => x.surface)) assert(row.components === 1 && row.non_manifold === 0 && row.unnormalized === 0)
  assert.equal(qa.checks[0].surface_style, 'unified-white-mannequin')
  assert.deepEqual(qa.checks[0].garments, [])
}
const glb = read('glb-roundtrip.json')
assert(glb.transforms_passed)
assert.equal(glb.ratio, 1)
assert.equal(glb.maximum_skin_influences, 8)
assert.equal(glb.geometry_deformation_pending, true) // Historical export result; later QA is separate.
for (const row of glb.checks) {
  assert.equal(row.meshes, 5)
  assert.equal(row.animations, 0)
  assert.equal(row.images, 0)
}
const results = suite => (suite.specs || []).flatMap(x => x.tests.flatMap(t => t.results)).concat((suite.suites || []).flatMap(results))
const browser = read('browser-report.json'), runs = results(browser), attachments = runs.flatMap(x => x.attachments || [])
assert.deepEqual(browser.stats, record.browser)
assert.deepEqual(browser.errors, [])
assert.equal(runs.length, 4)
assert(runs.every(x => x.status === 'passed' && x.errors.length === 0))
for (const attachment of attachments.filter(x => x.name.endsWith('-native-asset'))) {
  const asset = JSON.parse(Buffer.from(attachment.body, 'base64')), item = manifest.copies.find(x => x.file === asset.filename)
  assert(item)
  assert.equal(asset.sha256, item.sha256)
  assert.equal(asset.bytes, item.bytes)
  assert.equal(asset.eightWeightPrimitives, 1)
}
const frames = attachments.filter(x => x.name.endsWith('-camera-only-frame'))
assert.equal(frames.length, 2)
for (const attachment of frames) {
  const rows = JSON.parse(Buffer.from(attachment.body, 'base64'))
  assert.equal(rows.length, 10)
  assert(rows.every(x => x.visible && x.vertices > 0))
}
const timing = attachments.filter(x => x.name.endsWith('-technical-render'))
assert.equal(timing.length, 2)
for (const attachment of timing) {
  const row = JSON.parse(Buffer.from(attachment.body, 'base64'))
  assert.equal(row.samples, 180)
  assert(row.skeletons_independent && row.static_angle_max === 0 && row.moving_angle_max > 0)
}
assert(record.runs.every(x => x.exit_code === 0))
assert.equal(record.style.memory_topology_ruff_exit, 1)
assert.equal(record.style.localization_initial_ruff_exit, 1)
for (const key of ['producer_ruff_exit', 'preservation_ruff_exit', 'new_three_scripts_ruff_check_exit', 'new_three_scripts_isolated_88_format_check_exit', 'temporary_typecheck_exit', 'listener_typecheck_exit', 'biome_check_exit', 'restored_typecheck_exit', 'copy_script_syntax_exit']) assert.equal(record.style[key], 0)
assert(record.temporary_test_helpers_restored)
assert(!fs.existsSync(path.join(root, 'bodyguard/frontend/e2e/a97-frame-client.ts')))
assert.equal(record.new_blend_files, 1)
assert.equal(record.new_glb_files, 2)
assert(record.new_full_deformation_qa)
for (const key of ['human_camera_capture', 'human_coordinate_collection', 'appearance_passed', 'adopted', 'release_approved', 'stages_1_to_6_complete', 'pr9_merge_allowed']) assert.equal(record[key], false)
for (const file of [path.join(root, 'bodyguard/docs/avatar-production.md'), path.join(root, 'bodyguard/docs/stories/stage2-avatar-candidate.md'), path.join(__dirname, 'README.md')]) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^\s)]+)\)/g)) {
    if (!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(file), match[1].split('#')[0])), match[1])
  }
}
console.log(JSON.stringify({integrity_passed:true, copies:93, png:76, directly_viewed:20, source_poses:118, reimport_poses:118, Chrome:4, old_files_changed:0, appearance_passed:false, adopted:false}))
