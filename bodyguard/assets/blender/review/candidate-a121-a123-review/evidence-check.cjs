// FR-A-02/08: repeatable evidence integrity; native QA is not appearance/clinical approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,f)));
const manifest=read('copy-manifest.json'),record=read('execution-record.json');
assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.protected_old_file_count,164);
assert.equal(manifest.prior_control_files.length,4);assert.equal(manifest.protected_additional_files.length,9);
for(const r of [...manifest.prior_control_files,...manifest.protected_additional_files])
 assert.equal(sha(fs.readFileSync(path.join(root,r.file))),r.sha256);
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'inherit'});
assert.equal(manifest.copies.length,110);
assert.equal(new Set(manifest.copies.map(r=>r.file)).size,110);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,17);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.png')).length,74);
for(const r of manifest.copies) {
 const b=fs.readFileSync(path.join(__dirname,r.file));
 assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);
 assert.equal(sha(r.file.endsWith('.gz')?zlib.gunzipSync(b):b),r.decoded_sha256);
 if(r.file.endsWith('.png')) {
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert(b.readUInt32BE(16)>1&&b.readUInt32BE(20)>1);
 }
}
const raw=read('raw/raw-grid-localization.json');
assert.deepEqual(raw.rows.map(r=>r.raw_quad_stage.long_folds),[197,106]);
assert.deepEqual(raw.rows.map(r=>r.raw_native_triangle_stage.long_folds),[201,108]);
assert.deepEqual(raw.rows.map(r=>r.minority_minimum_boundary_graph_hops['3+']),[282,203]);
for(const r of raw.rows) {
 assert.equal(r.projection_conformance_applied,false);assert.equal(r.geometry_or_appearance_approved,false);
 assert.equal(r['3d_collision_anatomy_or_clinical_proven'],false);
 assert.equal(Object.values(r.minority_minimum_boundary_graph_hops).reduce((a,b)=>a+b,0),r.minority_projected_triangles);
 for(const k of ['all_retained_coordinates_skin_exact','protected_hands_rest_world_exact','outside_original_face_winding_exact','native_triangulation_coordinates_skin_exact']) assert.equal(r[k],true);
}
for(const folder of ['cap','saved-cap']) {
 const report=read(folder+'/grid-trial.json');
 assert.equal(report.source_sha256,record.input_source.sha256);
 assert.deepEqual(report.rows.map(r=>r.before_after[0].long_folds),[8,16]);
 assert.deepEqual(report.rows.map(r=>r.before_after[1].long_folds),[1,0]);
 assert.deepEqual(report.rows.map(r=>r.native_generated_vertices),[1113,1080]);
 for(const r of report.rows) {
  for(const k of ['raw_triangulation_coordinates_skin_exact','conformance_all_skin_topology_winding_exact','trial_geometry_guards_passed','all_retained_coordinates_skin_exact','protected_hands_rest_matrices_exact','unmodified_face_winding_exact','triangulation_coordinates_skin_exact','modifier_move_up_apply_finished','only_original_rig_modifier_remaining']) assert.equal(r[k],true);
  assert.equal(r.boundary_subdivision,false);assert.equal(r.whole_topology_unchanged,false);
  assert.equal(r.new_skin_normalization_errors,0);
  assert.equal(r.verified_active_body,'BODYGUARD '+r.body+' sculpt WIP');
  assert(Math.max(r.old_to_new_sample_envelope_m,r.new_to_old_sample_envelope_m)<0.006);
  assert.equal(r.before_after[1].tiny_faces,0);assert.equal(r.before_after[1].global_nonmanifold,0);
  assert.equal(r.before_after[1].global_inconsistent_winding,0);
  assert.equal(r.full_qa_or_appearance_approved,false);
 }
 if(folder==='cap') assert.equal(report.source_saved,false);
 else {
  assert.equal(report.input_source_saved,false);assert.equal(report.candidate_saved,true);
  assert.equal(report.candidate_sha256,sha(fs.readFileSync(path.join(__dirname,'artist-candidate.blend'))));
 }
}
const preservation=read('saved-preservation.json');
assert.equal(preservation.passed,true);
assert.deepEqual(preservation.rows.map(r=>r.retained_original_points_coordinates_named_skin_exact),[122400,121189]);
assert.deepEqual(preservation.rows.map(r=>r.protected_hands_exact),[50689,50673]);
for(const r of preservation.rows) {
 assert.equal(r.groups_163_rest_bones_head_tail_parents_world_exact,true);
 assert.equal(r.all_weights_normalized_errors,0);assert.equal(r.whole_topology_unchanged,false);
 assert.equal(r.candidate_vertices,r.retained_original_points_coordinates_named_skin_exact+r.new_native_interpolated_points);
}
for(const name of ['source','roundtrip']) {
 const report=read(name+'-deformation-report.json');
 assert.equal(report.passed,true);assert.equal(report.candidate,true);assert.equal(report.rendered,true);
 assert.equal(report.checks.length,121);assert.deepEqual(report.failures,[]);
 assert.equal(report.checks.filter(r=>r.edge_ratio_max!==undefined).length,118);
 assert(Math.max(...report.checks.filter(r=>r.edge_ratio_max!==undefined).map(r=>r.edge_ratio_max))<3);
 assert.equal(report.checks[0].surface_style,'unified-white-mannequin');assert.deepEqual(report.checks[0].garments,[]);
 assert.equal(manifest.copies.filter(r=>r.file.startsWith(name+'/')&&r.file.endsWith('.png')).length,34);
}
for(const gender of ['male','female']) {
 const b=fs.readFileSync(path.join(__dirname,`bodyguard-${gender}-candidate.glb`));
 assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
 const gltf=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 assert.equal(gltf.meshes.length,5);assert.equal(gltf.skins.length,1);assert.equal(gltf.skins[0].joints.length,163);
 assert.equal((gltf.images||[]).length,0);assert.equal((gltf.animations||[]).length,0);
 const body=gltf.nodes.find(n=>n.name==='BODYGUARD '+(gender==='male'?'Male':'Female')+' sculpt WIP');
 assert(body&&body.skin!==undefined);
 assert(gltf.meshes[body.mesh].primitives.every(p=>p.attributes.JOINTS_1!==undefined&&p.attributes.WEIGHTS_1!==undefined));
}
const browser=read('browser-report.json');
assert.equal(browser.stats.expected,4);assert.equal(browser.stats.unexpected+browser.stats.flaky+browser.stats.skipped,0);
assert.deepEqual(record.native_runs.map(r=>r.session),[2847,68106,66819,83141,20678,83904,61449]);
assert(record.native_runs.every(r=>r.exit_code===0));assert.equal(record.browser_run.exit_code,0);
assert.equal(record.observed_images.length,32);assert.equal(new Set(record.observed_images).size,32);
for(const f of record.observed_images) assert(manifest.copies.some(r=>r.file===f&&f.endsWith('.png')));
for(const k of ['human_camera_capture','human_coordinate_collection','appearance_passed','adopted','release_approved','stages_1_to_6_complete','pr9_merge_allowed']) assert.equal(record[k],false);
assert.equal(record.new_blend_files,3);assert.equal(record.new_glb_files,2);
for(const file of ['README.md','../../../../docs/avatar-production.md','../../../../docs/stories/stage2-avatar-candidate.md']) {
 const absolute=path.resolve(__dirname,file);
 for(const match of fs.readFileSync(absolute,'utf8').matchAll(/\]\(([^\s)]+)\)/g))
  if(!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(absolute),match[1].split('#')[0])));
}
console.log(JSON.stringify({integrity_passed:true,copies:110,gzip:17,protected_old_files:164,new_png:74,directly_viewed:32,native_exits:record.native_runs.map(r=>r.exit_code),new_Chrome:4,source_and_roundtrip_technical_pass:true,appearance_passed:false}));
