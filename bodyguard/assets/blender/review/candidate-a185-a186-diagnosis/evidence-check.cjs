// FR-A-02/03/08: immutable contour evidence, not an anatomy/appearance pass.
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
 assert.equal(sha(zlib.gunzipSync(raw)),r.decoded_sha256);assert(r.file.endsWith('.gz'));
}
assert.equal(manifest.protected_old_file_count,851);assert.equal(manifest.old_files_changed,0);assert.equal(manifest.copies.length,16);
assert(!manifest.copies.some(r=>/\.(blend|glb|png)$/.test(r.file)));
const reports=['a185','a186'].map(phase=>decoded(phase+'/head-cleanup-report.json.txt.gz'));
for(const r of reports){
 assert.equal(r.input_sha256,'602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9');
 assert.equal(r.professional_sha256,'3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137');
 assert(r.read_only_current_avatar&&r.all_current_coordinates_skin_faces_groups_163_rest_bones_world_exact);
 assert(!r.patch_source_saved&&!r.service_avatar_saved&&!r.appearance_approved&&!r.full_deformation_qa);
}
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),reports[0].input_sha256);
for(const [i,row]of reports[0].rows.entries()){
 const c=row.cleanup;
 assert(c.read_only_actual_cut_copies&&c.no_native_bridge_or_new_topology&&!c.anatomical_registration_verified&&!c.cleanup_geometry_passed);
 assert(c.geometric_correspondence_certificate_passed&&c.all_original_boundary_anchors_exactly_once&&c.existing_input_copy_coordinates_unedited_after_certificate);
 assert.equal(c.event_count,[427,389][i]);assert.equal(c.opposite_ring_bearing_tolerance_rad,.00001);
 assert.equal(c.actual_correspondence.length,c.event_count);
 assert.deepEqual(c.actual_boundary_rings.map(r=>r.points),[[162,266],[128,262]][i]);
 assert(c.actual_boundary_rings.every(r=>r.strictly_star_shaped_about_area_centroid&&r.minimum_actual_angle_increment_rad>0));
 assert(c.maximum_connection_length_m>.077&&c.maximum_connection_length_m<.087);
 const anchors=c.actual_correspondence.flatMap(p=>Object.entries(p.anchors).filter(([,a])=>a.native_existing_anchor).map(([side,a])=>side+':'+a.index));
 assert.equal(new Set(anchors).size,[428,390][i]);assert.equal(anchors.length,[428,390][i]);
}
assert.deepEqual(reports[1].rows.map(r=>r.cleanup.local_long_folds),[65,37]);
for(const [i,row]of reports[1].rows.entries()){
 const c=row.cleanup;
 assert(!c.cleanup_geometry_passed&&!c.closed_geometry_passed&&!c.anatomical_registration_verified);
 assert.equal(c.event_count,[427,389][i]);assert.equal(c.new_bridge_faces,c.event_count);
 assert.equal(c.explicit_matching_connecting_edges,c.event_count);
 assert.deepEqual(c.native_edge_splits,[[265,161],[261,127]][i]);
 assert(c.every_original_boundary_point_exact&&c.all_pre_join_input_points_exact&&c.all_professional_points_below_low_cut_exact&&c.all_target_head_points_above_high_cut_exact);
 assert(c.finite&&c.boundary_edges===0&&c.wire_edges===0&&c.nonmanifold_edges===0&&c.tiny_faces===0&&c.winding_errors===0);
 assert(c.maximum_bridge_to_professional_or_target_surface_m>.030&&c.samples_over_existing_6mm>0);
 assert(!c.native_bridge_operator_used&&!c.count_only_or_uniform_resampling&&!c.head_conformance_or_voxel_or_boolean&&!c.body_or_whole_neck_remesh&&!c.body_smoothing&&!c.current_service_avatar_edited);
 assert(c.native_smooth_shading_geometry_exact&&c.new_interior_points===0);
}
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[0,1]);
for(const row of execution.native_runs){
 const log=decoded(row.log);assert.equal(log.command,row.command);assert.equal(log.exit_code,row.exit_code);
 assert.equal(log.terminal_chunk_id,row.terminal_chunk_id);assert.equal(log.chunks.at(-1).exit_code,row.exit_code);
 assert.equal(log.chunks.at(-1).chunk_id,row.terminal_chunk_id);assert(log.chunks.every(c=>!c.output.includes('Warning: truncated')));
 assert(row.full_stdout_retained&&row.current_full_snapshot_completed);
 assert.equal(log.static.length,3);assert(log.static.every(r=>r.exit_code===0));
 if(row.phase==='a185'){
  assert.deepEqual(log.initial_static.map(r=>r.exit_code),[1,1,0]);assert(log.initial_static[0].output.includes('F401'));
  assert(log.initial_generator_failure.before_file_edits&&!log.initial_generator_failure.native_executed);
 }else assert(log.chunks.at(-1).output.includes('no render/source'));
}
const auxiliary=decoded('logs/a185-auxiliary-observed.json.txt.gz');
assert.equal(auxiliary.initial_read_only_query.exit_code,1);
assert(!auxiliary.initial_read_only_query.full_stdout_retained&&!auxiliary.initial_read_only_query.model_or_file_write);
assert.equal(auxiliary.recheck.exit_code,0);
assert.equal(execution.evidence_copy.terminal.exit_code,0);
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped);
assert(Object.values(execution.new_assets).every(v=>v===0)&&Object.values(execution.new_verification).every(v=>v===0));
assert(Object.values(execution.limitations).every(v=>v===false));
assert.equal(execution.reference_sha256,'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
console.log(JSON.stringify({integrity_passed:true,copies:16,gzip:16,protected_old_files:851,native_exits:[0,1],actual_correspondence_only_passed:true,
 local_retopology_geometry_passed:false,new_assets:0,new_PNG:0,new_118:0,new_Chrome:0,appearance_passed:false}));
