// FR-A-02/08: repeatable read-only integrity and bounded QA assertions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../../../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file)));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = read('copy-manifest.json');
const record = read('execution-record.json');
assert.equal(manifest.old_files_changed, 0);
assert.equal(manifest.copies.length, 101);
assert.equal(new Set(manifest.copies.map(row => row.file)).size, 101);
assert.equal(manifest.copies.filter(row => row.file.endsWith('.gz')).length, 12);
assert.equal(manifest.copies.filter(row => row.file.endsWith('.png')).length, 78);
for (const row of manifest.copies) {
  const bytes = fs.readFileSync(path.join(__dirname, row.file));
  assert.equal(bytes.length, row.bytes);
  assert.equal(sha(bytes), row.sha256);
  assert.equal(sha(row.file.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes), row.decoded_sha256);
  if (row.file.endsWith('.png')) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0);
  }
}
for (const row of [record.source, ...record.unchanged_files]) {
  const bytes = fs.readFileSync(path.join(root, row.file));
  assert.equal(sha(bytes), row.sha256);
  if (row.bytes !== undefined) assert.equal(bytes.length, row.bytes);
}
for (const name of ['candidate-a103-review', 'candidate-a104-a105-diagnosis']) {
  const directory = path.join(__dirname, '..', name);
  const prior = JSON.parse(fs.readFileSync(path.join(directory, 'copy-manifest.json')));
  for (const row of prior.copies) assert.equal(sha(fs.readFileSync(path.join(directory, row.file))), row.sha256);
}
const merit = read('merit-topology.json');
const fair = read('local-fairing.json');
const saved = read('saved-preservation.json');
assert.deepEqual(merit.rows.map(row => row.accepted_native_rotations), [10, 4]);
assert.deepEqual(merit.rows.map(row => row.long_folds_after), [10, 18]);
assert.equal(fair.candidate_sha256, record.source.sha256);
assert.equal(fair.candidate_saved, true);
assert.equal(fair.input_source_saved, false);
assert.deepEqual(fair.rows.map(row => row.before.long_folds), [10, 18]);
assert.deepEqual(fair.rows.map(row => row.after.long_folds), [8, 16]);
assert.deepEqual(fair.rows.map(row => row.brush_vertices), [458, 598]);
assert(saved.passed);
assert.deepEqual(saved.rows.map(row => row.outside_vertices_exact), [141233, 138884]);
assert.deepEqual(saved.rows.map(row => row.protected_hands_exact), [50689, 50673]);
for (const row of saved.rows) {
  assert(row.maximum_displacement_m > 0 && row.maximum_displacement_m < 0.006);
  assert(row.all_named_skin_groups_bones_head_tail_parents_matrices_exact);
  assert(row.outside_coordinates_face_winding_exact);
  assert.equal(row.whole_topology_unchanged, false);
}
for (const name of ['source-deformation-report.json', 'roundtrip-deformation-report.json']) {
  const report = read(name);
  assert(report.passed && report.rendered && report.candidate);
  assert.equal(report.checks.length, 121);
  const poses = report.checks.filter(row => row.edge_ratio_max !== undefined);
  assert.equal(poses.length, 118);
  for (const row of poses) assert(Number.isFinite(row.edge_ratio_max) && row.edge_ratio_max < 3);
}
const exp = read('export-report.json');
assert.equal(exp.ratio, 1);
assert.equal(exp.maximum_skin_influences, 8);
assert(exp.transforms_passed);
for (const row of exp.checks) {
  assert.equal(row.meshes, 5);
  assert.equal(row.images, 0);
  assert.equal(row.animations, 0);
}
const browser = read('browser-report.json');
assert.equal(browser.stats.expected, 4);
assert.equal(browser.stats.unexpected + browser.stats.flaky + browser.stats.skipped, 0);
const specs = browser.suites.flatMap(suite => suite.specs);
assert.equal(specs.length, 4);
for (const spec of specs) {
  assert(spec.ok);
  assert.equal(spec.tests.length, 1);
  assert.equal(spec.tests[0].results.length, 1);
  const result = spec.tests[0].results[0];
  assert.equal(result.status, 'passed');
  for (const attachment of result.attachments) {
    if (!attachment.body) continue;
    const value = JSON.parse(Buffer.from(attachment.body, 'base64'));
    if (attachment.name.endsWith('-native-asset')) {
      const row = manifest.copies.find(row => row.file === value.filename);
      assert(row);
      assert.equal(value.sha256, row.sha256);
      assert.equal(value.bytes, row.bytes);
      assert(value.eightWeightPrimitives > 0);
    } else if (attachment.name.endsWith('-technical-render')) {
      assert.equal(value.samples, 180);
      assert(value.skeletons_independent);
      assert(value.static_angle_max < 0.00001 && value.moving_angle_max > 0.1);
      assert.equal(value.eight_weight_meshes, 2);
      assert(Number.isFinite(value.mean_ms) && Number.isFinite(value.p95_ms));
    } else if (attachment.name.endsWith('-camera-only-frame')) {
      assert.equal(value.length, 10);
      assert(value.every(row => row.visible && row.vertices > 0));
    }
  }
}
assert.equal(record.runs.length, 6);
for (const run of record.runs) assert.equal(run.exit_code, 0);
assert.equal(record.actual_png, 78);
assert.equal(record.directly_viewed_png, record.viewed_files.length);
assert.equal(new Set(record.viewed_files).size, record.viewed_files.length);
for (const file of record.viewed_files) assert(manifest.copies.some(row => row.file === file));
for (const key of ['human_camera_capture', 'human_coordinate_collection', 'appearance_passed', 'adopted', 'release_approved', 'stages_1_to_6_complete', 'pr9_merge_allowed']) assert.equal(record[key], false);
assert.equal(record.review.existing_appearance_p2.length, 2);
assert.equal(record.verification.restored_frontend_typecheck_exit, 0);
assert.equal(record.verification.restored_frontend_biome_exit, 0);
for (const file of ['README.md', '../../../../docs/avatar-production.md', '../../../../docs/stories/stage2-avatar-candidate.md']) {
  const absolute = path.resolve(__dirname, file);
  for (const match of fs.readFileSync(absolute, 'utf8').matchAll(/\]\(([^\s)]+)\)/g)) {
    if (!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(absolute), match[1].split('#')[0])), match[1]);
  }
}
console.log(JSON.stringify({integrity_passed: true, copies: 101, gzip: 12, actual_png: 78, directly_viewed: record.viewed_files.length, source_and_roundtrip_poses: [118, 118], Chrome: 4, appearance_passed: false}));
