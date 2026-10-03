// FR-A-02/08: repeat preserved evidence checks; not appearance or clinical approval.
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../../..');
const bytes=file=>fs.readFileSync(path.join(__dirname,file));
const json=file=>JSON.parse(bytes(file));
const decoded=file=>JSON.parse(zlib.gunzipSync(bytes(file)));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const manifest=json('copy-manifest.json'),execution=json('execution-record.json');
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'inherit'});
for(const row of manifest.previous_control_files)assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256);
for(const row of manifest.copies){
 const data=bytes(row.file);assert.equal(data.length,row.bytes);assert.equal(sha(data),row.sha256);
 assert.equal(sha(row.file.endsWith('.gz')?zlib.gunzipSync(data):data),row.decoded_sha256);
}
assert.equal(manifest.protected_old_file_count,563);assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,43);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,22);
const png=manifest.copies.filter(r=>r.file.endsWith('.png')).map(r=>r.file);
assert.equal(png.length,12);assert.deepEqual([...png].sort(),[...execution.directly_viewed].sort());
for(const file of png)assert.equal(bytes(file).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert(!manifest.copies.some(r=>/\.(blend|glb)$/.test(r.file)));
const inputSha='602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9';
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,execution.input_source))),inputSha);
assert.equal(execution.reference_sha256,'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
assert.equal(sha(bytes('a147-raw-profile.json')),sha(bytes('a147-clean-profile.json')));
for(const file of ['a147-raw-profile.json','a147-clean-profile.json','a148-native-section.json','a149-report.json','a150-report.json','a151-report.json','a152-report.json','a153-report.json','a154-report.json']){
 const report=json(file);assert.equal(report.input_sha256,inputSha);
 assert(!report.source_saved&&!report.appearance_approved&&!report.full_deformation_qa);
 assert.deepEqual(report.rows.map(r=>r.body),['Male','Female']);
}
const section=json('a148-native-section.json');
assert(section.read_only&&section.rows.every(r=>r.source_coordinates_skin_exact&&r.bands.length===32));
assert(Math.abs(section.rows[0].largest_posterior_deltas[0].delta_y_mm-8.63699932030104)<1e-10);
assert(Math.abs(section.rows[1].largest_posterior_deltas[0].delta_y_mm-12.676585254239255)<1e-10);
for(const file of ['a149-report.json','a150-report.json','a151-report.json']){
 const report=json(file);
 assert(report.rows.every(r=>r.geometry_guards_passed&&r.all_skin_topology_hands_163_rest_bones_world_exact&&r.all_x_z_coordinates_exact&&r.maximum_displacement_m<0.006));
 assert.deepEqual(report.rows.map(r=>r.after.local_long_folds),[1,0]);
 assert(report.rows.every(r=>r.after.posterior_head_base_p95_deg>r.before.posterior_head_base_p95_deg));
}
const a149=json('a149-report.json');assert(a149.rows.every(r=>r.after.posterior_head_base_max_deg>r.before.posterior_head_base_max_deg));
const a151=json('a151-report.json');
assert(a151.rows[0].after.posterior_head_base_max_deg<a151.rows[0].before.posterior_head_base_max_deg);
assert(a151.rows[1].after.posterior_head_base_max_deg>a151.rows[1].before.posterior_head_base_max_deg);
const a152=json('a152-report.json'),a153=json('a153-report.json'),a154=json('a154-report.json');
for(const report of [a152,a153]){
 assert(report.rows.every(r=>!r.geometry_guards_passed&&r.maximum_displacement_m>0.006&&r.all_skin_topology_hands_163_rest_bones_world_exact));
 assert.deepEqual(report.rows.map(r=>r.after.local_long_folds),[14,3]);
}
assert(a153.input_source_sha256_unchanged_after_native_edits);
assert.deepEqual(a153.rows.map(r=>r.new_fold_edges.length),[13,3]);
assert(a153.rows.every(r=>r.new_fold_edges.every(e=>e.normalized_z.every(z=>z<0.875))));
assert.deepEqual(a154.rows.map(r=>r.geometry_guards_passed),[true,false]);
assert.deepEqual(a154.rows.map(r=>r.after.local_long_folds),[1,0]);
assert(a154.rows.every(r=>r.all_skin_topology_hands_163_rest_bones_world_exact&&r.fairing_mask_normalized_z[0]===0.875));
assert(a154.rows[0].maximum_displacement_m<0.006&&a154.rows[1].maximum_displacement_m>0.006);
assert.equal(execution.native_runs.length,9);
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[0,0,0,0,0,0,1,1,1]);
for(const row of execution.native_runs){
 const log=decoded(row.log);assert.equal(log.exit_code,row.exit_code);assert.equal(log.command.cmd,row.command);
 assert.equal(log.chunks.at(-1).chunk_id,row.terminal_chunk_id);assert.equal(log.chunks.at(-1).exit_code,row.exit_code);
 assert(row.terminal_stdout_retained&&!log.stdout_reconstructed&&log.output_kind==='actual_tool_chunks');
}
const staticLog=decoded('logs/static-observed.json.txt.gz');
const raw=staticLog.checks.find(r=>r.file==='a147-posterior-profile.py');
assert.deepEqual(raw.checks.map(r=>r.result.exit_code),[1,1,1]);
assert(raw.checks.slice(0,2).every(r=>r.result.output.includes('RUF007')));
assert(staticLog.checks.filter(r=>r!==raw).every(r=>r.checks.length===3&&r.checks.every(c=>c.result.exit_code===0)));
for(const phase of ['a153','a154'])assert(staticLog[phase].actual_checks.length===3&&staticLog[phase].actual_checks.every(r=>r.result.exit_code===0));
assert.equal(staticLog.a153.initial_failure.code,'F401');assert(!staticLog.a153.initial_failure.native_started);
assert.equal(staticLog.a147_clean_report_byteexact_comparison.exit_code,0);
assert.equal(execution.evidence_copy.exit_code,0);assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped);
assert.equal(execution.new_verification.actual_png,12);assert.equal(execution.new_verification.directly_viewed,12);assert.equal(execution.new_verification.not_viewed,0);
for(const field of ['source_full_118','glb_full_118','actual_Chrome_tests','actual_webcam_trials'])assert.equal(execution.new_verification[field],0);
assert(Object.values(execution.new_assets).every(n=>n===0));
for(const field of ['appearance_approved','service_asset_adopted','pr9_merge','stage1_6_completed','expert_approval','actual_webcam_human_trial','operations_deployed','guard_relaxed','posthoc_coordinate_skin_restored','whole_body_remesh','anatomy_accuracy_proven'])assert.equal(execution.limits[field],false);
console.log(JSON.stringify({integrity_passed:true,copies:43,gzip:22,protected_old_files:563,native_exits:execution.native_runs.map(r=>r.exit_code),actual_png:12,directly_viewed:12,new_assets:0,new_118:0,new_Chrome:0,a154_fold_regression_resolved:true,a154_female_guard_failed:true,appearance_passed:false}));
