// FR-A-02/08: bounded authored-mesh diagnosis is not release approval.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../../../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = read('copy-manifest.json');
const record = read('execution-record.json');
const intersection = read('posterior-intersections.json');
const merit = read('merit-topology.json');
assert.equal(manifest.old_files_changed, 0);
assert.equal(manifest.copies.length, 11);
assert.equal(new Set(manifest.copies.map(row => row.file)).size, 11);
assert.equal(manifest.copies.filter(row => row.file.endsWith('.gz')).length, 5);
assert.equal(manifest.copies.filter(row => row.file.endsWith('.png')).length, 4);
for (const row of manifest.copies) {
  const bytes = fs.readFileSync(path.join(__dirname, row.file));
  assert.equal(bytes.length, row.bytes);
  assert.equal(sha(bytes), row.sha256);
  assert.equal(sha(row.file.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes), row.decoded_sha256);
  if (row.file.endsWith('.png')) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), 1000);
    assert.equal(bytes.readUInt32BE(20), 1000);
  }
}
for (const row of [record.source, ...record.glb]) {
  const bytes = fs.readFileSync(path.join(root, row.file));
  assert.equal(bytes.length, row.bytes);
  assert.equal(sha(bytes), row.sha256);
}
// Existing 99 A103 artifact copies must stay byte-identical; no temporary path required.
const oldDirectory = path.join(__dirname, '../candidate-a103-review');
const oldManifest = JSON.parse(fs.readFileSync(path.join(oldDirectory, 'copy-manifest.json')));
assert.equal(oldManifest.copies.length, 99);
for (const row of oldManifest.copies) assert.equal(sha(fs.readFileSync(path.join(oldDirectory, row.file))), row.sha256);
for (const report of [intersection, merit]) {
  assert.equal(report.source_sha256, record.source.sha256);
  assert.equal(report.blender, '5.1.1');
  assert.equal(report.rows.length, 2);
  assert.equal(report.source_saved, false);
  assert.equal(report.full_qa, false);
  assert.equal(report.appearance_approval, false);
}
assert.equal(intersection.read_only, true);
assert.equal(intersection.native_segment_self_check, true);
assert.equal(intersection.source_coordinates_skin_exact, true);
assert.deepEqual(intersection.rows.map(row => row.local_triangles), [39991, 38042]);
assert.deepEqual(intersection.rows.map(row => row.nonadjacent_bvh_candidates), [14, 29]);
assert.deepEqual(intersection.rows.map(row => row.strict_nonadjacent_intersections), [0, 0]);
assert.deepEqual(intersection.rows.map(row => row.long_folded_edges), [26, 24]);
assert.deepEqual(intersection.rows.map(row => row.tiny_faces_below_1e_10_m2), [1, 2]);
assert.deepEqual(merit.rows.map(row => row.long_folds_before), [26, 24]);
assert.deepEqual(merit.rows.map(row => row.long_folds_after), [10, 18]);
assert.deepEqual(merit.rows.map(row => row.accepted_native_rotations), [10, 4]);
for (const row of merit.rows) {
  for (const key of ['all_coordinates_skin_rest_matrices_exact', 'outside_face_winding_exact', 'vertices_edges_faces_counts_exact']) assert.equal(row[key], true);
  assert.equal(row.nonmanifold_edges, 0);
  const accepted = row.trace.filter(step => step.accepted);
  assert.equal(accepted.length, row.accepted_native_rotations);
  for (const step of accepted) {
    assert(step.new_sharp_edges_max_angle[0] < step.old_sharp_edges_max_angle[0]);
    assert(step.new_sharp_edges_max_angle[1] < step.old_sharp_edges_max_angle[1] - 1e-6);
    assert(step.new_minimum_area_m2 >= step.old_minimum_area_m2 * (1 - 1e-5));
  }
}
assert.deepEqual(record.runs.map(row => row.exit_code), [0, 0]);
assert.deepEqual(record.runs.map(row => row.session), [54358, 85918]);
assert.equal(record.copies, 11);
assert.equal(record.gzip, 5);
assert.equal(record.new_png, 4);
assert.equal(record.directly_viewed_png, 4);
for (const key of ['source_saved', 'human_camera_capture', 'human_coordinate_collection', 'new_full_deformation_qa', 'new_browser_comparison', 'appearance_passed', 'adopted', 'release_approved', 'stages_1_to_6_complete', 'pr9_merge_allowed']) assert.equal(record[key], false);
assert.equal(record.new_blend_files, 0);
assert.equal(record.new_glb_files, 0);
assert.equal(record.review.first_read_only_scope_scan_exit, 1);
assert.equal(record.review.corrected_scope_scan_exit, 0);
assert.equal(record.review.targeted_secret_findings, 0);
assert.equal(record.review.trace_rows_checked, 50);
assert.equal(record.review.merge_allowed, false);
assert.equal(record.verification.archive_checker_exit, 0);
assert.equal(record.verification.prior_a103_checker_exit, 0);
for (const file of ['README.md', '../../../../docs/avatar-production.md', '../../../../docs/stories/stage2-avatar-candidate.md']) {
  const absolute = path.resolve(__dirname, file);
  for (const match of fs.readFileSync(absolute, 'utf8').matchAll(/\]\(([^\s)]+)\)/g)) {
    if (!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(absolute), match[1].split('#')[0])), match[1]);
  }
}
console.log(JSON.stringify({integrity_passed: true, copies: 11, gzip: 5, actual_png: 4, directly_viewed: 4, native_rows: 4, accepted_memory_rotations: [10, 4], source_saved: false, new_Chrome: 0, appearance_passed: false}));
