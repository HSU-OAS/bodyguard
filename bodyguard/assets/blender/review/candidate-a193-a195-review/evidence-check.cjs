// FR-A-03/08: immutable actual evidence integrity, not appearance/clinical approval.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const zlib = require('node:zlib'), crypto = require('node:crypto'), {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname,'../../../../..');
const bytes = file => fs.readFileSync(path.join(__dirname,file));
const json = file => JSON.parse(bytes(file));
const decoded = file => JSON.parse(zlib.gunzipSync(bytes(file)));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = json('copy-manifest.json'), execution = json('execution-record.json');
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'pipe'});
for(const r of [...manifest.previous_control_files,...manifest.protected_repository_inputs])
  assert.equal(sha(fs.readFileSync(path.join(root,r.file))),r.sha256);
for(const r of manifest.copies){
  const raw = bytes(r.file), content = r.file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw;
  assert.equal(raw.length,r.bytes); assert.equal(sha(raw),r.sha256); assert.equal(sha(content),r.decoded_sha256);
  if(r.file.endsWith('.png')) assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
}
assert.equal(manifest.protected_old_file_count,953); assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,109);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,22);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.png')).length,82);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.blend')).length,3);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.glb')).length,2);
const originalSha='602de73537edcf24fd7fe92aed84d28c800e99f5125865c5f5d644657f85e1f9';
for(const [phase,folds,saved] of [['a193',[17,7],false],['a194',[17,7],false],['a195',[1,0],true]]){
  const report=decoded(phase+'/posterior-report.json.txt.gz');
  assert.equal(report.input_sha256,originalSha); assert.equal(report.source_saved,saved);
  assert(!report.glb_saved&&!report.appearance_approved&&!report.full_deformation_qa);
  for(const [i,r] of report.rows.entries()){
    assert.equal(r.body,['Male','Female'][i]);assert.equal(r.after.local_long_folds,folds[i]);
    assert.equal(r.before.local_long_folds,[1,0][i]);assert.equal(r.native_generated_vertices,[2015,2165][i]);
    assert.equal(r.original_named_skin_exact,[129630,128389][i]);
    assert.equal(r.unrelated_face_winding_exact,[176154,174054][i]);
    assert(r.all_front_original_coordinates_exact&&r.all_original_points_exact_after_native_topology);
    assert(r.all_zero_mask_coordinates_exact_after_fairing&&r.hands_groups_163_rest_bones_world_material_exact);
    assert(r.existing_ledger_entries_exact_new_points_zero_extended);
    assert.equal(r.after.components,1);
    for(const k of ['global_nonmanifold','global_winding_errors','local_tiny_faces'])assert.equal(r.after[k],0);
    assert(r.maximum_artist_displacement_m<.006);
    assert(!r.whole_neck_body_remesh&&!r.full_skin_deformation_qa&&!r.appearance_approved);
    assert.equal(r.geometry_guards_passed,phase==='a195');
    if(phase==='a194'){
      const old=new Set(r.before.long_fold_edges.map(e=>e.vertex_ids.slice().sort((a,b)=>a-b).join(',')));
      const fresh=r.after.long_fold_edges.filter(e=>!old.has(e.vertex_ids.slice().sort((a,b)=>a-b).join(',')));
      assert.equal(fresh.length,[16,7][i]);
      assert(fresh.every(e=>e.z_height_fraction.every(z=>z<.875)));
    }
    if(phase==='a195'){
      assert(r.lower_cap_original_coordinates_exact);
      assert.equal(r.lower_cap_protected_height_fraction,.875);
      assert.equal(r.fairing_lower_taper_height_fraction,.015);
      assert(r.maximum_artist_displacement_m<.0006);
    }
  }
  if(saved)assert.equal(sha(bytes('a195/artist-candidate.blend')),report.candidate_sha256);
}
const preserved=decoded('diagnosis/a195-saved-preservation.json.txt.gz');
assert(preserved.passed&&!preserved.appearance_approved&&!preserved.full_deformation_qa);
assert.equal(preserved.rows.length,2);
for(const [i,r]of preserved.rows.entries()){
  assert.equal(r.original_named_skin_exact,[129630,128389][i]);
  assert.equal(r.original_front_lower_cap_outside_coordinates_exact,[126101,125394][i]);
  assert(r.hands_groups_163_rest_bones_world_material_exact&&r.ledger_prefixes_exact_zero_extended);
  assert(r.maximum_original_displacement_m<.0006);
}
for(const phase of ['source','roundtrip']){
  const r=decoded(phase+'-review/deformation-report.json.txt.gz');
  assert(r.passed&&r.rendered&&r.candidate);assert.equal(r.failures.length,0);
  assert.equal(r.checks.length,121);assert.equal(r.checks.filter(c=>c.pose!=='neutral').length,118);
  assert.equal(r.checks[0].surface_style,'unified-white-mannequin');assert.equal(r.checks[0].garments.length,0);
  assert.equal(manifest.copies.filter(c=>c.file.startsWith(phase+'-review/')&&c.file.endsWith('.png')).length,34);
}
const exported=decoded('glb/roundtrip-report.json.txt.gz');
assert.equal(exported.maximum_skin_influences,8); assert.equal(exported.ratio,1);
assert(exported.transforms_passed&&exported.geometry_deformation_pending);
for(const row of exported.checks){
  const file='glb/bodyguard-'+row.gender.toLowerCase()+'-candidate.glb', raw=bytes(file);
  assert.equal(raw.length,row.bytes);assert.equal(raw.toString('ascii',0,4),'glTF');
  assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
  assert.equal(row.animations,0);assert.equal(row.images,0);
}
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[1,0,0,0,0,0,0]);
for(const row of execution.native_runs){
  const log=decoded(row.log);
  assert.equal(log.command,row.command);assert.equal(log.exit_code,row.exit_code);
  assert.equal(log.terminal_chunk_id,row.terminal_chunk_id);
  assert.equal(log.chunks.at(-1).exit_code,row.exit_code);
  assert(log.full_stdout_retained&&log.chunks.every(c=>!c.output.includes('Warning: truncated')));
}
const browser=decoded('browser/browser-report.json.txt.gz');
assert.equal(browser.stats.expected,3);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);
assert.equal(browser.stats.flaky,0);
let assetAttachments=0, renderAttachments=0;
function verifyBrowserSuite(suite){
  for(const spec of suite.specs||[])for(const test of spec.tests)for(const result of test.results){
    assert.equal(result.status,'passed');assert.equal(result.retry,0);assert.equal(result.errors.length,0);
    for(const attachment of result.attachments){
      if(attachment.name.endsWith('-native-asset')){
        const asset=JSON.parse(Buffer.from(attachment.body,'base64').toString('utf8'));
        const raw=bytes('glb/'+asset.filename);
        assert.equal(asset.bytes,raw.length);assert.equal(asset.sha256,sha(raw));
        assert.equal(asset.eightWeightPrimitives,1);assetAttachments++;
      }
      if(attachment.name.endsWith('-technical-render')){
        const render=JSON.parse(Buffer.from(attachment.body,'base64').toString('utf8'));
        assert.equal(render.samples,180);assert(render.skeletons_independent);
        assert.equal(render.static_angle_max,0);assert(render.moving_angle_max>0);
        assert.equal(render.eight_weight_meshes,2);renderAttachments++;
      }
    }
  }
  for(const nested of suite.suites||[])verifyBrowserSuite(nested);
}
for(const suite of browser.suites)verifyBrowserSuite(suite);
assert.equal(assetAttachments,6);assert.equal(renderAttachments,2);
const browserLog=decoded('logs/a195-browser-observed.json.txt.gz');
assert.equal(browserLog.exit_code,0);assert.equal(browserLog.chunks.at(-1).exit_code,0);
assert(browserLog.full_stdout_retained&&browserLog.chunks.every(c=>!c.output.includes('Warning: truncated')));
for(const r of decoded('logs/final-static.json.txt.gz'))assert.equal(r.exit_code,0);
assert.equal(execution.frontend_static.length,2);
assert.deepEqual(execution.frontend_static.map(r=>r.command),['pnpm check','pnpm exec tsc --noEmit']);
for(const r of execution.frontend_static){
  assert.equal(r.exit_code,0);assert.equal(r.chunks.at(-1).exit_code,0);
  assert.equal(r.chunks.at(-1).chunk_id,r.terminal_chunk_id);
  assert(r.chunks.every(c=>!c.output.includes('Warning: truncated')));
}
assert(execution.native_actors_sequential&&execution.native_and_browser_actors_not_overlapped);
assert.equal(execution.evidence_copy.exit_code,0);assert.equal(execution.evidence_copy.chunks.at(-1).exit_code,0);
assert.equal(execution.reference_sha256,'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
assert.equal(execution.new_assets.blend,3);assert.equal(execution.new_assets.GLB,2);
assert.equal(execution.new_verification.PNG,82);assert.equal(execution.new_verification.source_deformation_cases,118);
assert.equal(execution.new_verification.glb_deformation_cases,118);assert.equal(execution.new_verification.Chrome_cases,3);
assert.equal(execution.new_verification.camera_calls,0);
assert.equal(execution.directly_viewed.length,62);assert.equal(new Set(execution.directly_viewed).size,62);
for(const f of execution.directly_viewed)assert(manifest.copies.some(c=>c.file===f&&f.endsWith('.png')));
assert(Object.values(execution.limitations).every(v=>v===false));
assert(Object.values(execution.preserved_rules).every(v=>v===true));
console.log(JSON.stringify({integrity_passed:true,copies:109,gzip:22,PNG:82,directly_viewed:62,
  protected_old_files:953,native_exits:[1,0,0,0,0,0,0],source_118:118,GLB_118:118,Chrome:3,
  new_blend:3,new_GLB:2,appearance_passed:false,service_adopted:false}));
