// FR-A-01~08: read-only evidence consistency, not appearance or release approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
assert(process.argv[2]&&path.isAbsolute(process.argv[2]),'Absolute repository root required');
const root=path.resolve(process.argv[2]),d=__dirname,json=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const m=json(d+'/copy-manifest.json'),source=root+'/bodyguard/assets/blender/bodyguard_avatar_candidate_a88d_rejected.blend';
assert.equal(m.copied_files,70);assert.equal(m.files.length,70);assert.equal(new Set(m.files.map(x=>x.path)).size,70);
for(const x of m.files){
  assert(!path.isAbsolute(x.path));const p=path.resolve(root,x.path);
  assert(p.startsWith(d+'/')||p===source);assert(fs.lstatSync(p).isFile());
  const b=fs.readFileSync(p);assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);
  if(x.decoded_sha256)assert.equal(sha(zlib.gunzipSync(b)),x.decoded_sha256);
  if(p.endsWith('.png'))assert(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
}
assert.equal(m.files.filter(x=>x.path.endsWith('.png')).length,45);assert.equal(m.files.filter(x=>x.decoded_sha256).length,15);
assert.equal(sha(fs.readFileSync(d+'/ceo-reference.png')),'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
for(const [f,rendered]of [['source-deformation.json',true],['roundtrip-deformation.json',false]]){
  const v=json(d+'/'+f),c=v.checks.filter(x=>x.edge_ratio_max!==undefined);
  assert.equal(v.checks.length,121);assert.equal(c.length,118);assert.equal(v.passed,true);assert.equal(v.rendered,rendered);assert.deepEqual(v.failures,[]);
  assert(c.every(x=>Number.isFinite(x.edge_ratio_max)&&x.edge_ratio_max<3));assert.equal(c.filter(x=>x.pose.includes('/neck/')).length,4);
}
const saved=json(d+'/saved-body-preservation.json');
assert.equal(saved.passed,true);assert.equal(saved.source_saved,false);assert.deepEqual(saved.rows.map(x=>x.retained_authored_body_points_and_named_skin),[75915,75865]);
assert(saved.rows.every(x=>x.hands_163bones_rest_matrices_identical));
assert.equal(saved.source_sha256[1],m.files.find(x=>path.resolve(root,x.path)===source).sha256);
const gen=json(d+'/generation.json');assert.equal(gen.length,2);
for(const [i,x]of gen.entries()){
  assert.equal(x.retained_original_vertices,[75915,75865][i]);assert(x.retained_body_skin_hands_bones_rest_preserved);
  assert.equal(x.artist_gap_m,.024);assert.equal(x.native_bridge.interpolation,'LINEAR');assert.equal(x.native_bridge.cuts,6);
  assert(x.bridge_only_native_fairing.maximum_artist_displacement_m>0&&x.bridge_only_native_fairing.maximum_artist_displacement_m<.006);
  assert.equal(x.head_root_artist_fit.native_modifier,'SHRINKWRAP/TARGET_PROJECT/ON_SURFACE/offset0');
  assert.equal(x.head_root_artist_fit.protected_upper_head_exact_points,[51285,51677][i]);
  assert(x.head_root_artist_fit.not_anatomical_or_clinical_approval&&x.head_skin_correspondence.donor_coordinates_preserved_prepared_named_skin_exact);
}
const probe=json(d+'/root-correspondence.json');assert.equal(probe.source_saved,false);assert.equal(probe.clinical_anatomical_approval,false);assert.equal(probe.rows.length,4);
const browser=json(d+'/browser-report.json'),results=[];function scan(s){for(const p of s.specs||[])for(const x of p.tests)results.push(...x.results);for(const x of s.suites||[])scan(x);}browser.suites.forEach(scan);
assert.equal(browser.stats.expected,3);assert.equal(browser.stats.unexpected+browser.stats.flaky+browser.stats.skipped,0);assert.deepEqual(browser.errors,[]);
assert.equal(results.length,3);assert(results.every(x=>x.status==='passed'&&x.errors.length===0));
const attachment=(r,n)=>JSON.parse(Buffer.from(r.attachments.find(x=>x.name===n).body,'base64').toString());
for(const gender of ['male','female']){
  const b=fs.readFileSync(d+'/bodyguard-'+gender+'-candidate.glb');assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
  const v=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));assert.equal(v.meshes.length,5);assert.equal(v.skins.length,1);assert.equal(v.skins[0].joints.length,163);
  assert.equal((v.images||[]).length+(v.cameras||[]).length+(v.animations||[]).length,0);
  for(const r of results){const a=attachment(r,gender+'-native-asset');assert.equal(a.sha256,sha(b));assert.equal(a.bytes,b.length);assert.equal(a.eightWeightPrimitives,1);}
}
for(const name of ['남성','여성']){const a=attachment(results[1],name+'-technical-render');assert.equal(a.samples,180);assert.equal(a.static_angle_max,0);assert(a.moving_angle_max>.1);assert(a.skeletons_independent);assert.equal(a.eight_weight_meshes,2);}
const r=json(d+'/execution-record.json');assert.equal(r.runs.length,11);assert.equal(r.runs.filter(x=>x.exit===1).length,3);assert(r.runs.every(x=>[0,1].includes(x.exit)));
assert.equal(r.failures.length,3);assert(r.failures.every(x=>x.exit===1&&x.observed_terminal_output.includes('AssertionError')));
assert(r.all_native_actors_terminal_before_chrome);assert.equal(r.browser.camera_calls,0);assert.equal(r.browser.duration_ms,browser.stats.duration);
assert.equal(r.actual_source_png,34);assert.equal(r.actual_import_png,8);assert.equal(r.actual_browser_png,2);assert.equal(r.actual_png_viewed,26);
for(const [key,folder,count]of [['source_png_viewed','source',16],['import_png_viewed','import',8],['browser_png_viewed','browser',2]]){assert.equal(r[key].length,count);assert.equal(new Set(r[key]).size,count);for(const f of r[key])assert(fs.existsSync(path.join(d,folder,f)));}
assert.equal(r.script_checks.six_native_files_full_ruff_exit,0);assert.equal(r.script_checks.six_native_files_format_check_exit,0);
for(const k of ['appearance_passed','accepted_candidate','merge_allowed','stages1_to6_passed','release_approved'])assert.equal(r[k],false);
const links=[...fs.readFileSync(d+'/README.md','utf8').matchAll(/\]\(([^)]+)\)/g)];
assert(links.length>20);for(const [,target]of links)if(!/^https?:/.test(target))assert(fs.existsSync(path.resolve(d,target.split('#')[0])),target);
console.log(JSON.stringify({integrity_passed:true,copies:70,gzip:15,actual_native_browser_png:44,ceo_reference_png:1,directly_viewed:26,source118:true,import118:true,chrome_tests:3,failed_native_runs_preserved:3,appearance_passed:false,release_approved:false}));
