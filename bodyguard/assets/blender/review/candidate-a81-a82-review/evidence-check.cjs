// FR-A-01~07: actual immutable evidence integrity, never appearance/release approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
assert(process.argv[2]&&path.isAbsolute(process.argv[2]),'Absolute repository root required');
const root=path.resolve(process.argv[2]),d=__dirname,json=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=json(d+'/copy-manifest.json');
assert.equal(manifest.copied_files,65);assert.equal(manifest.files.length,65);assert.equal(new Set(manifest.files.map(x=>x.path)).size,65);
for(const item of manifest.files){
  assert(!path.isAbsolute(item.path));const p=path.resolve(root,item.path);
  assert(p.startsWith(d+'/')||/^bodyguard_avatar_candidate_(a81g|a81h|a82)_rejected\.blend$/.test(path.basename(p))&&path.dirname(p)===root+'/bodyguard/assets/blender');
  assert(fs.lstatSync(p).isFile());const bytes=fs.readFileSync(p);assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256);
  if(item.decoded_sha256)assert.equal(sha(zlib.gunzipSync(bytes)),item.decoded_sha256);
}
assert.equal(manifest.files.filter(x=>x.path.endsWith('.png')).length,26);
assert.equal(manifest.files.filter(x=>x.decoded_sha256).length,18);
for(const name of ['a81g-source-deformation.json','a81h-source-deformation.json','a82-source-deformation.json','a82-roundtrip-deformation.json']){
  const v=json(d+'/'+name),cases=v.checks.filter(x=>x.edge_ratio_max!==undefined);
  assert.equal(v.passed,true);assert.equal(v.rendered,false);assert.equal(v.checks.length,121);assert.equal(cases.length,118);assert.deepEqual(v.failures,[]);
  assert(cases.every(x=>Number.isFinite(x.edge_ratio_max)&&x.edge_ratio_max<3));
  assert.equal(cases.filter(x=>x.pose.includes('/neck/')).length,4);
}
for(const candidate of ['a81g','a81h','a82']){
  const v=json(d+'/'+candidate+'-saved-source.json');assert.equal(v.release_approved,false);
  assert.deepEqual(v.checks.map(x=>x.retained_coordinate_named_skin_vertices),[79070,78603]);
  assert.deepEqual(v.checks.map(x=>x.native_new_vertices),[8742,7310]);
  assert.deepEqual(v.checks.map(x=>x.retained_faces),[79020,78576]);
  assert(v.checks.every(x=>x.hands_rest_163_bones_matrices_crown_groups_exact&&x.retained_old_faces_exact&&x.source_unsaved));
  const entry=manifest.files.find(x=>x.path.endsWith('bodyguard_avatar_candidate_'+candidate+'_rejected.blend'));assert.equal(v.source_sha256,entry.sha256);
}
for(const name of ['a81g-generation.json','a81h-generation.json']){
  const v=json(d+'/'+name);assert(v.every(x=>x.retained_single_component_before_fill&&!x.separate_oral_remnant_deleted&&x.crown_neck_body_hands_163_rest_bones_matrices_preserved));
  assert.deepEqual(v.map(x=>x.front_boundary_vertices),[378,346]);
}
const projection=json(d+'/a82-generation.json');assert.deepEqual(projection.map(x=>x.projection_ray_misses),[2685,1614]);assert(projection.every(x=>x.topology_named_skin_retained_hands_163_bones_rest_matrices_exact));
assert.equal(json(d+'/a81-boundary-probe.json').checks.length,12);
const direct=json(d+'/a81b-native-grid-probe.json');assert.equal(direct.length,4);assert(direct.every(x=>x.native_faces===0&&!x.candidate_saved));
const editor=json(d+'/a81c-editor-grid-probe.json');assert.equal(editor.length,4);assert(editor.every(x=>x.native_operator_result[0]==='FINISHED'&&!x.candidate_saved));
assert.equal(json(d+'/a81f-complete-boundary-probe.json').checks.length,8);
const browser=json(d+'/a82-browser-report.json'),results=[];
const visit=s=>{for(const spec of s.specs||[])for(const test of spec.tests)results.push(...test.results);for(const sub of s.suites||[])visit(sub)};
for(const s of browser.suites)visit(s);
assert.equal(browser.stats.expected,3);assert.equal(browser.stats.unexpected+browser.stats.skipped+browser.stats.flaky,0);assert.deepEqual(browser.errors,[]);
assert.equal(results.length,3);assert(results.every(x=>x.status==='passed'&&x.errors.length===0));
const attachment=(result,name)=>JSON.parse(Buffer.from(result.attachments.find(x=>x.name===name).body,'base64').toString());
for(const gender of ['male','female']){
  const bytes=fs.readFileSync(d+'/bodyguard-'+gender+'-candidate.glb');
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.equal(gltf.meshes.length,5);assert.equal(gltf.skins.length,1);assert.equal(gltf.skins[0].joints.length,163);
  assert.equal((gltf.images||[]).length+(gltf.cameras||[]).length+(gltf.animations||[]).length,0);
  for(const result of results){const a=attachment(result,gender+'-native-asset');assert.equal(a.sha256,sha(bytes));assert.equal(a.bytes,bytes.length);assert.equal(a.eightWeightPrimitives,1);}
}
for(const label of ['남성','여성']){const a=attachment(results[1],label+'-technical-render');assert.equal(a.samples,180);assert.equal(a.static_angle_max,0);assert(a.moving_angle_max>.1);assert.equal(a.skeletons_independent,true);assert.equal(a.eight_weight_meshes,2);}
const record=json(d+'/execution-record.json');
assert.deepEqual(record.runs.map(x=>x.exit),[0,0,0,1,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0]);assert(record.all_native_actors_terminal_before_chrome);
for(const key of ['appearance_passed','accepted_candidate','merge_allowed','stages1_to6_passed'])assert.equal(record[key],false);
assert.equal(record.actual_camera_calls,0);assert.equal(record.actual_native_png,24);assert.equal(record.actual_browser_png,2);assert(record.all26_png_viewed);
for(const match of fs.readFileSync(d+'/README.md','utf8').matchAll(/\]\(([^)]+)\)/g)){const target=match[1];if(!/^https?:/.test(target))assert(fs.existsSync(path.resolve(d,target.split('#')[0])),target);}
console.log(JSON.stringify({integrity_passed:true,copies:65,decoded_sha:18,png:26,source_candidates:3,source_cases_each:118,roundtrip_cases:118,actual_chrome_tests:3,full34_rendered:false,appearance_passed:false,release_approved:false}));
