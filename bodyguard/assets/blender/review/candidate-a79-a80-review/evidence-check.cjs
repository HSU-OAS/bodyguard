// FR-A-01~07: actual artifact integrity and rejected appearance; never release approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]),d=__dirname,json=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=json(d+'/copy-manifest.json');
assert.equal(manifest.copied_files,27);assert.equal(manifest.files.length,27);assert.equal(new Set(manifest.files.map(x=>x.path)).size,27);
for(const item of manifest.files){
  assert(!path.isAbsolute(item.path));const p=path.resolve(root,item.path);
  assert(p.startsWith(d+'/')||p===root+'/bodyguard/assets/blender/bodyguard_avatar_candidate_a80_rejected.blend');
  assert(fs.lstatSync(p).isFile());const b=fs.readFileSync(p);assert.equal(b.length,item.bytes);assert.equal(sha(b),item.sha256);
  if(item.decoded_sha256)assert.equal(sha(zlib.gunzipSync(b)),item.decoded_sha256);
}
assert.equal(manifest.files.filter(x=>x.path.endsWith('.png')).length,10);
assert.equal(manifest.files.filter(x=>x.decoded_sha256).length,7);
for(const file of ['source-deformation-report.json','roundtrip-deformation-report.json']){
  const r=json(d+'/'+file),cases=r.checks.filter(x=>x.edge_ratio_max!==undefined);
  assert.equal(r.passed,true);assert.equal(r.rendered,false);assert.equal(r.checks.length,121);assert.equal(cases.length,118);
  assert.equal(r.failures.length,0);assert(cases.every(x=>Number.isFinite(x.edge_ratio_max)&&x.edge_ratio_max<3));
}
const saved=json(d+'/saved-source-preservation.json');
assert.equal(saved.passed,true);assert.equal(saved.source_saved,false);assert.deepEqual(saved.checks.map(x=>x.exact_outside_artist_mask),[75849,75765]);
assert(saved.checks.every(x=>x.named_prepared_skin_topology_hands_163_rest_bones_matrices_exact));
const edit=json(d+'/generation-report.json');
assert(edit.every(x=>x.native_bind_succeeded && x.continuous_cervical_mesh_no_new_ring_or_bridge && x.outside_mask_coords_hands_163_rest_bones_matrices_topology_named_skin_exact));
assert.deepEqual(edit.map(x=>x.source_vertices),[89641,89690]);
const cage=JSON.parse(zlib.gunzipSync(fs.readFileSync(d+'/professional-cage-inspection.json.gz')));assert.deepEqual(cage.map(x=>x.cage_vertices),[10582,10582]);assert(cage.every(x=>x.source_saved===false));
const probe=json(d+'/failed-boundary-diagnostic.json');assert.equal(probe.candidate_saved,false);assert.equal(probe.body,'Male');assert.equal(probe.new_ring_points,132);assert.equal(probe.saved_ring_points,132);assert(probe.ring_max_nearest_distance_m>0.00001);
const browser=json(d+'/browser-report.json'),results=[];
const visit=s=>{for(const sp of s.specs||[])for(const test of sp.tests)results.push(...test.results);for(const sub of s.suites||[])visit(sub)};
for(const s of browser.suites)visit(s);
assert.equal(browser.stats.expected,3);assert.equal(browser.stats.unexpected+browser.stats.skipped+browser.stats.flaky,0);assert.equal(browser.errors.length,0);
assert.equal(results.length,3);assert(results.every(x=>x.status==='passed'&&x.errors.length===0));
const attachment=(r,name)=>JSON.parse(Buffer.from(r.attachments.find(a=>a.name===name).body,'base64').toString());
for(const gender of ['male','female']){
  const p=d+'/bodyguard-'+gender+'-candidate.glb',b=fs.readFileSync(p);assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
  const m=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));assert.equal(m.meshes.length,5);assert.equal(m.skins.length,1);assert.equal(m.skins[0].joints.length,163);
  assert.equal((m.images||[]).length+(m.cameras||[]).length+(m.animations||[]).length,0);
  for(const result of results){const a=attachment(result,gender+'-native-asset');assert.equal(a.sha256,sha(b));assert.equal(a.bytes,b.length);assert.equal(a.eightWeightPrimitives,1);}
}
for(const label of ['남성','여성']){const a=attachment(results[1],label+'-technical-render');assert.equal(a.samples,180);assert.equal(a.static_angle_max,0);assert(a.moving_angle_max>.1);assert.equal(a.skeletons_independent,true);assert.equal(a.eight_weight_meshes,2);}
const record=json(d+'/execution-record.json');
assert.deepEqual(record.runs.map(x=>x.exit),[0,1,1,1,0,0,0,0,0,0,0]);assert.equal(record.all_native_actors_terminal_before_chrome,true);
assert.equal(record.appearance_passed,false);assert.equal(record.accepted_candidate,false);assert.equal(record.merge_allowed,false);assert.equal(record.stages1_to6_passed,false);
for(const rel of ['README.md']){
  const text=fs.readFileSync(d+'/'+rel,'utf8');
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){const target=match[1];if(!/^https?:/.test(target))assert(fs.existsSync(path.resolve(d,target.split('#')[0])),target);}
}
console.log(JSON.stringify({integrity_passed:true,copies:27,png:10,source_cases:118,roundtrip_cases:118,actual_chrome_tests:3,full34_rendered:false,appearance_passed:false,release_approved:false}));
