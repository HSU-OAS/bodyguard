// FR-A-02/08: repeat actual evidence integrity/technical checks, not appearance approval.
const assert=require('node:assert/strict'),fs=require('node:fs');
const path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../../..');
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,file)));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest=read('copy-manifest.json'),execution=read('execution-record.json');
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'inherit'});
for(const row of manifest.previous_control_files)assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256);
for(const row of manifest.copies) {
 const bytes=fs.readFileSync(path.join(__dirname,row.file));
 assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
 assert.equal(sha(row.file.endsWith('.gz')?zlib.gunzipSync(bytes):bytes),row.decoded_sha256);
}
assert.equal(manifest.old_files_changed,0);assert.equal(manifest.protected_old_file_count,422);
assert.equal(manifest.copies.length,137);assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,33);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.png')).length,84);
assert.equal(execution.native_runs.length,15);
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[0,0,1,0,1,1,0,1,1,0,0,0,0,0,0]);
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped);
assert.equal(execution.native_runs[0].terminal_stdout_retained,false);
const seam=read('diagnosis/a136-seam.json');
assert(seam.read_only&&!seam.source_saved&&!seam.appearance_approved);
assert.deepEqual(seam.rows.map(r=>r.seam_edges),[374,363]);
assert(seam.rows.every(r=>r.head_base_bands.slice(1).every(b=>b.all_neighbor_faces_original&&b.all_edge_points_original_exact)));
assert.deepEqual(read('diagnosis/a138-rejected.json').rows.map(r=>r.geometry_guards_passed),[true,false]);
assert(read('diagnosis/a138-rejected.json').rows[1].maximum_displacement_m>0.006);
const intermediate=read('diagnosis/a139-intermediate.json');
assert(intermediate.rows.every(r=>r.geometry_guards_passed&&r.after.posterior_head_base_max_deg>r.before.posterior_head_base_max_deg));
const rejected=read('diagnosis/a142-rejected.json');
assert.deepEqual(rejected.rows.map(r=>r.after.tiny_faces),[18,30]);
assert(rejected.rows.every(r=>!r.geometry_guards_passed&&r.after.global_nonmanifold===0));
for(const filename of ['diagnosis/a145-selective.json','density-report.json']) {
 const cap=read(filename);
 assert(!cap.source_saved&&!cap.appearance_approved);
 assert(cap.rows.every(r=>r.geometry_guards_passed&&r.all_hands_163_rest_bones_world_exact));
 assert.deepEqual(cap.rows.map(r=>r.new_native_points),[6117,6120]);
 assert.deepEqual(cap.rows.map(r=>r.after.long_folds),[1,0]);
 assert(cap.rows.every(r=>r.native_stages.every(s=>s.stats.tiny_faces===0&&s.stats.global_nonmanifold===0&&s.stats.global_winding_errors===0)));
}
const record=read('candidate-record.json'),saved=read('saved-preservation.json');
assert(record.separate_candidate_saved&&!record.input_source_saved&&!record.appearance_approved);
assert.equal(sha(fs.readFileSync(path.join(__dirname,'artist-candidate.blend'))),record.candidate_sha256);
assert(saved.passed&&!saved.appearance_approved);
assert.deepEqual(saved.rows.map(r=>r.coordinate_named_skin_exact),[123513,122269]);
assert.deepEqual(saved.rows.map(r=>r.new_cap_only_points),[6117,6120]);
assert.deepEqual(saved.rows.map(r=>r.outside_face_winding_exact),[163732,161970]);
assert.deepEqual(saved.rows.map(r=>r.hands_selection_exact),[50689,50673]);
assert(saved.rows.every(r=>r.groups_163_rest_bones_world_material_ledger_exact&&r.only_cap_refinement_changed));
for(const name of ['source','roundtrip']) {
 const r=read(`${name}-deformation-report.json`),stress=r.checks.filter(x=>x.edge_ratio_max!==undefined);
 assert(r.passed&&r.rendered&&!r.failures.length);assert.equal(r.checks.length,121);assert.equal(stress.length,118);
 assert(stress.every(x=>Number.isFinite(x.edge_ratio_max)&&x.edge_ratio_max<3));
 assert.equal(manifest.copies.filter(r=>r.file.startsWith(`${name}/`)&&r.file.endsWith('.png')).length,34);
}
const exported=read('export-report.json');
assert.equal(exported.ratio,1);assert.equal(exported.maximum_skin_influences,8);
assert(exported.transforms_passed&&exported.checks.every(r=>r.meshes===5&&!r.animations&&!r.images));
const browser=read('browser-report.json');
assert.equal(browser.stats.expected,4);assert.equal(browser.stats.unexpected+browser.stats.flaky+browser.stats.skipped,0);
const walk=s=>(s.specs||[]).flatMap(x=>x.tests.flatMap(t=>t.results.flatMap(r=>r.attachments||[]))).concat(...(s.suites||[]).map(walk));
const attachments=walk(browser).filter(a=>a.contentType==='application/json').map(a=>({name:a.name,data:JSON.parse(Buffer.from(a.body,'base64').toString())}));
for(const gender of ['male','female']) {
 const bytes=fs.readFileSync(path.join(__dirname,`bodyguard-${gender}-candidate.glb`));
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
 const actual=attachments.filter(a=>a.name===`${gender}-native-asset`);
 assert.equal(actual.length,4);
 assert(actual.every(a=>a.data.bytes===bytes.length&&a.data.sha256===sha(bytes)&&a.data.eightWeightPrimitives===1));
}
for(const row of attachments.filter(a=>a.name.endsWith('camera-only-frame')))assert.equal(row.data.filter(m=>m.visible).length,10);
assert.equal(execution.browser_conditions.camera_calls,0);
assert.equal(execution.directly_viewed.total,42);assert.equal(execution.directly_viewed.not_viewed,42);
assert(execution.static_verification.tracked_spec_byteexact_restored&&execution.static_verification.own_temporary_client_removed);
for(const field of ['appearance_approved','service_asset_adopted','pr9_merge','stage1_6_completed','expert_approval','actual_webcam_human_trial','operations_deployed','guard_relaxed','posthoc_coordinate_skin_restored'])assert.equal(execution.limits[field],false);
console.log(JSON.stringify({integrity_passed:true,copies:137,gzip:33,protected_old_files:422,native_exits:execution.native_runs.map(r=>r.exit_code),actual_png:84,directly_viewed:42,source_and_roundtrip_technical_pass:true,actual_Chrome:4,appearance_passed:false}));
