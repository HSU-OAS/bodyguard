// FR-A-02/08: immutable real evidence checks, NOT appearance/medical approval.
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../../..');
const bytes=file=>fs.readFileSync(path.join(__dirname,file));
const json=file=>JSON.parse(bytes(file)),decoded=file=>JSON.parse(zlib.gunzipSync(bytes(file)));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const manifest=json('copy-manifest.json'),execution=json('execution-record.json');
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'inherit'});
for(const row of [...manifest.previous_control_files,...manifest.protected_repository_inputs])
 assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256);
for(const row of manifest.copies){
 const data=bytes(row.file);assert.equal(data.length,row.bytes);assert.equal(sha(data),row.sha256);
 assert.equal(sha(row.file.endsWith('.gz')?zlib.gunzipSync(data):data),row.decoded_sha256);
}
assert.equal(manifest.protected_old_file_count,646);assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,25);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,12);
const png=manifest.copies.filter(r=>r.file.endsWith('.png')).map(r=>r.file);
assert.equal(png.length,8);assert.equal(new Set(execution.directly_viewed).size,8);
assert.deepEqual([...png].sort(),[...execution.directly_viewed].sort());
for(const file of png)assert.equal(bytes(file).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert(!manifest.copies.some(r=>/\.(blend|glb)$/.test(r.file)));
const inputSha='602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9';
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),inputSha);
assert.equal(execution.reference_sha256,'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
const [a159,a160,a161,a162]=[159,160,161,162].map(id=>json('a'+id+'-report.json'));
for(const report of [a159,a160,a161,a162]){
 assert.equal(report.input_sha256,inputSha);
 assert.equal(report.professional_sha256,'3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137');
 assert(!report.source_saved&&!report.appearance_approved&&!report.full_deformation_qa);
 assert.deepEqual(report.rows.map(r=>r.body),['Male','Female']);
}
assert(a159.read_only && a159.rows.every(r=>r.native_bridge_supported&&!r.native_bridge_performed&&r.current_coordinates_skin_163_rest_bones_exact));
assert.deepEqual(a159.rows.map(r=>r.current.actual_native_loop_counts),[[341],[355]]);
assert.deepEqual(a159.rows.map(r=>r.professional.actual_native_loop_counts),[[98],[100]]);
for(const report of [a160,a161,a162]){
 assert(report.rows.every(r=>!r.geometry_guards_passed&&!r.all_original_body_coordinates_skin_exact));
 assert(report.rows.every(r=>r.retained_coordinate_skin_hands_163_rest_bones_world_outside_faces_exact&&r.retained_maximum_displacement_m===0));
 assert.deepEqual(report.rows.map(r=>r.removed_old_interior_points),[4910,4168]);
 assert.deepEqual(report.rows.map(r=>r.retained_old_points),[124720,124221]);
 assert.deepEqual(report.rows.map(r=>r.professional_authored_points_exact),[460,431]);
 assert.deepEqual(report.rows.map(r=>r.new_bridge_points),[2046,2130]);
 assert(report.rows.every(r=>r.after.global_nonmanifold===0&&r.after.global_winding_errors===0&&r.after.local_tiny_faces===0&&r.bridge_to_professional_surface_sample_max_m>0.006));
}
assert.deepEqual(a160.rows.map(r=>r.after.local_long_folds),[804,785]);
assert.deepEqual(a161.rows.map(r=>r.after.local_long_folds),[804,785]);
assert.deepEqual(a162.rows.map(r=>r.after.local_long_folds),[554,407]);
assert(a160.rows.every(r=>r.native_bridge.interpolation==='SURFACE')&&a162.rows.every(r=>r.native_bridge.interpolation==='LINEAR'));
assert.equal(a161.rows[0].correspondence.actual_to_minimum_cost_ratio,1);
assert(a161.rows[1].correspondence.actual_to_minimum_cost_ratio>1&&a161.rows[1].correspondence.actual_to_minimum_cost_ratio<1.02);
for(const row of a161.rows){
 const c=row.correspondence,n=row.native_matched_boundary_edges;
 assert.equal(c.actual_strip_paths.length,n);assert(c.actual_strip_paths.every(p=>p.length===8));
 assert.equal(new Set(c.actual_mapping).size,n);
 assert.deepEqual(Object.values(c.native_strip_distance_layer_counts),Array(8).fill(n));
}
const metrics=json('a161-strip-metrics.json');
assert.equal(metrics.input_sha256,sha(bytes('a161-report.json')));
assert(metrics.read_only&&!metrics.source_saved&&metrics.native_runs===0&&metrics.new_renders===0);
assert.deepEqual(metrics.rows.map(r=>r.projected_donor_endpoints_outside_source_ring),[56,66]);
assert.deepEqual(metrics.rows.map(r=>r.projected_endpoint_connector_strict_crossings),[1017,510]);
assert.deepEqual(metrics.rows.map(r=>r.paths_with_negative_endpoint_direction_segment),[57,42]);
assert(metrics.rows.every(r=>r.projected_source_ring_strict_self_intersections===0&&r.projected_donor_ring_strict_self_intersections===0));
assert.equal(execution.native_runs.length,4);
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[0,1,0,1]);
for(const row of execution.native_runs){
 const log=decoded(row.log);assert.equal(log.exit_code,row.exit_code);assert.equal(log.command.cmd,row.command);
 assert.equal(log.chunks.at(-1).chunk_id,row.terminal_chunk_id);assert.equal(log.chunks.at(-1).exit_code,row.exit_code);
 assert(row.terminal_stdout_retained&&!log.stdout_reconstructed&&log.output_kind==='actual_tool_chunks');
 assert(log.chunks.every(c=>!c.output.includes('Warning: truncated')));
}
const staticLog=decoded('logs/static-observed.json.txt.gz');
assert.equal(staticLog.checks.length,5);
assert(staticLog.checks.every(r=>r.checks.length===3&&r.checks.every(c=>c.result.exit_code===0)));
assert.equal(staticLog.historical_pre_native_a160_initial[0].result.exit_code,1);
assert.equal(staticLog.historical_pre_native_a160_selector_unused_import[0].exit_code,1);
assert(staticLog.pre_native_corrected_a160.every(r=>r.exit_code===0));
assert.equal(staticLog.new_metrics_run.exit_code,0);assert.equal(staticLog.metrics_native_runs,0);
assert.equal(execution.evidence_copy.exit_code,0);
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped);
assert.equal(execution.new_verification.actual_png,8);assert.equal(execution.new_verification.directly_viewed,8);assert.equal(execution.new_verification.not_viewed,0);
for(const field of ['source_full_118','glb_full_118','actual_Chrome_tests','actual_webcam_trials'])assert.equal(execution.new_verification[field],0);
assert(Object.values(execution.new_assets).every(v=>v===0));assert(Object.values(execution.limits).every(v=>v===false));
console.log(JSON.stringify({integrity_passed:true,copies:25,gzip:12,protected_old_files:646,
 native_exits:execution.native_runs.map(r=>r.exit_code),actual_png:8,directly_viewed:8,new_assets:0,new_118:0,new_Chrome:0,
 count_only_native_bridge_rejected:true,correspondence_projection_not_anatomy:true,appearance_passed:false}));
