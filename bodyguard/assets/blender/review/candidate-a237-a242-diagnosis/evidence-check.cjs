// FR-A-01/02/03/08: evidence integrity is not appearance or release approval.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const read = f => fs.readFileSync(path.join(__dirname, f));
const json = f => JSON.parse(read(f));
const gz = f => JSON.parse(zlib.gunzipSync(read(f)));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const root = path.resolve(__dirname, '../../../../..');
const manifest = json('copy-manifest.json'), record = json('execution-record.json');
assert.deepEqual(manifest.counts, {copies:43,gzip:29,PNG:12,blend:2,GLB:0});
assert.equal(manifest.copies.length, 43);
assert.equal(new Set(manifest.copies.map(r=>r.file)).size, 43);
for (const row of manifest.copies) {
  const bytes = read(row.file), decoded = row.file.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes;
  assert.equal(bytes.length,row.bytes); assert.equal(sha(bytes),row.sha256,row.file);
  assert.equal(sha(decoded),row.decoded_sha256,row.file);
  if (row.file.endsWith('.png')) assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
}
assert.equal(manifest.protected_prior.length,479);
for (const row of manifest.protected_prior) assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256,row.file);
for (const name of ['avatar_skin_guard.py','test_avatar_skin_guard.py','skin_coefficients.py','test_skin_coefficients.py','remove_joint_overlays.py']) {
  assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender',name))),sha(zlib.gunzipSync(read('executed-helpers/'+name+'.txt.gz'))),name);
}
const sourceHash = '1f2e2d2139835c6c29582b56b2aeea90f88eab6c540b8b784715a56ba08ec3e3';
const provenance = gz('diagnosis/a237-posterior.json.txt.gz');
assert.equal(provenance.source_sha256,sourceHash); assert(provenance.read_only);
assert.deepEqual(provenance.rows.map(r=>r.sharp_shorter_than_1mm),[114,108]);
assert(provenance.rows.every(r=>r.source_geometry_skin_unchanged&&r.rest_bones===163));
for (const name of ['a238-valence','a238-review-valence']) {
  const report=gz('diagnosis/'+name+'.json.txt.gz');
  assert.equal(report.source_sha256,sourceHash); assert(report.original_unchanged);
  assert.equal(report.saved_assets,0); assert.equal(report.renders,0);
  assert.deepEqual(report.rows.map(r=>r.removed_points.length),[0,6]);
  assert(report.rows.every(r=>r.retained_coordinates_numeric_skin_exact&&r.new_points===0&&!r.skin_interpolation&&r.geometric_regressions.length===0));
}
assert.deepEqual(gz('diagnosis/a238-valence.json.txt.gz'),gz('diagnosis/a238-review-valence.json.txt.gz'));
assert.deepEqual(gz('diagnosis/a240-saved-native.json.txt.gz'),gz('diagnosis/a240-review-saved-native.json.txt.gz'));
const knot=gz('a239/topology-report.json.txt.gz');
assert.equal(knot.source_sha256,sourceHash); assert(knot.saved_candidate&&!knot.appearance_approved);
assert.equal(sha(read('a239/artist-candidate.blend')),knot.candidate_sha256);
assert.deepEqual(knot.rows.map(r=>r.after.vertices),[131645,130548]);
assert.deepEqual(knot.rows.map(r=>r.removed_generated_points.length),[0,6]);
for (const row of knot.rows) {
  assert(row.retained_coordinates_numeric_skin_exact&&row.group_order_163_rest_bones_world_material_finish_exact&&row.protected_hands_exact&&row.retained_all_three_ledger_values_exact);
  assert.equal(row.new_points,0); assert(!row.skin_interpolation);
  assert.equal(row.pre_save_skin_vertices,row.after.vertices);
  for(const key of ['nonmanifold','winding_errors','tiny_faces','long_folds']) assert(row.after[key]<=row.before[key]);
}
const saved=gz('diagnosis/a240-saved-native.json.txt.gz');
assert(saved.passed&&saved.independent_saved_native_reopen);
assert.deepEqual(saved.rows.map(r=>r.source_faces_outside_removed_generated_knots_exact),[181201,179426]);
assert.deepEqual(saved.rows[1].removed_generated_points,[128463,128483,128516,128547,128583,130549]);
assert(saved.rows.every(r=>r.retained_coordinates_numeric_skin_exact&&r.all_163_rest_bones_group_order_world_finish_exact&&r.individual_and_sum_skin_guard_passed&&r.maximum_retained_coordinate_displacement_m===0));
const fair=gz('a241/fairing-report.json.txt.gz');
assert.equal(fair.source_sha256,knot.candidate_sha256); assert(fair.saved_candidate&&!fair.appearance_approved);
assert.equal(sha(read('a241/artist-candidate.blend')),fair.candidate_sha256);
for (const row of fair.rows) {
  assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006);
  assert(row.all_original_x_coordinates_exact&&row.all_original_front_y_nonpositive_coordinates_exact&&row.zero_mask_coordinates_exact&&row.existing_6mm_guard_and_geometry_passed);
  assert(row.all_numeric_skin_faces_group_order_hands_163_rest_bones_world_materials_exact);
  assert.equal(row.pre_save_individual_and_sum_skin_guard_vertices,row.before.vertices);
  for(const key of ['vertices','faces']) assert.equal(row.before[key],row.after[key]);
  for(const key of ['nonmanifold','winding_errors','tiny_faces','long_folds']) assert(row.after[key]<=row.before[key]);
}
assert(fair.rows[0].after.head_interface_long_edge_angles_deg.max>fair.rows[0].before.head_interface_long_edge_angles_deg.max);
assert(fair.rows.every(r=>r.after.head_interface_long_edge_angles_deg.p95>r.before.head_interface_long_edge_angles_deg.p95));
const yz=gz('diagnosis/a242-saved-native.json.txt.gz');
assert(yz.passed&&yz.independent_saved_native_reopen);
assert.deepEqual(yz.rows.map(r=>r.changed_points),[895,787]);
assert(yz.rows.every(r=>r.all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact&&r.all_original_x_coordinates_exact&&r.all_original_front_y_nonpositive_coordinates_exact&&r.all_point_ledgers_and_a239_parent_attribute_exact&&r.independent_individual_and_sum_skin_guard_passed));
for(const report of [saved,yz]) for(const field of ['appearance_approved','full_deformation_qa','GLB_qa','browser_qa']) assert.equal(report[field],false);
assert.equal(record.native_runs.length,8); assert(record.native_actors_sequential);
for (const run of record.native_runs) {
  assert(run.command&&run.full_stdout_preserved); assert.equal(run.chunks.at(-1).exit_code,0);
  assert.deepEqual(gz(run.stdout_archive),run);
}
assert.equal(record.reviewed_static.exit_code,0);
assert.deepEqual(record.initial_context_static_failures,['C400','I001']);
assert(record.initial_context_shell_final_exit_0_did_not_mean_all_commands_passed);
assert.match(record.final_static.result.output,/C400/); assert.match(record.final_static.result.output,/I001/);
assert.equal(record.unit_verification.result.exit_code,0); assert.match(record.unit_verification.result.output,/Ran 20 tests/);
assert.equal(record.actual_renders,12); assert.equal(record.directly_viewed.length,12);
assert.equal(new Set(record.directly_viewed).size,12);
for(const file of record.directly_viewed) assert(manifest.copies.some(r=>r.file===file&&file.endsWith('.png')));
for(const field of ['appearance_approved','service_adopted','pr_merge_allowed','stages_1_to_6_completed']) assert.equal(record[field],false);
assert.equal(record.current_development_asset,'A37'); assert(record.goal_continues);
assert.equal(record.full_118_deformation_runs,0); assert.equal(record.GLB_files,0);
assert.equal(record.browser_runs.length,0); assert.equal(record.camera_calls,0);
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bghp_[A-Za-z0-9]{36}\b/,/\bgithub_pat_[A-Za-z0-9_]{60,}\b/];
for(const row of manifest.copies.filter(r=>r.file.endsWith('.gz'))) assert(forbidden.every(p=>!p.test(zlib.gunzipSync(read(row.file)).toString('utf8'))),row.file);
let links=0;
for(const m of read('README.md').toString('utf8').matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
  if(/^(https?:|codex:|mailto:|#)/.test(m[1])) continue;
  const target=m[1].split('#')[0].replace(/^<|>$/g,'');
  assert(fs.existsSync(path.resolve(__dirname,decodeURIComponent(target))),target); links++;
}
console.log(JSON.stringify({integrity_passed:true,...manifest.counts,protected_prior:479,native_runs:8,directly_viewed:12,local_links_checked:links,limited_gzip_secret_scan:29,not_full_security_audit:true,appearance_approved:false,service_adopted:false,full_118_GLB_Chrome:'not executed'}));
