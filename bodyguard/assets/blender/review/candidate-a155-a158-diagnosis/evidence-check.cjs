// FR-A-02/08: immutable evidence consistency, not appearance/clinical approval.
const assert = require('node:assert/strict'), fs = require('node:fs');
const path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../../..');
const bytes = file => fs.readFileSync(path.join(__dirname, file));
const json = file => JSON.parse(bytes(file));
const decoded = file => JSON.parse(zlib.gunzipSync(bytes(file)));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = json('copy-manifest.json'), execution = json('execution-record.json');
execFileSync(process.execPath, [path.join(root, manifest.previous_integrity_checker)], { stdio: 'inherit' });
for (const row of [...manifest.previous_control_files, ...manifest.protected_repository_inputs])
  assert.equal(sha(fs.readFileSync(path.join(root, row.file))), row.sha256);
for (const row of manifest.copies) {
  const data = bytes(row.file);
  assert.equal(data.length, row.bytes); assert.equal(sha(data), row.sha256);
  assert.equal(sha(row.file.endsWith('.gz') ? zlib.gunzipSync(data) : data), row.decoded_sha256);
}
assert.equal(manifest.protected_old_file_count, 610); assert.equal(manifest.old_files_changed, 0);
assert.equal(manifest.copies.length, 32);
assert.equal(manifest.copies.filter(row => row.file.endsWith('.gz')).length, 12);
const png = manifest.copies.filter(row => row.file.endsWith('.png')).map(row => row.file);
assert.equal(png.length, 16); assert.equal(new Set(execution.directly_viewed).size, 16);
assert.deepEqual([...png].sort(), [...execution.directly_viewed].sort());
for (const file of png) assert.equal(bytes(file).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert(!manifest.copies.some(row => /\.(blend|glb)$/.test(row.file)));
const inputSha = '602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9';
assert.equal(sha(fs.readFileSync(path.resolve(__dirname, execution.input_source))), inputSha);
assert.equal(execution.reference_sha256, '45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
const [a155, a156, a157, a158] = [155, 156, 157, 158].map(id => json('a' + id + '-report.json'));
for (const report of [a155, a156, a157, a158]) {
  assert.equal(report.input_sha256, inputSha);
  assert(!report.source_saved && !report.appearance_approved && !report.full_deformation_qa);
  assert.deepEqual(report.rows.map(row => row.body), ['Male', 'Female']);
}
assert(a155.input_sha256_unchanged_after_edits);
assert.deepEqual(a155.rows.map(row => row.geometry_guards_passed), [true, false]);
const peak = a155.rows[1].maximum_point;
assert.equal(peak.index, 96276); assert.equal(peak.a123_original_id, 98463);
assert.equal(peak.original_named_skin.find(([name]) => name === 'neck02')[1], 0.5339486598968506);
assert.equal(peak.fairing_delta_xyz_m[2], -0.004628658294677734);
assert(a155.rows[1].control_only_maximum_displacement_m < 0.006 && a155.rows[1].maximum_displacement_m > 0.006);
for (const report of [a155, a156, a157])
  assert(report.rows.every(row => row.all_skin_topology_hands_163_rest_bones_world_exact && row.fairing_mask_normalized_z[0] === 0.875));
for (const report of [a156, a157]) {
  assert(report.rows.every(row => row.geometry_guards_passed && row.maximum_displacement_m < 0.006));
  assert.deepEqual(report.rows.map(row => row.after.local_long_folds), [1, 0]);
  assert(report.rows.every(row => row.after.local_tiny_faces === 0 && row.after.global_nonmanifold === 0 && row.after.global_winding_errors === 0));
  assert(report.rows.every(row => row.after.posterior_head_base_p95_deg > row.before.posterior_head_base_p95_deg));
}
assert(a156.rows.every(row => row.all_original_z_coordinates_exact && row.changed_x_vertices_inside_selected_band > 0));
assert(a156.rows.every(row => row.after.posterior_head_base_max_deg > row.before.posterior_head_base_max_deg));
assert(a157.rows.every(row => row.changed_x_z_vertices_inside_selected_band > 0 && row.fairing_protection.includes('skin itself unchanged')));
assert(a157.rows[0].after.posterior_head_base_max_deg < a157.rows[0].before.posterior_head_base_max_deg);
assert(a157.rows[1].after.posterior_head_base_max_deg > a157.rows[1].before.posterior_head_base_max_deg);
assert(a158.read_only && a158.rows.every(row => row.current_coordinates_skin_163_rest_bones_exact));
assert.equal(a158.professional_sha256, '3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137');
assert.deepEqual(a158.rows.map(row => row.current_vertices), [129630, 128389]);
assert(a158.rows.every(row => row.professional_vertices === 42342 && row.current.bands.length === 32 && row.professional.bands.length === 32));
assert.deepEqual(a158.rows.map(row => row.current.largest_posterior_deltas[0].delta_y_mm), [8.63699932030104, 12.676585254239255]);
assert.equal(execution.native_runs.length, 4);
assert.deepEqual(execution.native_runs.map(row => row.exit_code), [1, 0, 0, 0]);
for (const row of execution.native_runs) {
  const log = decoded(row.log); assert.equal(log.exit_code, row.exit_code); assert.equal(log.command.cmd, row.command);
  assert.equal(log.chunks.at(-1).chunk_id, row.terminal_chunk_id); assert.equal(log.chunks.at(-1).exit_code, row.exit_code);
  assert(row.terminal_stdout_retained && !log.stdout_reconstructed && log.output_kind === 'actual_tool_chunks');
  assert(log.chunks.every(chunk => !chunk.output.includes('Warning: truncated')));
}
const staticLog = decoded('logs/static-observed.json.txt.gz');
assert.equal(staticLog.checks.length, 4);
assert(staticLog.checks.every(row => row.checks.length === 3 && row.checks.every(check => check.result.exit_code === 0)));
assert.equal(execution.evidence_copy.exit_code, 0);
assert(execution.native_actors_sequential && execution.native_and_browser_actors_not_overlapped);
assert.equal(execution.new_verification.actual_png, 16); assert.equal(execution.new_verification.directly_viewed, 16);
assert.equal(execution.new_verification.not_viewed, 0);
for (const field of ['source_full_118', 'glb_full_118', 'actual_Chrome_tests', 'actual_webcam_trials'])
  assert.equal(execution.new_verification[field], 0);
assert(Object.values(execution.new_assets).every(value => value === 0));
assert(Object.values(execution.limits).every(value => value === false));
console.log(JSON.stringify({
  integrity_passed: true, copies: 32, gzip: 12, protected_old_files: 610,
  native_exits: execution.native_runs.map(row => row.exit_code), actual_png: 16, directly_viewed: 16,
  new_assets: 0, new_118: 0, new_Chrome: 0, a155_female_guard_failed: true,
  a156_a157_guards_passed_but_appearance_failed: true, a158_read_only: true, appearance_passed: false,
}));
