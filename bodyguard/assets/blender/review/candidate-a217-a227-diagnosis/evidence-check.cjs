// Actual evidence integrity only; rejected assets stay rejected.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const read=f=>fs.readFileSync(path.join(__dirname,f)),json=f=>JSON.parse(read(f)),gz=f=>JSON.parse(zlib.gunzipSync(read(f))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=json('copy-manifest.json'),record=json('execution-record.json'),root=path.resolve(__dirname,'../../../../..');
assert.deepEqual(manifest.counts,{copies:74,gzip:42,PNG:30,blend:2,GLB:0});
assert.equal(manifest.copies.length,74);assert.equal(new Set(manifest.copies.map(r=>r.file)).size,74);
for(const row of manifest.copies){
 const b=read(row.file),raw=row.file.endsWith('.gz')?zlib.gunzipSync(b):b;
 assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256,row.file);assert.equal(sha(raw),row.decoded_sha256);
 if(row.file.endsWith('.png'))assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
}
assert.equal(manifest.protected_prior.length,331);
for(const row of manifest.protected_prior)assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256,row.file);
const surface=gz('diagnosis/head-surface.json.txt.gz');assert(surface.source_file_unchanged&&surface.rows.length===2&&surface.saved_assets===0&&surface.camera_calls===0);
for(const r of surface.rows){assert.equal(r.custom_normals,false);assert.equal(r.sharp_edge_flags,0);assert.equal(r.global_flat_faces,0);assert(r.body_geometry_numeric_skin_groups_materials_world_unchanged&&r.all_163_rest_bones_pose_world_unchanged);}
const fair=gz('a218/fairing-report.json.txt.gz'),fairSaved=gz('diagnosis/a218-saved-native.json.txt.gz');
assert(fair.saved_candidate&&fairSaved.passed&&fairSaved.independent_saved_native_reopen);
assert.equal(sha(read('a218/artist-candidate.blend')),fair.candidate_sha256);
for(const r of fair.rows)assert(r.all_numeric_skin_faces_group_order_hands_163_rest_bones_world_materials_exact&&r.maximum_artist_displacement_m<.006);
const old=gz('a220/male-guard-diagnosis.json.txt.gz');assert.equal(old.numeric_skin_changed,288);assert.equal(old.all_failures.length,288);assert.equal(old.coordinates_changed,0);assert.equal(old.removed,0);
for(const r of old.all_failures){
 assert(!r.removed&&!r.coordinates_changed&&r.coordinate_delta_m===0);
 for(const g of new Set([...Object.keys(r.source_skin),...Object.keys(r.current_skin)]))assert.equal(r.source_skin[g]??0,r.current_skin[g]??0);
}
for(const [folder,counts]of [['a221',[3,1]],['a222',[91,263]],['a223',[3,1]]]){
 const r=gz(folder+'/bevel-report.json.txt.gz');assert.equal(r.saved_candidate,false);assert.deepEqual(r.rows.map(r=>r.after.tiny_faces),counts);
 for(const row of r.rows)assert.equal(row.existing_6mm_and_geometry_guards_passed,false);
 if(folder==='a223')for(const row of r.rows)assert.deepEqual(row.generated_only_tiny_face_native_dissolves,[]);
}
const lineage=gz('diagnosis/a224-tiny-face-lineage.json.txt.gz');assert(lineage.diagnostic_passed&&lineage.candidate_saved===false&&lineage.renders===0);
for(const row of lineage.rows){assert(row.retained_numeric_coefficients_exact&&row.rest_rig_163_exact&&row.protected_original_coordinates_exact);assert.equal(row.new_tiny_regression_faces.length,1);const f=row.new_tiny_regression_faces[0];assert.equal(f.original_face_ordinal,null);assert.equal(f.in_native_bevel_faces,false);}
const bevel=gz('a225/bevel-report.json.txt.gz');assert(bevel.saved_candidate);assert.equal(sha(read('a225/artist-candidate.blend')),bevel.candidate_sha256);assert.deepEqual(bevel.rows.map(r=>r.after.tiny_faces),[2,0]);
for(const row of bevel.rows){assert(row.existing_6mm_and_geometry_guards_passed&&row.retained_original_numeric_skin_exact);assert.equal(row.skin_bad,0);assert.equal(row.generated_only_short_edge_native_welds.length,1);assert.equal(row.old_anatomical_source_points_weld_deleted,0);}
const weights=gz('diagnosis/a226-weight-diagnosis.json.txt.gz');assert.equal(weights.coefficient_guard_passed,false);
assert.deepEqual(weights.rows.map(r=>r.invalid_individual_count),[0,0,1,1]);assert(weights.rows.every(r=>r.sum_only_bad===0));
const saved=gz('diagnosis/a227-independent-saved.json.txt.gz');assert.equal(saved.passed,false);assert(saved.independent_saved_native_reopen);assert.deepEqual(saved.rows.map(r=>r.retained_original_points_exact),[131529,130354]);
for(const row of saved.rows){assert(row.all_retained_numeric_skin_exact&&row.groups_163_rest_bones_world_finish_exact);assert.equal(row.invalid_individual_weights.length,1);assert(row.invalid_individual_weights[0].weight<0&&row.invalid_individual_weights[0].original_parent_id===0);assert.equal(row.individual_weight_guard_passed,false);}
const expected=[0,0,1,1,0,1,1,1,0,0,1,1,1];
assert.equal(record.native_runs.length,13);assert(record.native_actors_sequential);
for(const [i,run]of record.native_runs.entries()){assert.equal(run.chunks.at(-1).exit_code,expected[i]);assert(run.command);assert(!run.chunks.some(c=>/Warning: truncated output/.test(c.output)));assert.deepEqual(gz(run.stdout_archive).chunks,run.chunks);}
assert.equal(record.initialization_failure.result.exit_code,139);assert.equal(record.initialization_failure.script_executed,false);
assert.equal(record.directly_viewed.length,18);assert.equal(new Set(record.directly_viewed).size,18);
for(const file of record.directly_viewed)assert(manifest.copies.some(r=>r.file===file&&file.endsWith('.png')));
assert.equal(record.static_verification.exit_code,0);assert.match(record.static_verification.output,/Ran 11 tests/);
assert.equal(record.actual_renders,30);assert.equal(record.browser_runs.length,0);assert.equal(record.GLB_files,0);assert.equal(record.full_118_deformation_runs,0);
assert.equal(record.appearance_approved,false);assert.equal(record.service_adopted,false);assert.equal(record.pr_merge_allowed,false);assert.equal(record.stages_1_to_6_completed,false);assert.equal(record.current_development_asset,'A37');assert.equal(record.camera_calls,0);
const helperHash=sha(zlib.gunzipSync(read('executed-helpers/skin_coefficients.py.txt.gz')));
assert.equal(bevel.rows[0].numeric_skin_helper_sha256,helperHash);assert.equal(lineage.rows[0].numeric_helper_sha256,helperHash);
assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender/skin_coefficients.py'))),helperHash);
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bghp_[A-Za-z0-9]{36}\b/,/\bgithub_pat_[A-Za-z0-9_]{60,}\b/];
for(const row of manifest.copies.filter(r=>r.file.endsWith('.gz')))assert(forbidden.every(p=>!p.test(zlib.gunzipSync(read(row.file)).toString('utf8'))),row.file);
let links=0;
for(const m of read('README.md').toString('utf8').matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
 if(/^(https?:|codex:|mailto:|#)/.test(m[1]))continue;
 const target=m[1].split('#')[0].replace(/^<|>$/g,'');assert(fs.existsSync(path.resolve(__dirname,decodeURIComponent(target))),target);links++;
}
console.log(JSON.stringify({integrity_passed:true,...manifest.counts,protected_prior:331,native_python_runs:13,native_failures:8,separate_Metal_init_failure:139,directly_viewed:18,local_links_checked:links,limited_credential_scan_gzip:42,not_full_security_audit:true,full_118_GLB_Chrome:'not executed',appearance_approved:false,service_adopted:false}));
