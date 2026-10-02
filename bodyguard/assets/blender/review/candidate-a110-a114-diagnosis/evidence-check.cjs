// FR-A-02/08: preservation and honest failure accounting, NOT release approval.
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
assert.equal(manifest.copies.length, 42);
assert.equal(new Set(manifest.copies.map(r => r.file)).size, 42);
assert.equal(manifest.copies.filter(r => r.file.endsWith('.gz')).length, 11);
const png = manifest.copies.filter(r => r.file.endsWith('.png')).map(r => r.file);
assert.equal(png.length, 17);
assert.equal(record.observed_images.length, 11);
assert.equal(new Set(record.observed_images).size, 11);
assert(record.observed_images.every(file => png.includes(file)));
assert(png.filter(file => !record.observed_images.includes(file)).every(file => file.includes('-before-')));
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
for (const folder of ['candidate-a106-review', 'candidate-a107-a109-diagnosis']) {
  const prior = path.join(__dirname, '..', folder);
  const old = JSON.parse(fs.readFileSync(path.join(prior, 'copy-manifest.json')));
  for (const row of old.copies) assert.equal(sha(fs.readFileSync(path.join(prior, row.file))), row.sha256);
}
const probe = read('boundary-probe.json');
assert.equal(probe.read_only, true);
assert.equal(probe.source_saved, false);
assert.equal(probe.source_sha256, record.source.sha256);
assert.deepEqual(probe.rows.map(r => r.closed_even_single_disk), [true, false]);
const fairing = read('fairing/repaired-surface-trial.json');
assert.equal(fairing.source_saved, false);
assert.deepEqual(fairing.rows.map(r => r.before_after.map(s => s.long_folds)), [[1, 6], [7, 16]]);
for (const row of fairing.rows) {
  assert.equal(row.trial_geometry_guards_passed, false);
  assert.equal(row.skin_groups_rest_matrices_hands_outside_exact, true);
  assert.equal(row.fairing_step_topology_exact, true);
  assert.equal(row.source_topology_exact, false);
  assert.equal(row.full_qa_or_appearance_approved, false);
}
for (const [folder, counts] of [['curved-grid', [[8, 3503]]], ['simple-grid', [[8, 1498], [16, 119]]], ['explicit-grid', [[8, 2370], [16, 2352]]]]) {
  const report = read(`${folder}/grid-trial.json`);
  assert.equal(report.source_sha256, record.source.sha256);
  assert.equal(report.source_saved, false);
  assert.equal(report.rows.length, counts.length);
  assert.deepEqual(report.rows.map(r => r.before_after.map(s => s.long_folds)), counts);
  for (const row of report.rows) {
    assert.equal(row.trial_geometry_guards_passed, false);
    assert.equal(row.full_qa_or_appearance_approved, false);
    assert.equal(row.whole_topology_unchanged, false);
    for (const key of ['all_retained_coordinates_skin_exact', 'protected_hands_rest_matrices_exact', 'unmodified_face_winding_exact', 'sampled_not_exhaustive_surface_envelope']) assert.equal(row[key], true);
    assert.equal(row.new_skin_normalization_errors, 0);
    assert.equal(row.candidate_vertices, row.source_vertices - row.removed_local_vertices + row.native_generated_vertices);
    assert(row.before_after.every(s => s.global_nonmanifold === 0 && s.global_inconsistent_winding === 0));
  }
}
const partial = read('curved-grid/female-grid-plan.json');
assert.equal(partial.boundary_edges, 363);
assert(!png.includes('curved-grid/female-grid-posterior.png'));
assert.deepEqual(['male', 'female'].map(label => read(`explicit-grid/${label}-grid-plan.json`).explicit_native_span), [93, 91]);
const female = read('explicit-grid/grid-trial.json').rows[1];
assert(female.old_to_new_sample_envelope_m < 0.006 && female.new_to_old_sample_envelope_m < 0.006);
assert.equal(female.trial_geometry_guards_passed, false);
assert.deepEqual(record.runs.map(r => r.session), [12190, 80472, 99390, 19961, 17162]);
assert.deepEqual(record.runs.map(r => r.exit_code), [0, 0, 1, 0, 0]);
assert.equal(record.new_png, 17);
assert.equal(record.directly_viewed_png, 11);
assert.equal(record.new_blend_files, 0);
assert.equal(record.new_glb_files, 0);
for (const key of ['source_saved', 'new_full_deformation_qa', 'new_browser_comparison', 'human_camera_capture', 'human_coordinate_collection', 'appearance_passed', 'adopted', 'release_approved', 'stages_1_to_6_complete', 'pr9_merge_allowed']) assert.equal(record[key], false);
for (const file of ['README.md', '../../../../docs/avatar-production.md', '../../../../docs/stories/stage2-avatar-candidate.md']) {
  const absolute = path.resolve(__dirname, file);
  for (const match of fs.readFileSync(absolute, 'utf8').matchAll(/\]\(([^\s)]+)\)/g)) {
    if (!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(absolute), match[1].split('#')[0])), match[1]);
  }
}
console.log(JSON.stringify({integrity_passed: true, copies: 42, gzip: 11, actual_png: 17, directly_viewed: 11, native_runs: 5, exits: [0, 0, 1, 0, 0], source_saved: false, new_Chrome: 0, appearance_passed: false}));
