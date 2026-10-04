// FR-A-02/03/08: evidence integrity is not appearance or release approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),zlib=require('node:zlib');
const read=f=>fs.readFileSync(path.join(__dirname,f));
const json=f=>JSON.parse(read(f)),gz=f=>JSON.parse(zlib.gunzipSync(read(f)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.resolve(__dirname,'../../../../..');
const manifest=json('copy-manifest.json'),record=json('execution-record.json');
assert.deepEqual(manifest.counts,{copies:31,gzip:18,PNG:12,blend:1,GLB:0});
assert.equal(manifest.copies.length,31);assert.equal(new Set(manifest.copies.map(r=>r.file)).size,31);
for(const row of manifest.copies){
  const bytes=read(row.file),decoded=row.file.endsWith('.gz')?zlib.gunzipSync(bytes):bytes;
  assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,row.file);
  assert.equal(sha(decoded),row.decoded_sha256,row.file);
  if(row.file.endsWith('.png'))assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
}
assert.equal(manifest.protected_prior.length,574);
for(const row of manifest.protected_prior)assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256,row.file);
for(const name of ['avatar_skin_guard.py','test_avatar_skin_guard.py','skin_coefficients.py','test_skin_coefficients.py','remove_joint_overlays.py']){
  assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender',name))),sha(zlib.gunzipSync(read('executed-helpers/'+name+'.txt.gz'))),name);
}
const sourceHash='0e6243e64b65841510d2ed926f3bf315e3cc101dbfa57d41beafb8bcedc8a104';
assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender/review/candidate-a243-a251-diagnosis/a250/artist-candidate.blend'))),sourceHash);
const macro=gz('diagnosis/a252-macro-transition.json.txt.gz');
assert.equal(macro.source_sha256,sourceHash);assert(macro.read_only_original&&macro.source_unchanged);
assert(macro.selection_and_profile_angles_are_not_clinical_parameters&&macro.photographic_reference_not_numerically_registered);
assert(macro.profile_uses_max_y_ray_intersection_not_positive_y_vertex_classifier);
for(const row of macro.rows){
  assert(row.all_source_coordinates_raw_skin_faces_groups_rest_pose_world_exact);
  assert.equal(row.bands.length,4);assert.equal(row.centerplane_profiles.head_interface.rows.length,66);
}
const coarse=gz('a253/fairing-report.json.txt.gz'),scalar=gz('a255/fairing-report.json.txt.gz');
assert.equal(coarse.saved_candidate,false);assert.equal(scalar.saved_candidate,true);
assert.deepEqual(coarse.rows.map(r=>r.existing_6mm_guard_and_geometry_passed),[true,false]);
assert.deepEqual(coarse.rows.map(r=>r.before.long_folds),[76,107]);
assert.deepEqual(coarse.rows.map(r=>r.after.long_folds),[76,137]);
assert(!manifest.copies.some(r=>r.file.startsWith('a253/')&&r.file.endsWith('.blend')));
for(const report of [coarse,scalar]){
  assert.equal(report.source_sha256,sourceHash);
  for(const field of ['appearance_approved','full_deformation_qa','GLB_qa','browser_qa'])assert.equal(report[field],false);
  for(const row of report.rows){
    assert(row.all_original_x_coordinates_exact&&row.all_original_z_coordinates_exact&&row.original_normal_y_le_quarter_coordinates_exact);
    assert(row.zero_mask_coordinates_exact&&row.all_numeric_skin_faces_group_order_hands_163_rest_bones_world_materials_exact);
    assert(row.source_body_topology_not_decimated&&!row.whole_neck_remesh);
    assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006);
    assert.equal(row.pre_save_individual_and_sum_skin_guard_vertices,row.before.vertices);
    for(const key of ['vertices','faces'])assert.equal(row.before[key],row.after[key]);
  }
}
assert.equal(sha(read('a255/artist-candidate.blend')),scalar.candidate_sha256);
for(const [i,row]of scalar.rows.entries()){
  assert(row.existing_6mm_guard_and_geometry_passed&&row.continuous_selection_weight_precomputed_before_edit);
  assert(row.only_y_component_written_x_and_z_never_written&&!row.posthoc_coordinate_restoration);
  assert.equal(row.native_BVH_y_ray_hits,row.selected_points);
  assert(row.evaluated_temporary_authored_target_faces>0);
  for(const key of ['nonmanifold','winding_errors','tiny_faces','long_folds'])assert(row.after[key]<=row.before[key]);
  const before=row.before.fixed_original_posterior_edge_angles_deg,after=row.after.fixed_original_posterior_edge_angles_deg;
  assert(after.median<before.median&&after.p95>before.p95&&after.max>before.max);
  assert.deepEqual(row.fixed_original_measurement_edge_pairs,coarse.rows[i].fixed_original_measurement_edge_pairs);
}
const saved=gz('diagnosis/a256-saved-native.json.txt.gz');
assert(saved.passed&&saved.independent_saved_native_reopen);
assert.deepEqual(saved.rows.map(r=>r.changed_points),[2487,3093]);
assert.deepEqual(Object.values(saved.input_sha256).sort(),[sourceHash,scalar.candidate_sha256].sort());
for(const row of saved.rows){
  assert(row.all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact&&row.all_point_ledgers_and_a239_parent_attribute_exact);
  assert(row.all_original_x_coordinates_exact&&row.all_original_z_coordinates_exact&&row.original_normal_y_le_quarter_coordinates_exact);
  assert(row.independent_individual_and_sum_skin_guard_passed&&row.all_original_points_outside_head_interface_artist_band_exact);
  assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006);
}
for(const field of ['appearance_approved','full_deformation_qa','GLB_qa','browser_qa'])assert.equal(saved[field],false);
assert.equal(record.native_runs.length,4);assert(record.native_actors_sequential);
for(const [i,run]of record.native_runs.entries()){
  assert(run.command&&run.full_stdout_preserved);assert.equal(run.chunks.at(-1).exit_code,i===1?1:0);
  assert.deepEqual(gz(run.stdout_archive),run);
}
assert.match(record.native_runs[1].chunks.map(c=>c.output).join('\n'),/Existing guard failed; candidate not saved/);
assert.equal(record.prepared_not_executed.length,1);assert.match(record.prepared_not_executed[0],/A254/);
assert.equal(record.final_static.result.exit_code,0);assert.match(record.final_static.result.output,/5 files already formatted/);
assert.equal(record.unit_verification.result.exit_code,0);assert.match(record.unit_verification.result.output,/Ran 20 tests/);
assert.equal(record.actual_renders,12);assert.equal(new Set(record.directly_viewed).size,12);
for(const file of record.directly_viewed)assert(manifest.copies.some(r=>r.file===file&&file.endsWith('.png')));
for(const field of ['appearance_approved','service_adopted','pr_merge_allowed','stages_1_to_6_completed','guards_relaxed','coordinates_or_skin_restored'])assert.equal(record[field],false);
assert.equal(record.current_development_asset,'A37');assert(record.goal_continues);
assert.equal(record.full_118_deformation_runs,0);assert.equal(record.GLB_files,0);
assert.equal(record.browser_runs.length,0);assert.equal(record.camera_calls,0);assert.equal(record.human_capture_upload_calls,0);
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bghp_[A-Za-z0-9]{36}\b/,/\bgithub_pat_[A-Za-z0-9_]{60,}\b/];
for(const row of manifest.copies.filter(r=>r.file.endsWith('.gz')))assert(forbidden.every(p=>!p.test(zlib.gunzipSync(read(row.file)).toString('utf8'))),row.file);
let links=0;
for(const m of read('README.md').toString('utf8').matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
  if(/^(https?:|codex:|mailto:|#)/.test(m[1]))continue;
  const target=m[1].split('#')[0].replace(/^<|>$/g,'');
  assert(fs.existsSync(path.resolve(__dirname,decodeURIComponent(target))),target);links++;
}
console.log(JSON.stringify({integrity_passed:true,...manifest.counts,protected_prior:574,native_runs:4,native_failure:1,prepared_native_not_executed:1,directly_viewed:12,local_links_checked:links,limited_gzip_secret_scan:18,not_full_security_audit:true,appearance_approved:false,service_adopted:false,full_118_GLB_browser:'not executed'}));
