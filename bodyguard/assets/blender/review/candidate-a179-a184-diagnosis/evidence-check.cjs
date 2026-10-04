// FR-A-02/03/08: validate immutable actual evidence, never convert failure into approval.
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
 assert.equal(sha(r.file.endsWith('.gz')?zlib.gunzipSync(raw):raw),r.decoded_sha256);
}
assert.equal(manifest.protected_old_file_count,770);assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,77);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,47);
const png=manifest.copies.filter(r=>r.file.endsWith('.png')).map(r=>r.file);
assert.deepEqual([...png].sort(),[...execution.directly_viewed].sort());assert.equal(new Set(png).size,30);
for(const f of png)assert.equal(bytes(f).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert(!manifest.copies.some(r=>/\.(blend|glb)$/.test(r.file)));
const sourceSha='602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9';
const artistSha='3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137';
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),sourceSha);
const reports={};
for(const [phase,file]of [['a179','head-cleanup-report'],['a180','union-fold-shading-trace'],
 ['a181','head-cleanup-report'],['a182','authored-head-isolation'],['a184','head-cleanup-report'],['a180-recheck','union-fold-shading-trace']]){
 const r=decoded(phase+'/'+file+'.json.txt.gz');reports[phase]=r;
 assert.equal(r.input_sha256,sourceSha);assert.equal(r.professional_sha256,artistSha);
 assert(r.all_current_coordinates_skin_faces_groups_163_rest_bones_world_exact);
 assert(!r.patch_source_saved&&!r.source_saved&&!r.glb_saved&&!r.service_avatar_saved&&!r.appearance_approved&&!r.full_deformation_qa);
}
for(const [phase,folds,tiny]of [['a179',[29,33],[8,7]],['a180',[29,33],[8,7]],
 ['a180-recheck',[29,33],[8,7]],['a181',[100,34],[0,0]],['a184',[255,320],[0,0]]]){
 assert.deepEqual(reports[phase].rows.map(r=>r.cleanup.local_long_folds),folds);
 assert.deepEqual(reports[phase].rows.map(r=>r.cleanup.tiny_faces),tiny);
 for(const row of reports[phase].rows){
  const c=row.cleanup;assert(!c.cleanup_geometry_passed&&!c.closed_geometry_passed);
  assert(c.all_professional_points_below_low_cut_exact&&!c.body_or_whole_neck_remesh&&!c.body_smoothing);
 }
}
for(const row of reports.a180.rows){
 const c=row.cleanup;
 assert(c.fold_trace.every(f=>f.near_high_cut_2mm));
 assert(c.shading_native.all_polygons_smooth&&!c.shading_native.has_custom_normals&&c.shading_native.sharp_edge_count===0);
}
for(const row of reports.a181.rows){
 const c=row.cleanup;assert(c.pre_local_degenerate_repair.tiny_faces>0&&c.micron_overlap_edges_targeted>0);
 assert.equal(c.local_degenerate_repair_distance_m,.000002);
 assert(c.native_smooth_shading_geometry_exact&&c.all_polygons_smooth&&!c.has_custom_normals);
 assert(c.samples_over_existing_6mm===0&&c.maximum_cleanup_to_precleanup_surface_m<.006);
}
assert.deepEqual(reports.a182.rows.map(r=>[r.body,r.mode]),[['Male','authored'],['Male','depth-only'],['Female','authored'],['Female','depth-only']]);
assert.equal(reports.a182.actual_png,12);
for(const row of reports.a182.rows)
 assert(row.vertices===67586&&row.head_only_render&&row.no_body_conformance_or_voxel_or_union&&
 row.all_target_coordinates_exact_after_shading_and_read_only_sections&&row.all_polygons_smooth&&!row.service_avatar&&!row.appearance_approved);
