// FR-A-02/03/08: native diagnosis and preservation, NOT appearance/release approval.
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
assert.equal(manifest.old_files_changed, 0);
assert.equal(manifest.copies.length, 25);
assert.equal(new Set(manifest.copies.map(r => r.file)).size, 25);
assert.equal(manifest.copies.filter(r => r.file.endsWith('.gz')).length, 7);
const png = manifest.copies.filter(r => r.file.endsWith('.png')).map(r => r.file).sort();
assert.equal(png.length, 10);
assert.deepEqual(record.observed_images.sort(), png);
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
const source = fs.readFileSync(path.join(root, record.source.file));
assert.equal(source.length, record.source.bytes);
assert.equal(sha(source), record.source.sha256);
// Prior source/GLBs/evidence remain byte-identical; the existing checker covers deeper history.
const prior = path.join(__dirname, '../candidate-a106-review');
const oldManifest = JSON.parse(fs.readFileSync(path.join(prior, 'copy-manifest.json')));
assert.equal(oldManifest.copies.length, 101);
for (const row of oldManifest.copies) assert.equal(sha(fs.readFileSync(path.join(prior, row.file))), row.sha256);
const probe = read('remaining-fold-patches.json');
assert.equal(probe.source_sha256, record.source.sha256);
assert.equal(probe.read_only, true);
assert.equal(probe.source_saved, false);
assert.deepEqual(probe.rows.map(r => r.folds.length), [8, 16]);
for (const prefix of ['patch', 'normal']) {
  const report = read(`${prefix}/patch-trial.json`);
  assert.equal(report.source_saved, false);
  assert.equal(report.source_sha256, record.source.sha256);
  assert.deepEqual(report.rows.map(r => r.long_folds_before_after), [[8, 1], [16, 7]]);
  assert.deepEqual(report.rows.map(r => r.removed_local_vertices), [20, 29]);
  assert.deepEqual(report.rows.map(r => r.replaced_faces), [123, 156]);
  assert.deepEqual(report.rows.map(r => r.native_new_triangles), [83, 111]);
  for (const row of report.rows) {
    for (const key of ['trial_geometry_guards_passed', 'all_retained_coordinates_skin_exact', 'protected_hands_rest_matrices_exact', 'unmodified_face_winding_exact', 'sampled_not_exhaustive_surface_envelope']) assert.equal(row[key], true);
    assert.equal(row.whole_topology_unchanged, false);
    assert.equal(row.nonmanifold_edges, 0);
    assert.deepEqual(row.inconsistent_winding_before_after, [0, 0]);
    assert(row.old_to_new_sample_envelope_m < 0.006 && row.new_to_old_sample_envelope_m < 0.006);
    assert.deepEqual(read(`${prefix}/${row.body.toLowerCase()}-patch-plan.json`).trace, row.patch_trace);
    const accepted = row.patch_trace.filter(r => r.accepted_for_trial);
    assert.equal(accepted.length, 5);
    assert(accepted.every(r => r.closed_disk && r.euler === 1));
    assert.equal(accepted.reduce((sum, r) => sum + r.faces, 0), row.replaced_faces);
  }
}
const normals = read('normal/normal-trial.json');
assert.equal(normals.source_saved, false);
assert.equal(normals.rows.length, 2);
for (const row of normals.rows) {
  assert.equal(row.geometry_topology_skin_group_names_exact, true);
  assert.equal(row.custom_normals_after, true);
  assert.equal(row.geometry_repair_or_full_qa, false);
  assert.equal(row.appearance_approved, false);
  // The archived angle==0 count must never be mistaken for exact vector equality.
  assert(record.limitations.some(r => r.includes('NOT byte/vector equality')));
}
assert.deepEqual(record.runs.map(r => r.session), [59009, 14677, 68483]);
assert.deepEqual(record.runs.map(r => r.exit_code), [0, 0, 0]);
assert.equal(record.new_png, 10);
assert.equal(record.directly_viewed_png, 10);
assert.equal(record.new_blend_files, 0);
assert.equal(record.new_glb_files, 0);
for (const key of ['source_saved', 'new_full_deformation_qa', 'new_browser_comparison', 'human_camera_capture', 'human_coordinate_collection', 'appearance_passed', 'adopted', 'release_approved', 'stages_1_to_6_complete', 'pr9_merge_allowed']) assert.equal(record[key], false);
for (const file of ['README.md', '../../../../docs/avatar-production.md', '../../../../docs/stories/stage2-avatar-candidate.md']) {
  const absolute = path.resolve(__dirname, file);
  for (const match of fs.readFileSync(absolute, 'utf8').matchAll(/\]\(([^\s)]+)\)/g)) {
    if (!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(absolute), match[1].split('#')[0])), match[1]);
  }
}
console.log(JSON.stringify({integrity_passed: true, copies: 25, gzip: 7, actual_png: 10, directly_viewed: 10, native_runs: 3, long_folds: [[8, 1], [16, 7]], source_saved: false, new_Chrome: 0, appearance_passed: false}));
