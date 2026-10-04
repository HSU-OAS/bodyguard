// FR-A-02/03/08: archive integrity and observed outcomes are not appearance approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),zlib=require('node:zlib');
const read=f=>fs.readFileSync(path.join(__dirname,f));
const json=f=>JSON.parse(read(f)),gz=f=>JSON.parse(zlib.gunzipSync(read(f)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.resolve(__dirname,'../../../../..');
const manifest=json('copy-manifest.json'),record=json('execution-record.json');
assert.deepEqual(manifest.counts,{copies:28,gzip:19,PNG:8,blend:1,GLB:0});
assert.equal(manifest.copies.length,28);assert.equal(new Set(manifest.copies.map(r=>r.file)).size,28);
for(const row of manifest.copies){const bytes=read(row.file),decoded=row.file.endsWith('.gz')?zlib.gunzipSync(bytes):bytes;assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,row.file);assert.equal(sha(decoded),row.decoded_sha256,row.file);if(row.file.endsWith('.png'))assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
assert.equal(manifest.protected_prior.length,609);assert.equal(new Set(manifest.protected_prior.map(r=>r.file)).size,609);
for(const row of manifest.protected_prior)assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256,row.file);
for(const name of ['avatar_skin_guard.py','test_avatar_skin_guard.py','skin_coefficients.py','test_skin_coefficients.py','remove_joint_overlays.py'])assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender',name))),sha(zlib.gunzipSync(read('executed-helpers/'+name+'.txt.gz'))),name);
const sourceHash='0e6243e64b65841510d2ed926f3bf315e3cc101dbfa57d41beafb8bcedc8a104';
assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender/review/candidate-a243-a251-diagnosis/a250/artist-candidate.blend'))),sourceHash);
const maker=gz('a257/fairing-report.json.txt.gz'),saved=gz('diagnosis/a258-saved-native.json.txt.gz'),lateral=gz('diagnosis/a259-lateral-profiles.json.txt.gz');
assert.equal(maker.source_sha256,sourceHash);assert.equal(maker.saved_candidate,true);assert.equal(sha(read('a257/artist-candidate.blend')),maker.candidate_sha256);
const prior=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'bodyguard/assets/blender/review/candidate-a252-a256-diagnosis/a255/fairing-report.json.txt.gz'))));
for(const [i,row]of maker.rows.entries()){
  assert(row.zero_mask_coordinates_exact&&row.all_numeric_skin_faces_group_order_hands_163_rest_bones_world_materials_exact);
  assert(row.all_original_x_coordinates_exact&&row.all_original_z_coordinates_exact&&row.original_normal_y_le_quarter_coordinates_exact);
  assert(row.only_y_component_written_x_and_z_never_written&&!row.posthoc_coordinate_restoration&&!row.whole_neck_remesh&&row.source_body_topology_not_decimated);
  assert(row.continuous_selection_weight_precomputed_before_edit&&row.target_cubic_endpoint_values_and_slopes_preserved&&row.actual_mesh_tangent_continuity_and_appearance_not_inferred_from_target_curve);
  assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006&&row.maximum_proposed_depth_change_m<.006);
  assert(row.existing_6mm_guard_and_geometry_passed);assert.equal(row.pre_save_individual_and_sum_skin_guard_vertices,row.before.vertices);
  for(const field of ['vertices','faces','nonmanifold','winding_errors','tiny_faces','long_folds'])assert.equal(row.before[field],row.after[field]);
  assert.deepEqual(row.fixed_original_measurement_edge_pairs,prior.rows[i].fixed_original_measurement_edge_pairs);
  assert.equal(row.before.fixed_original_posterior_edge_angles_deg.count,[15792,15476][i]);
  assert.deepEqual(row.tangent_anchor_height_fraction,i===0?[.886,.907]:[.893,.916]);
  assert.equal(row.native_profile_before.length,row.native_profile_after.length);
  assert.equal(row.appearance_approved,false);
}
assert(maker.rows[0].after.fixed_original_posterior_edge_angles_deg.p95<maker.rows[0].before.fixed_original_posterior_edge_angles_deg.p95);
assert(maker.rows[1].after.fixed_original_posterior_edge_angles_deg.p95>maker.rows[1].before.fixed_original_posterior_edge_angles_deg.p95);
for(const row of maker.rows)assert(row.after.fixed_original_posterior_edge_angles_deg.max>row.before.fixed_original_posterior_edge_angles_deg.max);
assert(saved.passed&&saved.independent_saved_native_reopen);assert.deepEqual(saved.rows.map(r=>r.changed_points),[2504,2742]);
assert.deepEqual(Object.values(saved.input_sha256).sort(),[sourceHash,maker.candidate_sha256].sort());
for(const row of saved.rows){assert(row.all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact&&row.all_point_ledgers_and_a239_parent_attribute_exact&&row.pose_basis_exact);assert(row.all_original_x_coordinates_exact&&row.all_original_z_coordinates_exact&&row.original_normal_y_le_quarter_coordinates_exact&&row.independent_individual_and_sum_skin_guard_passed);assert(row.maximum_artist_displacement_m>0&&row.maximum_artist_displacement_m<.006);}
assert(lateral.read_only&&lateral.source_files_unchanged&&lateral.not_clinical_or_photographic_registration);assert.equal(lateral.native_sections,44);assert.deepEqual(Object.values(lateral.input_sha256).sort(),[sourceHash,maker.candidate_sha256].sort());
assert.equal(lateral.assets.length,2);let sections=0,missingFullProfiles=0;
for(const asset of lateral.assets){assert.equal(asset.rows.length,2);for(const row of asset.rows){assert(row.all_coordinates_skin_faces_groups_rest_pose_world_unchanged);assert.equal(row.profiles.length,11);for(const p of row.profiles){sections++;assert.equal(p.rows.length,row.gender==='Male'?24:26);if(p.measured_curve===null)missingFullProfiles++;}}}
assert.equal(sections,44);assert.equal(missingFullProfiles,16);
const female=lateral.assets[0].rows[1];for(const x of [-.02,.02])assert(female.profiles.find(p=>p.x_height_fraction===x).measured_curve.sample_max_abs_target_depth_m>.006);
for(const report of [maker,saved])for(const field of ['appearance_approved','full_deformation_qa','GLB_qa','browser_qa'])assert.equal(report[field],false);
assert.equal(record.native_runs.length,3);assert(record.native_actors_sequential);assert.equal(record.prepared_not_executed.length,0);
for(const run of record.native_runs){assert(run.command&&run.full_stdout_preserved);assert.equal(run.chunks.at(-1).exit_code,0);assert.deepEqual(gz(run.stdout_archive),run);for(const c of run.chunks)assert(!/Warning: truncated output/.test(c.output));}
assert.equal(record.initial_static.result.exit_code,1);assert.match(record.initial_static.result.output,/TRY004/);assert.equal(record.synthetic_curve_tests.result.exit_code,0);assert.match(record.synthetic_curve_tests.result.output,/Ran 9 tests/);
assert.equal(record.final_static.result.exit_code,0);assert.match(record.final_static.result.output,/5 files already formatted/);assert.equal(record.unit_verification.result.exit_code,0);assert.match(record.unit_verification.result.output,/Ran 29 tests/);
assert.equal(record.archive_pre_copy_failure.exit_code,1);assert.equal(record.archive_pre_copy_failure.native_failure,false);
assert.equal(record.archive_json_terminator_failure.exit_code,1);assert.equal(record.archive_json_terminator_failure.native_failure,false);
assert.equal(record.actual_renders,8);assert.equal(new Set(record.directly_viewed).size,8);for(const file of record.directly_viewed)assert(manifest.copies.some(r=>r.file===file&&file.endsWith('.png')));
for(const field of ['appearance_approved','service_adopted','pr_merge_allowed','stages_1_to_6_completed','guards_relaxed','coordinates_or_skin_restored'])assert.equal(record[field],false);
assert.equal(record.current_development_asset,'A37');assert(record.goal_continues);assert.equal(record.full_118_deformation_runs,0);assert.equal(record.GLB_files,0);assert.equal(record.browser_runs.length,0);assert.equal(record.camera_calls,0);assert.equal(record.human_capture_upload_calls,0);
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bghp_[A-Za-z0-9]{36}\b/,/\bgithub_pat_[A-Za-z0-9_]{60,}\b/];
for(const row of manifest.copies.filter(r=>r.file.endsWith('.gz')))assert(forbidden.every(p=>!p.test(zlib.gunzipSync(read(row.file)).toString('utf8'))),row.file);
let links=0;for(const m of read('README.md').toString('utf8').matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){if(/^(https?:|codex:|mailto:|#)/.test(m[1]))continue;const target=m[1].split('#')[0].replace(/^<|>$/g,'');assert(fs.existsSync(path.resolve(__dirname,decodeURIComponent(target))),target);links++;}
assert.equal(links,10);
console.log(JSON.stringify({integrity_passed:true,...manifest.counts,protected_prior:609,native_runs:3,native_failure:0,initial_static_failure:1,archive_pre_copy_failure:1,directly_viewed:8,native_sections:44,synthetic_unit_tests:29,local_links_checked:links,limited_gzip_secret_scan:19,not_full_security_audit:true,appearance_approved:false,service_adopted:false,full_118_GLB_browser:'not executed'}));
