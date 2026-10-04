// FR-A-02/03/08: integrity and recorded execution are not visual/medical approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const read=f=>fs.readFileSync(path.join(__dirname,f)),json=f=>JSON.parse(read(f)),gz=f=>JSON.parse(zlib.gunzipSync(read(f)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../../../../..');
const manifest=json('copy-manifest.json'),record=json('execution-record.json');
assert.deepEqual(manifest.counts,{copies:45,gzip:27,PNG:16,blend:2,GLB:0});
assert.equal(new Set(manifest.copies.map(r=>r.file)).size,45);
for(const row of manifest.copies){const bytes=read(row.file),decoded=row.file.endsWith('.gz')?zlib.gunzipSync(bytes):bytes;assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,row.file);assert.equal(sha(decoded),row.decoded_sha256,row.file);if(row.file.endsWith('.png'))assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
assert.equal(new Set(manifest.protected_prior.map(r=>r.file)).size,641);
for(const row of manifest.protected_prior)assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256,row.file);
for(const name of ['avatar_skin_guard.py','test_avatar_skin_guard.py','skin_coefficients.py','test_skin_coefficients.py','remove_joint_overlays.py'])assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender',name))),sha(zlib.gunzipSync(read('executed-helpers/'+name+'.txt.gz'))),name);
const source='0e6243e64b65841510d2ed926f3bf315e3cc101dbfa57d41beafb8bcedc8a104';
assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender/review/candidate-a243-a251-diagnosis/a250/artist-candidate.blend'))),source);
const flow=gz('diagnosis/a260-edge-flow.json.txt.gz'),equality=gz('diagnosis/a263-numeric-equality.json.txt.gz');
assert(flow.read_only&&flow.source_files_unchanged&&flow.not_clinical_or_photographic_registration);
assert.deepEqual(flow.rows.map(r=>r.fixed_edges),[15792,15476]);
for(const row of flow.rows)assert(row.all_source_and_candidate_points_skin_faces_groups_rest_pose_world_unchanged&&row.original_normal_y_selection_not_positive_position_y);
assert(flow.rows[1].bands[1].candidate_max_deg>40);
assert(equality.read_only&&equality.source_files_unchanged&&equality.not_clinical_or_photographic_registration);
assert.deepEqual(equality.rows.map(r=>r.native_vector_changed_count),[2408,2900]);
assert.deepEqual(equality.rows.map(r=>r.exact_numeric_changed_count),[2408,2901]);
const counterexample=equality.rows[1].native_vector_equal_but_coordinates_changed;
assert.equal(counterexample.length,1);assert.equal(counterexample[0].point_index,35881);
assert.equal(counterexample[0].native_vector_equal,true);assert.equal(counterexample[0].numeric_tuple_equal,false);
assert.deepEqual(counterexample[0].delta,[0,3.725290298461914e-9,0]);
for(const [stage,reopen] of [['a261','a262'],['a264','a265']]){
  const maker=gz(stage+'/fairing-report.json.txt.gz'),saved=gz('diagnosis/'+reopen+'-saved-native.json.txt.gz');
  assert.equal(maker.source_sha256,source);assert(maker.saved_candidate);
  assert.equal(sha(read(stage+'/artist-candidate.blend')),maker.candidate_sha256);
  assert(saved.passed&&saved.independent_saved_native_reopen);
  assert.deepEqual(saved.rows.map(r=>r.changed_points),[2408,2901]);
  assert.deepEqual(maker.rows.map(r=>r.actually_changed_body_points),stage==='a261'?[2408,2900]:[2408,2901]);
  assert.deepEqual(Object.values(saved.input_sha256).sort(),[source,maker.candidate_sha256].sort());
  for(const [i,row]of maker.rows.entries()){
    assert(row.existing_6mm_guard_and_geometry_passed&&row.only_y_component_written_x_and_z_never_written);
    assert(!row.posthoc_coordinate_restoration&&!row.whole_neck_remesh);
    assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006);
    assert.equal(row.pre_save_individual_and_sum_skin_guard_vertices,row.before.vertices);
    assert.deepEqual(row.artist_region,[.875,.94]);
    assert(row.all_temporary_object_data_mask_removed_before_save);
    for(const field of ['vertices','faces','nonmanifold','winding_errors','tiny_faces','long_folds'])assert.equal(row.before[field],row.after[field]);
    assert.equal(row.before.fixed_original_posterior_edge_angles_deg.count,[15792,15476][i]);
    assert(row.after.fixed_original_posterior_edge_angles_deg.max<row.before.fixed_original_posterior_edge_angles_deg.max);
    assert(row.after.fixed_original_posterior_edge_angles_deg.p95>row.before.fixed_original_posterior_edge_angles_deg.p95);
    // Legacy A261's Vector predicates are not relabelled as strict tuple predicates.
    if(stage==='a264')assert(row.coordinate_guards_and_changed_count_use_exact_numeric_tuples&&row.zero_mask_coordinates_exact&&row.native_crop_boundary_zero_mask_coordinates_exact);
  }
  for(const row of saved.rows){
    assert(row.all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact&&row.all_point_ledgers_and_a239_parent_attribute_exact&&row.pose_basis_exact);
    assert(row.all_original_x_coordinates_exact&&row.all_original_z_coordinates_exact&&row.original_normal_y_le_quarter_coordinates_exact&&row.independent_individual_and_sum_skin_guard_passed);
    assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006);
  }
  for(const report of [maker,saved])for(const field of ['appearance_approved','full_deformation_qa','GLB_qa','browser_qa'])assert.equal(report[field],false);
}
assert.equal(record.native_runs.length,6);assert(record.native_actors_sequential);assert.equal(record.prepared_not_executed.length,0);
for(const run of record.native_runs){assert(run.command&&run.full_stdout_preserved);assert.equal(run.chunks.at(-1).exit_code,0);assert.deepEqual(gz(run.stdout_archive),run);for(const c of run.chunks)assert(!/Warning: truncated output/.test(c.output));}
assert.equal(record.final_static.result.exit_code,0);assert.match(record.final_static.result.output,/8 files already formatted/);
assert.equal(record.unit_verification.result.exit_code,0);assert.match(record.unit_verification.result.output,/Ran 29 tests/);
assert.equal(record.synthetic_graph_tests.result.exit_code,0);assert.match(record.synthetic_graph_tests.result.output,/Ran 9 tests/);
assert.equal(record.pre_native_edit_failure.native_execution,false);assert(record.pre_native_edit_failure.corrected_before_execution);
assert.equal(record.actual_renders,16);assert.equal(new Set(record.directly_viewed).size,16);
for(const file of record.directly_viewed)assert(manifest.copies.some(r=>r.file===file&&file.endsWith('.png')));
for(const field of ['appearance_approved','service_adopted','pr_merge_allowed','stages_1_to_6_completed','guards_relaxed','coordinates_or_skin_restored'])assert.equal(record[field],false);
assert.equal(record.current_development_asset,'A37');assert(record.goal_continues);
assert.equal(record.full_118_deformation_runs,0);assert.equal(record.GLB_files,0);assert.equal(record.browser_runs.length,0);assert.equal(record.camera_calls,0);assert.equal(record.human_capture_upload_calls,0);
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bghp_[A-Za-z0-9]{36}\b/,/\bgithub_pat_[A-Za-z0-9_]{60,}\b/];
for(const row of manifest.copies.filter(r=>r.file.endsWith('.gz')))assert(forbidden.every(p=>!p.test(zlib.gunzipSync(read(row.file)).toString('utf8'))),row.file);
let links=0;for(const m of read('README.md').toString('utf8').matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){if(/^(https?:|codex:|mailto:|#)/.test(m[1]))continue;const target=m[1].split('#')[0].replace(/^<|>$/g,'');assert(fs.existsSync(path.resolve(__dirname,decodeURIComponent(target))),target);links++;}
console.log(JSON.stringify({integrity_passed:true,...manifest.counts,protected_prior:641,native_runs:6,native_failure:0,directly_viewed:16,synthetic_unit_tests:29,local_links_checked:links,limited_gzip_secret_scan:27,not_full_security_audit:true,appearance_approved:false,service_adopted:false,full_118_GLB_browser:'not executed'}));
