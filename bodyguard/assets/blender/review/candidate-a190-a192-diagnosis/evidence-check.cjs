// Immutable native local-interface study evidence; not release or anatomy approval.
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
assert.equal(manifest.protected_old_file_count,915);assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,34);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,16);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.png')).length,18);
assert(!manifest.copies.some(r=>/\.(blend|glb)$/.test(r.file)));
const phases=['a190','a191','a192'];
const folds=[[62,41],[0,57],[0,0]];
for(const [i,phase]of phases.entries()){
 const report=decoded(phase+'/native-authored-overlap.json.txt.gz');
 assert.equal(report.input_sha256,'602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9');
 assert.equal(report.professional_sha256,'3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137');
 assert(report.all_current_coordinates_skin_faces_groups_163_rest_bones_world_exact);
 assert.equal(report.actual_png,6);assert.equal(report.rows.length,2);
 assert(!report.source_saved&&!report.glb_saved&&!report.appearance_approved&&!report.full_deformation_qa);
 for(const [j,row]of report.rows.entries()){
  assert.equal(row.body,['Male','Female'][j]);assert(row.head_neck_diagnostic_render);
  assert(!row.source_saved&&!row.service_avatar&&!row.appearance_approved&&!row.full_deformation_qa);
  const p=row.fairing.front_envelope_projection;
  assert(p.native_convex_envelope_of_existing_professional_cage&&p.x_z_exact_after_projection);
  assert(!p.generated_primitive_or_replacement_mesh&&!p.anatomical_or_reference_match_verified);
  assert(p.maximum_projection_depth_change_m>.015&&p.maximum_projection_depth_change_m<.020);
  assert(row.fairing.cage_topology_exact&&row.fairing.zero_weight_vertices_exact);
  const f=row.native_fusion;
  assert.equal(f.native_boolean_solver,'EXACT');assert.equal(f.professional_body_cut_ratio,.86);
  assert(f.all_professional_body_points_below_79_percent_exact);
  assert(!f.current_avatar_edited&&!f.whole_rig_skin_deformation_verified&&!f.anatomical_registration_verified&&!f.appearance_approved);
  assert(!f.count_only_bridge_or_primitive_or_body_neck_voxel_remesh);
  assert.equal(f.stages.length,3);
  const g=i===0?f.stages.at(-1).geometry:f.local_interface_fairing.geometry_after;
  assert.equal(g.local_long_folds,folds[i][j]);
  assert.equal(g.components_faces.length,1);assert(g.finite);
  for(const key of ['boundary_edges','wire_edges','nonmanifold_edges','winding_errors','tiny_faces'])assert.equal(g[key],0);
  if(i===0){assert(!g.closed_geometry_passed);continue;}
  const c=f.local_interface_fairing;
  assert(c.zero_mask_coordinates_exact&&c.new_copy_topology_exact_before_after_local_fairing);
  assert(c.existing_6mm_guard_passed);assert.equal(c.over_existing_6mm_guard_vertices,0);
  assert(c.maximum_displacement_m<.006);assert.equal(c.geodesic_support_radius_m,.016);
  assert.equal(c.factor,.35);assert.equal(c.iterations,16);
  assert(!c.whole_neck_remesh&&c.not_clinical_or_full_skin_verification);
  assert.equal(c.passed,i===2||j===0);assert.equal(g.closed_geometry_passed,c.passed);
  if(i===2){
   const t=c.local_interface_topology;
   assert(t.local_native_triangulate&&t.original_coordinates_exact_after_local_topology&&t.unrelated_faces_exact);
   assert(!t.whole_body_or_neck_remesh);assert.equal(t.local_native_subdivide_edges_cuts,1);
   assert.equal(t.after_vertices,[96844,94259][j]);assert.equal(t.unrelated_retained_faces,[93296,92440][j]);
   if(j===0)assert(g.local_max_dihedral_deg>140);
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
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),execution.input_sha256);
assert(Object.values(execution.new_assets).every(v=>v===0));
assert.equal(execution.new_verification.PNG,18);assert.equal(execution.new_verification.directly_viewed_PNG,18);
for(const [k,v]of Object.entries(execution.new_verification))if(!['PNG','directly_viewed_PNG'].includes(k))assert.equal(v,0);
assert(Object.values(execution.limitations).every(v=>v===false));
assert(Object.values(execution.preserved_rules).every(v=>v===true));
assert.equal(execution.reference_sha256,'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
console.log(JSON.stringify({integrity_passed:true,copies:34,gzip:16,protected_old_files:915,native_exits:[0,0,0],
 actual_PNG:18,directly_viewed:18,a192_local_guard_passed:true,new_assets:0,new_118:0,new_Chrome:0,appearance_passed:false}));
