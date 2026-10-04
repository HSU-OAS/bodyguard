// FR-A-01~07: verify actual copied bytes and scoped technical evidence, not release approval.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(process.argv[2]), d = __dirname;
const json = p => JSON.parse(fs.readFileSync(p,'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = json(path.join(d,'copy-manifest.json'));
assert.equal(manifest.copied_files,49); assert.equal(manifest.files.length,49);
assert.equal(new Set(manifest.files.map(x=>x.path)).size,49);
for(const item of manifest.files) {
  const p = path.resolve(root,item.path);
  assert(!path.isAbsolute(item.path) && (p.startsWith(d+path.sep) || p === path.join(root,'bodyguard/assets/blender/bodyguard_avatar_candidate_a78c_review.blend')));
  assert(fs.lstatSync(p).isFile());
  assert.equal(fs.statSync(p).size,item.bytes);
  assert.equal(sha(p),item.sha256);
  if(item.decoded_sha256) assert.equal(crypto.createHash('sha256').update(require('node:zlib').gunzipSync(fs.readFileSync(p))).digest('hex'),item.decoded_sha256);
}
assert.equal(manifest.files.filter(x=>x.path.endsWith('.png')).length,36);
for(const [file,rendered] of [['source-deformation-report.json',true],['roundtrip-deformation-report.json',false]]) {
  const r=json(path.join(d,file)), cases=r.checks.filter(x=>x.edge_ratio_max!==undefined);
  assert.equal(r.passed,true); assert.equal(r.rendered,rendered); assert.equal(r.checks.length,121);
  assert.equal(cases.length,118); assert.equal(r.failures.length,0);
  assert(cases.every(x=>Number.isFinite(x.edge_ratio_max) && x.edge_ratio_max<3));
}
const saved=json(path.join(d,'saved-source-preservation.json'));
assert.equal(saved.passed,true); assert.equal(saved.source_saved,false);
assert.deepEqual(saved.checks.map(x=>x.outside_tangent_band_exact),[126384,124943]);
assert(saved.checks.every(x=>x.named_skin_topology_hands_ring_ids_163_bones_rest_matrices_exact));
const edits=json(path.join(d,'generation-report.json'));
assert.deepEqual(edits.map(x=>x.iterations),[8,8]);
assert(edits.every(x=>x.factor===0.15 && x.maximum_artist_displacement_m>0 && x.maximum_artist_displacement_m<0.006 && x.cut_ring_ids_are_historical_not_planar_after_edit));
const browser=json(path.join(d,'browser-report.json')), results=[];
const visit=s=>{for(const sp of s.specs||[])for(const test of sp.tests)results.push(...test.results);for(const sub of s.suites||[])visit(sub)};
for(const suite of browser.suites)visit(suite);
assert.equal(browser.stats.expected,3); assert.equal(browser.stats.unexpected+browser.stats.flaky+browser.stats.skipped,0);
assert.equal(browser.errors.length,0); assert.equal(results.length,3);
assert(results.every(r=>r.status==='passed' && r.errors.length===0));
const attachment=(r,name)=>JSON.parse(Buffer.from(r.attachments.find(a=>a.name===name).body,'base64').toString());
for(const gender of ['male','female']) {
  const p=path.join(d,'bodyguard-'+gender+'-candidate.glb'), buffer=fs.readFileSync(p);
  assert.equal(buffer.toString('ascii',0,4),'glTF'); assert.equal(buffer.readUInt32LE(4),2); assert.equal(buffer.readUInt32LE(8),buffer.length);
  const model=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
  assert.equal(model.meshes.length,5); assert.equal(model.skins.length,1); assert.equal(model.skins[0].joints.length,163);
  assert.equal((model.images||[]).length+(model.animations||[]).length+(model.cameras||[]).length,0);
  for(const r of results) {const a=attachment(r,gender+'-native-asset');assert.equal(a.bytes,buffer.length);assert.equal(a.sha256,sha(p));assert.equal(a.eightWeightPrimitives,1)}
}
for(const name of ['남성-technical-render','여성-technical-render']) {
  const a=attachment(results[1],name);
  assert.equal(a.samples,180);assert.equal(a.static_angle_max,0);assert(a.moving_angle_max>0.1);
  assert.equal(a.skeletons_independent,true);assert.equal(a.eight_weight_meshes,2);
}
const record=json(path.join(d,'execution-record.json'));
assert.deepEqual(record.runs.map(x=>x.exit),[1,1,0,0,0,0,0,0]);
assert.equal(record.appearance_passed,false);assert.equal(record.merge_allowed,false);assert.equal(record.stages1_to6_passed,false);
console.log(JSON.stringify({integrity_passed:true,immutable_copies:49,png:36,source_cases:118,roundtrip_cases:118,actual_chrome_tests:3,appearance_passed:false,release_approved:false}));
