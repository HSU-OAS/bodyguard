// FR-A-02/03/08: immutable native evidence, not an appearance/deformation approval.
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
assert.equal(manifest.protected_old_file_count,729);assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,37);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,25);
const png=manifest.copies.filter(r=>r.file.endsWith('.png')).map(r=>r.file);
assert.deepEqual([...png].sort(),[...execution.directly_viewed].sort());assert.equal(new Set(png).size,12);
for(const f of png)assert.equal(bytes(f).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert(!manifest.copies.some(r=>/\.(blend|glb)$/.test(r.file)));
assert(!manifest.copies.some(r=>/^a175-report|a176-female|a177-female/.test(r.file)));
const r173=decoded('a173-report.json.txt.gz'),r174=decoded('a174-report.json.txt.gz'),r178=decoded('a178-report.json.txt.gz');
for(const r of [r173,r174,r178]){
 assert.equal(r.input_sha256,'602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9');
 assert.equal(r.professional_sha256,'3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137');
 assert(!r.source_saved&&!r.appearance_approved&&!r.full_deformation_qa);
}
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),r173.input_sha256);
for(const r of [r173,r174]){
 assert(r.read_only);assert.deepEqual(r.rows.map(row=>row.body),['Male','Female']);
 assert(r.rows.every(row=>row.all_current_coordinates_skin_faces_groups_163_rest_bones_world_exact&&!row.native_bridge_performed&&!row.anatomical_registration_verified));
}
assert.deepEqual(r173.rows.map(row=>row.current_boundary_to_full_artist_surface.over_existing_6mm_count),[106,123]);
assert(r173.rows.every(row=>row.professional_vertex_count===42342&&row.uniform_height_ratio_only));
assert.deepEqual(r174.rows.map(row=>row.source.boundary_edges),[969,1087]);
assert.deepEqual(r174.rows.map(row=>row.professional.boundary_edges),[156,166]);
for(const row of r174.rows)for(const r of [row.source,row.professional]){
 assert(r.single_connected_disk&&r.euler===1&&r.closed_ring_count===1);
 assert(r.long_folds===0&&r.wire_edges===0&&r.nonmanifold_interior_edges===0&&r.winding_errors===0);
 assert(r.boundary_to_other_full_surface_max_m>.006&&r.boundary_to_other_full_surface_over_6mm>0);
}
const projected=decoded('a174-projection-initial.json.txt.gz'),reprojected=decoded('a174-projection-recheck.json.txt.gz');
assert.deepEqual(projected,reprojected);assert.equal(projected.input_sha256,sha(zlib.gunzipSync(bytes('a174-report.json.txt.gz'))));
assert.deepEqual(projected.rows.map(r=>r.source_self_crossings),[0,0]);assert.deepEqual(projected.rows.map(r=>r.donor_self_crossings),[0,0]);
assert.deepEqual(projected.rows.map(r=>r.mutual_strict_edge_crossings),[4,4]);assert.deepEqual(projected.rows.map(r=>r.donor_vertices_outside_source),[10,12]);
assert(projected.rows.every(r=>!r.projected_nesting_passed));
const projectionLog=decoded('logs/a174-projection-observed.json.txt.gz');
assert.equal(projectionLog.initial.exit_code,1);assert.equal(projectionLog.recheck.exit_code,1);
assert(projectionLog.recheck.output.includes('Actual projected contours are not nested simple polygons'));
const a176=decoded('a176-alignment-male.json.txt.gz'),a177=decoded('a177-alignment-male.json.txt.gz');
assert(a176.aligned_head_min_ratio<0&&a176.existing_height_guard_unchanged&&!a176.source_saved);
assert(a177.independent_parent_matrix_calculation_matches_native&&a177.existing_height_guard_unchanged&&!a177.source_saved);
assert(a177.aligned_head_min_ratio>.84&&a177.aligned_head_min_ratio<.93&&a177.native_parent_chain.length===4);
assert(r178.read_only_current_avatar&&r178.all_current_coordinates_skin_faces_groups_163_rest_bones_world_exact);
assert.deepEqual(r178.rows.map(r=>[r.body,r.mode]),[['Male','original-mask'],['Male','head-only-mask'],['Female','original-mask'],['Female','head-only-mask']]);
for(const row of r178.rows){
 assert(row.professional_vertices===42342&&row.head_target_evaluated_vertices===67586&&row.below_mask_coordinates_exact);
 assert(!row.full_rig_skin_deformation_qa&&!row.appearance_approved);
 assert(row.asset_alignment.independent_parent_matrix_calculation_matches_native&&row.asset_alignment.actual_aligned_coordinates_match_authored_matrix&&row.asset_alignment.existing_height_guard_unchanged);
 const alignment=decoded('a178-alignment-'+row.body.toLowerCase()+'.json.txt.gz');
 assert.deepEqual(row.asset_alignment,alignment);
 const lower=row.lower_neck_082_head_min;
 if(row.mode==='head-only-mask')assert(lower.unchanged_exact&&lower.maximum_displacement_m===0&&lower.changed_points_over_1um===0&&row.mask_start_ratio===row.head_min_ratio);
 else assert(!lower.unchanged_exact&&lower.maximum_displacement_m>.04&&row.mask_start_ratio<row.head_min_ratio);
}
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[0,0,1,1,1,0]);
for(const row of execution.native_runs){
 const log=decoded(row.log);assert.equal(log.command.cmd,row.command);assert.equal(log.exit_code,row.exit_code);
 assert.equal(log.terminal_chunk_id,row.terminal_chunk_id);assert(!log.stdout_reconstructed);
 if(row.phase==='a177'){
  assert(!row.terminal_stdout_retained&&!log.terminal_stdout_retained);
  assert.equal(log.terminal_metadata.exit_code,1);assert.equal(log.output_kind,'actual_tool_chunks_with_terminal_metadata_and_quoted_exception');
  assert(log.quoted_actual_exception.includes('UnicodeDecodeError')&&log.quoted_actual_exception.includes('candidate.vertex_groups.remove(mask)'));
 }else{
  assert(row.terminal_stdout_retained&&log.terminal_stdout_retained);
  assert.equal(log.chunks.at(-1).chunk_id,row.terminal_chunk_id);assert.equal(log.chunks.at(-1).exit_code,row.exit_code);
  assert.equal(log.output_kind,'actual_tool_chunks');
 }
 assert(log.chunks.every(c=>!c.output.includes('Warning: truncated')));
 assert.equal(row.current_full_snapshot_check_completed,['a173','a174','a178'].includes(row.phase));
}
const staticLog=decoded('logs/static-observed.json.txt.gz');assert.equal(staticLog.checks.length,6);
assert(staticLog.checks.every(row=>row.checks.length===3&&row.checks.every(c=>c.exit_code===0)));
assert.equal(execution.evidence_copy.exit_code,0);
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped);
assert(Object.values(execution.new_assets).every(v=>v===0)&&Object.values(execution.new_verification).every(v=>v===0));
assert(Object.values(execution.limitations).every(v=>v===false));
console.log(JSON.stringify({integrity_passed:true,copies:37,gzip:25,protected_old_files:729,native_exits:[0,0,1,1,1,0],
 actual_png:12,directly_viewed:12,a177_terminal_full_stdout_retained:false,a174_projected_nesting_passed:false,
 a178_lower_neck_preserved_exact:true,new_assets:0,new_118:0,new_Chrome:0,appearance_passed:false}));
