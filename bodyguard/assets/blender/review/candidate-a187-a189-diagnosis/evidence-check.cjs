// Immutable authored-frame/front-surface evidence, not an avatar or anatomy approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const zlib=require('node:zlib'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../../..'),bytes=f=>fs.readFileSync(path.join(__dirname,f));
const json=f=>JSON.parse(bytes(f)),decoded=f=>JSON.parse(zlib.gunzipSync(bytes(f)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=json('copy-manifest.json'),execution=json('execution-record.json');
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'inherit'});
for(const r of [...manifest.previous_control_files,...manifest.protected_repository_inputs])
 assert.equal(sha(fs.readFileSync(path.join(root,r.file))),r.sha256);
for(const r of manifest.copies){
 const raw=bytes(r.file);assert.equal(raw.length,r.bytes);assert.equal(sha(raw),r.sha256);
 const data=r.file.endsWith('.gz')?zlib.gunzipSync(raw):raw;assert.equal(sha(data),r.decoded_sha256);
 if(r.file.endsWith('.png')){
  assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(raw.readUInt32BE(16),600);assert.equal(raw.readUInt32BE(20),700);
 }
}
assert.equal(manifest.protected_old_file_count,871);assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,40);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,16);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.png')).length,24);
assert(!manifest.copies.some(r=>/\.(blend|glb)$/.test(r.file)));
const reports=[decoded('a187/authored-frame-comparison.json.txt.gz'),decoded('a188/local-head-fairing.json.txt.gz'),decoded('a189/local-head-fairing.json.txt.gz')];
for(const r of reports){
 assert.equal(r.input_sha256,'602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9');
 assert.equal(r.professional_sha256,'3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137');
 assert(r.all_current_coordinates_skin_faces_groups_163_rest_bones_world_exact);
 assert(!r.source_saved&&!r.glb_saved&&!r.appearance_approved&&!r.full_deformation_qa);
}
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),reports[0].input_sha256);
assert(reports[0].read_only_current_avatar);assert.equal(reports[0].actual_png,0);
for(const row of reports[0].rows){
 assert(row.independent_parent_matrix_checks_passed&&row.root_relative_comparison_is_not_anatomical_registration);
 assert(!row.anatomical_registration_verified&&!row.current_avatar_edited);
 assert.equal(row.actual_sources.realistic_body.vertices,42342);
 assert.equal(row.actual_sources.current_pipeline_blank_head.vertices,67586);
 assert.equal(row.actual_sources.current_pipeline_companion_neck.vertices,12290);
 assert(row.primitive_root_y_m<0);
 const s=row.actual_sections;
 assert.equal(s.realistic_body.length,8);
 assert.equal(s.current_pipeline_blank_head.length,8);
 const near90=s.realistic_body.find(p=>Math.abs(p.height_ratio-.90)<1e-8);
 assert(near90&&near90.closed_rings.length===2);
}
for(const [i,r]of reports.slice(1).entries()){
 assert.equal(r.actual_png,12);assert.equal(r.rows.length,4);
 assert.equal(r.rows.filter(p=>p.mode==='authored').length,2);
 for(const row of r.rows){
  assert.equal(row.vertices,67586);
  assert(row.head_only_render&&row.no_body_conformance_or_voxel_or_union);
  assert(row.all_target_coordinates_exact_after_shading_and_read_only_sections&&row.all_polygons_smooth);
  assert(!row.source_saved&&!row.service_avatar&&!row.appearance_approved);
  if(row.mode==='authored'){assert.equal(row.fairing,null);continue;}
  const c=row.fairing;
  assert.equal(c.authored_cage_vertices,266);assert(c.cage_topology_exact&&c.zero_weight_vertices_exact);
  assert.equal(c.native_modifier,'SMOOTH');assert.equal(c.factor,.5);assert.equal(c.iterations,12);
  assert.deepEqual(c.axes,['X','Y','Z']);assert(c.continuous_smoothstep_mask);
  assert(!c.whole_head_or_neck_remesh&&!c.anatomical_or_reference_match_verified);
  if(i===0){
   assert(['local-xyz'].includes(row.mode));
   assert(c.maximum_cage_displacement_m>.018&&c.maximum_cage_displacement_m<.020);
  }else{
   assert.equal(row.mode,'convex-front-local-xyz');
   const p=c.front_envelope_projection;
   assert(p.native_convex_envelope_of_existing_professional_cage&&p.x_z_exact_after_projection);
   assert(!p.generated_primitive_or_replacement_mesh&&!p.anatomical_or_reference_match_verified);
   assert(p.maximum_projection_depth_change_m>.065&&p.maximum_projection_depth_change_m<.070);
   assert(c.total_cage_displacement_m>.020&&c.total_cage_displacement_m<.028);
  }
 }
}
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[0,0,0]);
for(const row of execution.native_runs){
 const log=decoded(row.log);
 assert.equal(log.command,row.command);assert.equal(log.exit_code,row.exit_code);
 assert.equal(log.terminal_chunk_id,row.terminal_chunk_id);
 assert.equal(log.chunks.at(-1).exit_code,0);assert.equal(log.chunks.at(-1).chunk_id,row.terminal_chunk_id);
 assert(log.chunks.every(c=>!c.output.includes('Warning: truncated')));
 assert(row.full_stdout_retained&&row.current_full_snapshot_completed);
 assert.equal(log.static.length,3);assert(log.static.every(r=>r.exit_code===0));
}
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped);
assert.equal(execution.evidence_copy.exit_code,0);assert.equal(execution.evidence_copy.chunks.at(-1).exit_code,0);
assert(Object.values(execution.new_assets).every(v=>v===0));
assert.equal(execution.new_verification.PNG,24);assert.equal(execution.new_verification.directly_viewed_PNG,24);
for(const [k,v]of Object.entries(execution.new_verification))if(!['PNG','directly_viewed_PNG'].includes(k))assert.equal(v,0);
assert(Object.values(execution.limitations).every(v=>v===false));
assert.equal(execution.reference_sha256,'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
console.log(JSON.stringify({integrity_passed:true,copies:40,gzip:16,protected_old_files:871,native_exits:[0,0,0],
 actual_PNG:24,directly_viewed:24,new_assets:0,new_118:0,new_Chrome:0,appearance_passed:false}));
