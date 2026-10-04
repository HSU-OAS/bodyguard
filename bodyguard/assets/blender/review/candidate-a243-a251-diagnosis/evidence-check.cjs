// FR-A-01/02/03/08: integrity checks are not appearance or release approval.
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
assert.deepEqual(manifest.counts, {copies:44,gzip:30,PNG:12,blend:2,GLB:0});
assert.equal(manifest.copies.length,44);
assert.equal(new Set(manifest.copies.map(r=>r.file)).size,44);
for (const row of manifest.copies) {
  const bytes = read(row.file), decoded = row.file.endsWith('.gz') ? zlib.gunzipSync(bytes) : bytes;
  assert.equal(bytes.length,row.bytes); assert.equal(sha(bytes),row.sha256,row.file);
  assert.equal(sha(decoded),row.decoded_sha256,row.file);
  if (row.file.endsWith('.png')) assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
}
assert.equal(manifest.protected_prior.length,526);
for (const row of manifest.protected_prior) assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256,row.file);
for (const name of ['avatar_skin_guard.py','test_avatar_skin_guard.py','skin_coefficients.py','test_skin_coefficients.py','remove_joint_overlays.py']) {
  assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender',name))),sha(zlib.gunzipSync(read('executed-helpers/'+name+'.txt.gz'))),name);
}
const sourceHash = '5eb381bffcbfbfa67b4426a11785a0edf55408e457060763767a579738e048a8';
assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender/review/candidate-a237-a242-diagnosis/a239/artist-candidate.blend'))),sourceHash);
const normals = gz('diagnosis/a243-surface-normals.json.txt.gz');
assert.equal(normals.source_sha256,sourceHash);
assert(normals.read_only&&normals.source_unchanged);
assert.deepEqual(normals.rows.map(r=>r.normal_based_sharp_excluded_by_old_position_y),[550,707]);
assert(normals.rows.every(r=>r.original_body_geometry_skin_unchanged&&r.pose_rest_bones===163));
const partition = gz('diagnosis/a246-face-partition.json.txt.gz');
assert(partition.read_only_original&&partition.source_unchanged&&partition.changed_edge_statistics_not_same_edge_pairs);
assert.equal(partition.rows.length,6); assert.equal(partition.saved_assets,0); assert.equal(partition.renders,0);
for (const row of partition.rows) {
  assert(row.original_outside_faces_exact&&row.all_original_coordinates_numeric_skin_exact);
  assert.equal(row.new_points,0); assert(!row.skin_interpolation);
  assert.deepEqual(row.geometric_regressions,[]);
  assert(row.after.faces>row.before.faces);
}
const axis = gz('diagnosis/a249-axis-diagnosis.json.txt.gz');
assert(axis.diagnostic_only&&axis.body_coordinates_mutated_in_unsaved_native_trial&&axis.no_coordinates_or_skin_restored);
assert.equal(axis.source_sha256,sourceHash); assert.equal(axis.saved_assets,0); assert.equal(axis.renders,0);
assert.equal(axis.saved_candidate,false);
assert.deepEqual(axis.rows.map(r=>r.axis_x_changed_points),[239,320]);
assert.deepEqual(axis.rows.map(r=>r.axis_z_changed_points),[251,398]);
for (const row of axis.rows) {
  assert(!row.all_original_x_coordinates_exact&&!row.all_original_z_coordinates_exact&&!row.existing_6mm_guard_and_geometry_passed);
  assert(row.maximum_axis_x_difference_m>0&&row.maximum_axis_z_difference_m>0);
}
const candidates = [gz('a244/fairing-report.json.txt.gz'),gz('a250/fairing-report.json.txt.gz')];
for (const [i,report] of candidates.entries()) {
  const folder=i?'a250':'a244';
  assert.equal(report.source_sha256,sourceHash); assert(report.saved_candidate);
  assert.equal(sha(read(folder+'/artist-candidate.blend')),report.candidate_sha256);
  assert.deepEqual(report.rows.map(r=>r.selected_points),[2499,3150]);
  for (const row of report.rows) {
    assert(row.zero_mask_coordinates_exact&&row.all_original_x_coordinates_exact&&row.original_normal_y_le_quarter_coordinates_exact);
    assert(row.all_numeric_skin_faces_group_order_hands_163_rest_bones_world_materials_exact&&row.existing_6mm_guard_and_geometry_passed);
    assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006);
    assert.equal(row.pre_save_individual_and_sum_skin_guard_vertices,row.before.vertices);
    assert(!row.whole_neck_remesh&&row.position_y_not_used_as_front_back_classifier);
    for (const key of ['vertices','faces']) assert.equal(row.before[key],row.after[key]);
    for (const key of ['nonmanifold','winding_errors','tiny_faces','long_folds']) assert(row.after[key]<=row.before[key]);
    const before=row.before.fixed_original_posterior_edge_angles_deg,after=row.after.fixed_original_posterior_edge_angles_deg;
    assert.equal(before.count,after.count);
    for (const key of ['median','p95','max']) assert(i?after[key]<before[key]:after[key]>before[key]);
    if(i) assert(row.all_original_z_coordinates_exact&&row.native_mask_coefficients_are_binary_zero_or_one&&row.same_positive_mask_support_as_A247);
  }
  for(const field of ['appearance_approved','full_deformation_qa','GLB_qa','browser_qa']) assert.equal(report[field],false);
}
for (let i=0;i<2;i++) assert.deepEqual(candidates[0].rows[i].fixed_original_measurement_edge_pairs,candidates[1].rows[i].fixed_original_measurement_edge_pairs);
for (const [i,name] of ['a245','a251'].entries()) {
  const report=gz('diagnosis/'+name+'-saved-native.json.txt.gz');
  assert(report.passed&&report.independent_saved_native_reopen);
  assert.deepEqual(report.rows.map(r=>r.changed_points),i?[2499,3150]:[2475,3101]);
  for (const row of report.rows) {
    assert(row.all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact&&row.all_point_ledgers_and_a239_parent_attribute_exact);
    assert(row.independent_individual_and_sum_skin_guard_passed&&row.all_original_points_outside_head_interface_artist_band_exact);
    assert(row.all_original_x_coordinates_exact&&row.original_normal_y_le_quarter_coordinates_exact);
    assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006);
    assert(row.changed_negative_position_y_points>0&&row.position_y_not_used_as_front_back_classifier);
    if(i) assert(row.all_original_z_coordinates_exact);
  }
  for (const field of ['appearance_approved','full_deformation_qa','GLB_qa','browser_qa']) assert.equal(report[field],false);
  assert.equal(report.saved_assets,0);
  assert.deepEqual(Object.values(report.input_sha256).sort(),[sourceHash,candidates[i].candidate_sha256].sort());
}
assert.equal(record.native_runs.length,9); assert(record.native_actors_sequential);
assert.equal(record.executed_native_avatar_runs,8); assert.equal(record.installed_API_introspection_runs,1);
for (const [i,run] of record.native_runs.entries()) {
  assert(run.command&&run.full_stdout_preserved); assert.equal(run.chunks.at(-1).exit_code,i===5?1:0);
  assert.deepEqual(gz(run.stdout_archive),run);
}
assert.match(record.native_runs[5].chunks.map(c=>c.output).join('\n'),/AssertionError/);
assert.equal(record.prepared_not_executed.length,1); assert.match(record.prepared_not_executed[0],/A248/);
assert.equal(record.final_static.result.exit_code,0); assert.match(record.final_static.result.output,/9 files already formatted/);
assert.equal(record.unit_verification.result.exit_code,0); assert.match(record.unit_verification.result.output,/Ran 20 tests/);
assert.equal(record.actual_renders,12); assert.equal(record.directly_viewed.length,12);
assert.equal(new Set(record.directly_viewed).size,12);
for (const file of record.directly_viewed) assert(manifest.copies.some(r=>r.file===file&&file.endsWith('.png')));
for (const field of ['appearance_approved','service_adopted','pr_merge_allowed','stages_1_to_6_completed','coordinates_or_skin_restored','guards_relaxed']) assert.equal(record[field],false);
assert.equal(record.current_development_asset,'A37'); assert(record.goal_continues);
assert.equal(record.full_118_deformation_runs,0); assert.equal(record.GLB_files,0);
assert.equal(record.browser_runs.length,0); assert.equal(record.camera_calls,0); assert.equal(record.human_capture_upload_calls,0);
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bghp_[A-Za-z0-9]{36}\b/,/\bgithub_pat_[A-Za-z0-9_]{60,}\b/];
for (const row of manifest.copies.filter(r=>r.file.endsWith('.gz'))) assert(forbidden.every(p=>!p.test(zlib.gunzipSync(read(row.file)).toString('utf8'))),row.file);
let links=0;
for (const m of read('README.md').toString('utf8').matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
  if(/^(https?:|codex:|mailto:|#)/.test(m[1])) continue;
  const target=m[1].split('#')[0].replace(/^<|>$/g,'');
  assert(fs.existsSync(path.resolve(__dirname,decodeURIComponent(target))),target); links++;
}
console.log(JSON.stringify({integrity_passed:true,...manifest.counts,protected_prior:526,native_runs:9,native_expected_failure:1,prepared_native_not_executed:1,directly_viewed:12,local_links_checked:links,limited_gzip_secret_scan:30,not_full_security_audit:true,appearance_approved:false,service_adopted:false,full_118_GLB_Chrome:'not executed'}));
