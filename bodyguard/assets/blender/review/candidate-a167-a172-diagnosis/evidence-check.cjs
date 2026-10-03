// FR-A-02/08: immutable diagnostic evidence, NOT appearance/clinical approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const zlib=require('node:zlib'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../../..'),bytes=f=>fs.readFileSync(path.join(__dirname,f));
const json=f=>JSON.parse(bytes(f)),decoded=f=>JSON.parse(zlib.gunzipSync(bytes(f)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=json('copy-manifest.json'),execution=json('execution-record.json');
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'inherit'});
for(const row of [...manifest.previous_control_files,...manifest.protected_repository_inputs])
 assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256);
for(const row of manifest.copies){
 const data=bytes(row.file);assert.equal(data.length,row.bytes);assert.equal(sha(data),row.sha256);
 assert.equal(sha(row.file.endsWith('.gz')?zlib.gunzipSync(data):data),row.decoded_sha256);
}
assert.equal(manifest.protected_old_file_count,702);assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,23);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,14);
const png=manifest.copies.filter(r=>r.file.endsWith('.png')).map(r=>r.file);
assert.deepEqual([...png].sort(),[...execution.directly_viewed].sort());assert.equal(new Set(png).size,4);
for(const f of png)assert.equal(bytes(f).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert(!manifest.copies.some(r=>/\.(blend|glb)$/.test(r.file)));
assert(!manifest.copies.some(r=>/^a168-report|a169-female/.test(r.file)));
const r167=json('a167-report.json'),r169=json('a169-male-report.json'),r170=json('a170-report.json'),r171=json('a171-report.json'),r172=json('a172-report.json');
for(const r of [r167,r169,r170,r171,r172]){
 assert.equal(r.input_sha256,'602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9');
 assert.equal(r.professional_sha256,'3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137');
 assert(!r.source_saved&&!r.appearance_approved&&!r.full_deformation_qa);
 if(r.rows)assert.deepEqual(r.rows.map(row=>row.body),['Male','Female']);
}
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),r167.input_sha256);
assert.deepEqual(r167.rows.map(r=>r.bridge_trace.fold_roles),[
 {original_cut_boundary:10,new_connector:67,professional_cut_boundary:14},
 {original_cut_boundary:4,new_connector:42,professional_cut_boundary:12},
]);
assert.deepEqual(r167.rows.map(r=>Math.max(...r.bridge_trace.professional_fans.map(f=>f.bridge_faces))),[61,84]);
assert.deepEqual(r167.rows.map(r=>r.bridge_trace.folds.length),[91,58]);
assert(r167.rows.every(r=>r.bridge_trace.all_original_and_professional_coordinates_skin_before_after_bridge_exact));
assert.equal(r169.body,'Male');assert.equal(r169.open_edge_count,144);
assert.deepEqual(r169.open_edge_roles,{new_connector:144});assert.equal(r169.actual_unique_anchor_pairs,101);
assert.equal(r169.expected_anchor_connections_found,82);assert.equal(r169.outside_original_faces_check_executed,false);
assert(r169.all_bridge_input_coordinates_skin_ids_exact);
assert.equal(r169.endpoints.filter(e=>e.expected_pair_connected).length,82);
for(const key of ['edgenet_fill','contextual_create','triangle_fill'])assert(r169.native_operator_docs[key].includes('bmesh.ops.'+key));
assert.deepEqual(r170.rows.map(r=>r.after.local_long_folds),[144,93]);
assert.deepEqual(r170.rows.map(r=>r.native_interval_correspondence.actual_unique_anchor_pairs),[101,101]);
for(const r of [r167,r170]){
 assert.deepEqual(r.rows.map(row=>row.native_boundary_edges),[[649,114],[634,108]]);
 assert.deepEqual(r.rows.map(row=>row.retained_old_points),[117040,114293]);
 assert.deepEqual(r.rows.map(row=>row.removed_old_interior_points),[12590,14096]);
 assert.deepEqual(r.rows.map(row=>row.professional_authored_points_exact),[402,394]);
 assert.deepEqual(r.rows.map(row=>row.actual_face_center_edge_midpoint_samples),[1526,1484]);
 assert(r.rows.every(row=>!row.geometry_guards_passed&&!row.all_original_body_coordinates_skin_exact&&row.xz_projection_failure_not_cleared&&row.new_bridge_points===0&&row.retained_coordinate_skin_hands_163_rest_bones_world_outside_faces_exact&&row.retained_maximum_displacement_m===0&&row.bridge_to_professional_surface_sample_max_m>.006&&row.after.global_nonmanifold===0&&row.after.global_winding_errors===0&&row.after.local_tiny_faces===0));
}
assert(r170.rows.every(r=>r.native_bridge.endpoint_pairs_pinned&&r.native_bridge.new_vertices===0));
for(const report of [r171,r172]){
 assert(report.read_only&&report.rows.every(r=>!r.native_bridge_performed&&!r.anatomical_registration_verified&&r.all_current_coordinates_skin_faces_groups_163_rest_bones_world_exact));
 for(const row of report.rows){
  for(const contour of [row.source_contour,row.professional_contour]){
   assert.equal(contour.points_m.length,contour.boundary_vertices);
   assert(contour.shared_cyclic_geometric_order&&new Set(contour.landmark_indices).size===4);
   assert.deepEqual(contour.landmarks_m,contour.landmark_indices.map(i=>contour.points_m[i]));
  }
  for(const pairs of [row.global_control,row.regional_geometric]){
   assert.equal(pairs.pairs_m.length,pairs.anchor_pairs);
   assert.equal(pairs.opposite_x_pairs,pairs.pairs_m.filter(([a,b])=>a[0]*b[0]<0).length);
   const distance=Math.max(...pairs.pairs_m.map(([a,b])=>Math.hypot(...a.map((n,i)=>n-b[i]))));
   assert(Math.abs(distance-pairs.maximum_connector_length_m)<1e-8);
  }
 }
}
assert.deepEqual(r171.rows.map(r=>r.global_control.anchor_pairs),[101,101]);
assert.deepEqual(r171.rows.map(r=>r.global_control.opposite_x_pairs),[18,15]);
assert.deepEqual(r171.rows.map(r=>r.regional_geometric.opposite_x_pairs),[4,1]);
assert(r171.rows.every(r=>r.regional_geometric.maximum_connector_length_m>.08));
assert.deepEqual(r172.rows.map(r=>r.nested_professional_plan.patch_faces),[506,509]);
assert.deepEqual(r172.rows.map(r=>r.professional_contour.boundary_vertices),[140,154]);
assert(r172.rows.every(r=>r.minimum_boundary_xz_clearance_m>=.008&&r.nested_professional_plan.simple_disk_before_extraction&&r.nested_professional_plan.selected_components_faces.length===1&&r.regional_geometric.maximum_connector_length_m>.06));
assert.deepEqual(execution.native_runs.map(row=>row.exit_code),[0,1,1,1,0,0]);
for(const row of execution.native_runs){
 const log=decoded(row.log);assert.equal(log.exit_code,row.exit_code);assert.equal(log.command.cmd,row.command);
 assert.equal(log.chunks.at(-1).chunk_id,row.terminal_chunk_id);assert.equal(log.chunks.at(-1).exit_code,row.exit_code);
 assert(row.terminal_stdout_retained&&!log.stdout_reconstructed&&log.output_kind==='actual_tool_chunks');
 assert(log.chunks.every(c=>!c.output.includes('Warning: truncated')));
}
const staticLog=decoded('logs/static-observed.json.txt.gz');assert.equal(staticLog.checks.length,6);
assert(staticLog.checks.every(row=>row.checks.length===3&&row.checks.every(c=>c.exit_code===0)));
assert.equal(staticLog.historical_pre_native_a168_initial[0].exit_code,1);
assert.equal(execution.evidence_copy.exit_code,0);
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped&&!execution.diagnosis_gate_results.previous_xz_failure_cleared);
for(const field of ['source_full_118','glb_full_118','actual_Chrome_tests','actual_webcam_trials'])assert.equal(execution.new_verification[field],0);
assert(Object.values(execution.new_assets).every(v=>v===0));
assert(Object.values(execution.limitations).every(v=>v===false));
console.log(JSON.stringify({integrity_passed:true,copies:23,gzip:14,protected_old_files:702,native_exits:[0,1,1,1,0,0],actual_png:4,directly_viewed:4,new_assets:0,new_118:0,new_Chrome:0,pinned_closed_but_geometry_failed:true,regional_geometric_not_anatomical_registration:true,appearance_passed:false}));