for(const row of reports.a184.rows){
 const c=row.cleanup;
 assert(c.all_pre_bridge_faces_exact&&c.all_pre_bridge_input_points_exact&&c.all_target_head_points_above_high_cut_exact);
 assert.equal(c.new_bridge_faces,c.new_bridge_faces_inheriting_original_marker);
 assert(c.samples_over_existing_6mm>0&&c.maximum_bridge_to_professional_or_target_surface_m>.026);
 assert(c.boundary_edges===0&&c.nonmanifold_edges===0&&c.winding_errors===0);
 assert(!c.head_conformance_or_voxel_or_boolean&&c.native_smooth_shading_geometry_exact);
}
const sort=a=>a.sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)));
const normalize=r=>{
 const n=structuredClone(r);
 for(const row of n.rows){
  for(const f of row.cleanup.fold_trace){delete f.edge;sort(f.edge_points_m);f.face_areas_m2.sort((x,y)=>x-y);}
  sort(row.cleanup.fold_trace);for(const f of row.cleanup.tiny_trace)delete f.face;sort(row.cleanup.tiny_trace);
 }
 return n;
};
assert.deepEqual(normalize(reports.a180),normalize(reports['a180-recheck']));
const comparison=decoded('a180-recheck-comparison.json.txt.gz');
assert(!comparison.byte_identical&&comparison.equal_after_excluding_runtime_edge_face_ids_and_sorting_unordered_trace_collections);
assert.equal(comparison.old_sha256,sha(zlib.gunzipSync(bytes('a180/union-fold-shading-trace.json.txt.gz'))));
assert.equal(comparison.new_sha256,sha(zlib.gunzipSync(bytes('a180-recheck/union-fold-shading-trace.json.txt.gz'))));
assert.equal(decoded('logs/a180-comparison-observed.json.txt.gz').exit_code,0);
for(const row of execution.historical_runs){
 const log=decoded(row.metadata);assert.equal(log.historical_terminal_metadata.exit_code,row.reported_exit_code);
 assert(!log.full_terminal_stdout_file_retained&&!log.original_exact_command_file_retained&&!log.stdout_reconstructed);
}
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[1,0,1,1,0]);
for(const row of execution.native_runs){
 const log=decoded(row.log);assert.equal(log.command,row.command);assert.equal(log.exit_code,row.exit_code);
 assert.equal(log.terminal_chunk_id,row.terminal_chunk_id);assert.equal(log.chunks.at(-1).exit_code,row.exit_code);
 assert.equal(log.chunks.at(-1).chunk_id,row.terminal_chunk_id);
 assert(log.chunks.every(c=>!c.output.includes('Warning: truncated')));
 assert.equal(row.current_full_snapshot_check_completed,row.phase!=='a183');
 if(row.phase==='a181')assert.equal(log.original_interruption.exit_code,null);
 if(row.phase==='a182'){
  assert.deepEqual(log.initial_static.map(r=>r.exit_code),[1,1,0]);
  assert(log.initial_static[0].output.includes('F401'));assert(log.static.every(r=>r.exit_code===0));
 }
 if(row.phase==='a183')assert(log.chunks.at(-1).output.includes('assert new_faces'));
}
assert.equal(decoded('logs/static-observed.json.txt.gz').checks.length,3);
assert(decoded('logs/static-observed.json.txt.gz').checks.every(r=>r.exit_code===0));
assert.equal(execution.evidence_copy.terminal.exit_code,0);
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped);
assert(Object.values(execution.new_assets).every(v=>v===0)&&Object.values(execution.new_verification).every(v=>v===0));
assert(Object.values(execution.limitations).every(v=>v===false));
assert.equal(execution.reference.sha256,'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
console.log(JSON.stringify({integrity_passed:true,copies:77,gzip:47,protected_old_files:770,actual_png:30,directly_viewed:30,
 historical_exits_metadata_only:[1,0],current_native_exits:[1,0,1,1,0],original_a181_exit_unknown:true,
 repeated_a180_geometry_equal_excluding_ids_order:true,new_assets:0,new_118:0,new_Chrome:0,appearance_passed:false}));
