// FR-A-02/08: immutable diagnosis evidence, NOT appearance/clinical approval.
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
assert.equal(manifest.protected_old_file_count,675);assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,23);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,13);
const png=manifest.copies.filter(r=>r.file.endsWith('.png')).map(r=>r.file);
assert.deepEqual([...png].sort(),[...execution.directly_viewed].sort());assert.equal(new Set(png).size,4);
for(const f of png)assert.equal(bytes(f).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert(!manifest.copies.some(r=>/\.(blend|glb)$/.test(r.file)));
const reports=[163,164,165,166].map(id=>json('a'+id+'-report.json'));
for(const r of reports){
 assert.equal(r.input_sha256,'602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9');
 assert.equal(r.professional_sha256,'3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137');
 assert(!r.source_saved&&!r.appearance_approved&&!r.full_deformation_qa);
 assert.deepEqual(r.rows.map(row=>row.body),['Male','Female']);
}
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),reports[0].input_sha256);
for(const r of reports.slice(0,3))assert(r.read_only&&r.rows.every(row=>!row.native_bridge_performed&&row.all_current_coordinates_skin_163_rest_bones_world_exact&&row.minimum_boundary_xz_clearance_m>=.008));
assert.deepEqual(reports.slice(0,3).map(r=>r.rows.map(row=>row.single_connected_disk)),[[true,false],[true,true],[true,false]]);
assert.deepEqual(reports[2].rows[1].source_hole.selected_components_faces,[13835,21,3]);
assert.deepEqual(reports[2].rows[1].nested_professional_patch.selected_components_faces,[211,42]);
for(const [id,crossings] of [[164,[22,8]],[165,[5,6]]]){
 const p=json('a'+id+'-projection-check.json');assert.equal(p.input_sha256,sha(bytes('a'+id+'-report.json')));
 assert(p.read_only&&p.native_runs===0&&p.new_renders===0&&p.rows.every(row=>!row.projected_nesting_passed));
 assert.deepEqual(p.rows.map(row=>row.source_self_crossings),crossings);
 assert(p.rows.every(row=>row.donor_self_crossings===0&&row.mutual_strict_edge_crossings===0&&row.donor_vertices_outside_source===0));
}
const r=reports[3];
assert.deepEqual(r.rows.map(row=>row.native_boundary_edges),[[649,114],[634,108]]);
assert.deepEqual(r.rows.map(row=>row.retained_old_points),[117040,114293]);
assert.deepEqual(r.rows.map(row=>row.removed_old_interior_points),[12590,14096]);
assert.deepEqual(r.rows.map(row=>row.professional_authored_points_exact),[402,394]);
assert.deepEqual(r.rows.map(row=>row.after.local_long_folds),[91,58]);
assert.deepEqual(r.rows.map(row=>row.actual_face_center_edge_midpoint_samples),[1526,1484]);
assert(r.rows.every(row=>!row.geometry_guards_passed&&!row.all_original_body_coordinates_skin_exact&&row.xz_projection_failure_not_cleared&&row.new_bridge_points===0&&row.retained_coordinate_skin_hands_163_rest_bones_world_outside_faces_exact&&row.retained_maximum_displacement_m===0&&row.bridge_to_professional_surface_sample_max_m>.006&&row.after.global_nonmanifold===0&&row.after.global_winding_errors===0&&row.after.local_tiny_faces===0));
assert.deepEqual(execution.native_runs.map(row=>row.exit_code),[0,0,0,1]);
for(const row of execution.native_runs){
 const log=decoded(row.log);assert.equal(log.exit_code,row.exit_code);assert.equal(log.command.cmd,row.command);
 assert.equal(log.chunks.at(-1).chunk_id,row.terminal_chunk_id);assert.equal(log.chunks.at(-1).exit_code,row.exit_code);
 assert(row.terminal_stdout_retained&&!log.stdout_reconstructed&&log.output_kind==='actual_tool_chunks');
 assert(log.chunks.every(c=>!c.output.includes('Warning: truncated')));
}
const staticLog=decoded('logs/static-observed.json.txt.gz');assert.equal(staticLog.checks.length,4);
assert(staticLog.checks.every(row=>row.checks.length===3&&row.checks.every(c=>c.exit_code===0)));
assert.equal(staticLog.historical_pre_native_a163_initial[0].exit_code,1);
assert.equal(staticLog.projection_a164.exit_code,1);assert.equal(staticLog.projection_a165.exit_code,1);
assert.equal(execution.evidence_copy.exit_code,0);
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped&&!execution.diagnosis_gate_results.previous_xz_failure_cleared);
for(const field of ['source_full_118','glb_full_118','actual_Chrome_tests','actual_webcam_trials'])assert.equal(execution.new_verification[field],0);
assert(Object.values(execution.new_assets).every(v=>v===0));
assert(Object.values(execution.limitations).every(v=>v===false));
console.log(JSON.stringify({integrity_passed:true,copies:23,gzip:13,protected_old_files:675,native_exits:[0,0,0,1],actual_png:4,directly_viewed:4,new_assets:0,new_118:0,new_Chrome:0,projection_gate_failed:true,unequal_native_bridge_failed:true,appearance_passed:false}));
