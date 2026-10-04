// FR-A-02/08: actual trial integrity and honest failed/invalid-conformance accounting.
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), zlib=require('node:zlib');
const root=path.resolve(__dirname,'../../../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,f)));
const manifest=read('copy-manifest.json'), record=read('execution-record.json');
assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,29);
assert.equal(new Set(manifest.copies.map(r=>r.file)).size,29);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,7);
const png=manifest.copies.filter(r=>r.file.endsWith('.png')).map(r=>r.file);
assert.equal(png.length,12);
assert.equal(record.observed_images.length,6);
assert.equal(new Set(record.observed_images).size,6);
assert(record.observed_images.every(f=>png.includes(f)&&f.endsWith('-grid-posterior.png')));
assert(png.filter(f=>!record.observed_images.includes(f)).every(f=>f.endsWith('-before-posterior.png')));
for(const row of manifest.copies) {
  const b=fs.readFileSync(path.join(__dirname,row.file));
  assert.equal(b.length,row.bytes); assert.equal(sha(b),row.sha256);
  assert.equal(sha(row.file.endsWith('.gz')?zlib.gunzipSync(b):b),row.decoded_sha256);
  if(row.file.endsWith('.png')) {
    assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(b.readUInt32BE(16),1000); assert.equal(b.readUInt32BE(20),1000);
  }
}
assert.equal(sha(fs.readFileSync(path.join(root,record.source.file))),record.source.sha256);
assert.equal(fs.statSync(path.join(root,record.source.file)).size,record.source.bytes);
assert.equal(sha(zlib.gunzipSync(fs.readFileSync(path.join(root,record.profile.file)))),record.profile.decoded_sha256);
for(const folder of ['candidate-a106-review','candidate-a107-a109-diagnosis','candidate-a110-a114-diagnosis','candidate-a115-diagnosis']) {
  const base=path.join(__dirname,'..',folder);
  for(const r of JSON.parse(fs.readFileSync(path.join(base,'copy-manifest.json'))).copies) assert.equal(sha(fs.readFileSync(path.join(base,r.file))),r.sha256);
}
for(const [folder,folds,tiny] of [['unverified-context',[197,235],[0,4]],['verified-context',[594,235],[10,4]],['web-triangles',[671,293],[17,9]]]) {
  const report=read(folder+'/grid-trial.json');
  assert.equal(report.source_sha256,record.source.sha256); assert.equal(report.source_saved,false);
  assert.equal(report.rows.length,2);
  assert.deepEqual(report.rows.map(r=>r.before_after[1].long_folds),folds);
  assert.deepEqual(report.rows.map(r=>r.before_after[1].tiny_faces),tiny);
  for(const row of report.rows) {
    assert.equal(row.trial_geometry_guards_passed,false);
    assert.equal(row.full_qa_or_appearance_approved,false);
    assert.equal(row.whole_topology_unchanged,false);
    for(const key of ['all_retained_coordinates_skin_exact','protected_hands_rest_matrices_exact','unmodified_face_winding_exact','sampled_not_exhaustive_surface_envelope']) assert.equal(row[key],true);
    assert.equal(row.new_skin_normalization_errors,0);
    assert.equal(row.candidate_vertices,row.source_vertices-row.removed_local_vertices+row.native_generated_vertices);
    assert.equal(row.before_after[1].global_nonmanifold,0); assert.equal(row.before_after[1].global_inconsistent_winding,0);
    const plan=read(folder+'/'+row.body.toLowerCase()+'-grid-plan.json');
    assert.equal(plan.ordered_profile_sha256,record.profile.decoded_sha256);
    assert.equal(plan.face_selection_split_prepare_used,false); assert.equal(plan.arbitrary_span_or_corner_used,false);
    assert.equal(plan.female_parity_triangle_edited,false);
    if(folder!=='unverified-context') {
      assert.equal(row.verified_active_body,'BODYGUARD '+row.body+' sculpt WIP');
      assert.equal(row.modifier_move_up_apply_finished,true);
      assert.equal(row.only_original_rig_modifier_remaining,true);
      assert(Math.max(row.old_to_new_sample_envelope_m,row.new_to_old_sample_envelope_m)<0.001);
    }
    if(folder==='web-triangles') {
      assert.equal(row.triangulation_coordinates_skin_exact,true);
      assert.deepEqual(Object.keys(row.native_new_face_sizes),['3']);
    }
  }
}
assert.equal(read('verified-context/grid-trial.json').rows[0].active_before_conformance,'BODYGUARD Female sculpt WIP');
assert(record.limitations[0].includes('NOT verified successful application'));
assert.deepEqual(record.runs.map(r=>r.session),[25397,1450,9486]);
assert.deepEqual(record.runs.map(r=>r.exit_code),[0,0,0]);
for(const key of ['source_saved','new_full_deformation_qa','new_browser_comparison','human_camera_capture','human_coordinate_collection','appearance_passed','adopted','release_approved','stages_1_to_6_complete','pr9_merge_allowed']) assert.equal(record[key],false);
for(const key of ['new_blend_files','new_glb_files']) assert.equal(record[key],0);
for(const file of ['README.md','../../../../docs/avatar-production.md','../../../../docs/stories/stage2-avatar-candidate.md']) {
  const absolute=path.resolve(__dirname,file);
  for(const match of fs.readFileSync(absolute,'utf8').matchAll(/\]\(([^\s)]+)\)/g)) if(!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(absolute),match[1].split('#')[0])));
}
console.log(JSON.stringify({integrity_passed:true,copies:29,gzip:7,new_png:12,directly_viewed:6,native_exits:[0,0,0],verified_context:true,source_saved:false,new_Chrome:0,appearance_passed:false}));
