// FR-A-01~08: read-only evidence consistency, not appearance or release approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
assert(process.argv[2]&&path.isAbsolute(process.argv[2]),'Absolute repository root required');
const root=path.resolve(process.argv[2]),d=__dirname,json=p=>JSON.parse(fs.readFileSync(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const m=json(d+'/copy-manifest.json'),source=root+'/bodyguard/assets/blender/bodyguard_avatar_candidate_a89_rejected.blend';
assert.equal(m.copied_files,96);assert.equal(m.files.length,96);assert.equal(new Set(m.files.map(x=>x.path)).size,96);
for(const x of m.files){
  assert(!path.isAbsolute(x.path));const p=path.resolve(root,x.path);
  assert(p.startsWith(d+'/')||p===source);assert(fs.lstatSync(p).isFile());
  const b=fs.readFileSync(p);assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);
  if(x.decoded_sha256)assert.equal(sha(zlib.gunzipSync(b)),x.decoded_sha256);
  if(p.endsWith('.png'))assert(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
}
assert.equal(m.files.filter(x=>x.path.endsWith('.png')).length,77);assert.equal(m.files.filter(x=>x.decoded_sha256).length,9);
assert.equal(sha(fs.readFileSync(d+'/ceo-reference.png')),'45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62');
for(const [f,rendered]of [['source-deformation.json',true],['roundtrip-deformation.json',true]]){
  const v=json(d+'/'+f),c=v.checks.filter(x=>x.edge_ratio_max!==undefined);
  assert.equal(v.checks.length,121);assert.equal(c.length,118);assert.equal(v.passed,true);assert.equal(v.rendered,rendered);assert.deepEqual(v.failures,[]);
  assert(c.every(x=>Number.isFinite(x.edge_ratio_max)&&x.edge_ratio_max<3));assert.equal(c.filter(x=>x.pose.includes('/neck/')).length,4);
}
const saved=json(d+'/saved-preservation.json');
assert.equal(saved.passed,true);assert.equal(saved.source_saved,false);assert.deepEqual(saved.rows.map(x=>x.whole_vertex_count),[142087,139882]);
assert.deepEqual(saved.rows.map(x=>x.outside_artist_band_exact_vertices),[121062,120406]);
assert(saved.rows.every(x=>x.whole_topology_named_skin_hands_163_rest_bones_matrices_identical&&x.front_and_above_neck_entire_surface_exact&&x.maximum_artist_displacement_m>0&&x.maximum_artist_displacement_m<.006));
assert.equal(saved.sources[0],'9c3442444f3339c76fcbc6ca232965cf2d9e5173dc3b26b6a3c2b8f8f5a5810f');
assert.equal(saved.sources[1],m.files.find(x=>path.resolve(root,x.path)===source).sha256);
const gen=json(d+'/generation.json');assert.equal(gen.length,2);
for(const [i,x]of gen.entries()){
  assert.equal(x.vertices,[142087,139882][i]);assert.equal(x.protected_exact_vertices,[121062,120406][i]);
  assert(x.entire_topology_group_names_rest_bones_world_matrices_exact&&x.all_front_and_above_neck_coordinates_exact);
  assert.equal(x.native_fairing,'CORRECTIVE_SMOOTH/LENGTH_WEIGHTED/only_smooth/factor0.6/32iterations');
  assert.equal(x.maximum_artist_displacement_m,saved.rows[i].maximum_artist_displacement_m);
}
const paired=json(d+'/paired-original-edges.json');assert.equal(paired.full_qa,false);assert.equal(paired.checks.length,6);
assert(paired.checks.every(x=>x.edge_membership_and_original_length_class_locked));assert.deepEqual(paired.checks.map(x=>x.before_long),[114,30,34,116,16,13]);assert.deepEqual(paired.checks.map(x=>x.after_long),[102,30,34,80,16,13]);
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
const r=json(d+'/execution-record.json');assert.equal(r.runs.length,7);assert(r.runs.every(x=>x.exit===0));assert.equal(r.native_failures,0);
assert(r.all_native_actors_terminal_before_chrome);assert.equal(r.browser.camera_calls,0);assert.equal(r.browser.duration_ms,browser.stats.duration);
assert.equal(r.actual_first_png,6);assert.equal(r.actual_source_png,34);assert.equal(r.actual_import_png,34);assert.equal(r.actual_browser_png,2);assert.equal(r.actual_png_viewed,40);
for(const [key,folder,count]of [['first_png_viewed','first',6],['source_png_viewed','source',16],['import_png_viewed','import',16],['browser_png_viewed','browser',2]]){assert.equal(r[key].length,count);assert.equal(new Set(r[key]).size,count);for(const f of r[key])assert(fs.existsSync(path.join(d,folder,f)));}
assert.equal(r.script_checks.initial_maker_ruff_exit,1);assert.equal(r.script_checks.initial_maker_format_check_exit,1);
assert.equal(r.script_checks.final_two_native_full_ruff_exit,0);assert.equal(r.script_checks.final_two_native_format_check_exit,0);
for(const k of ['appearance_passed','accepted_candidate','merge_allowed','stages1_to6_passed','release_approved'])assert.equal(r[k],false);
const links=[...fs.readFileSync(d+'/README.md','utf8').matchAll(/\]\(([^)]+)\)/g)];
assert(links.length>20);for(const [,target]of links)if(!/^https?:/.test(target))assert(fs.existsSync(path.resolve(d,target.split('#')[0])),target);
console.log(JSON.stringify({integrity_passed:true,copies:96,gzip:9,actual_native_browser_png:76,ceo_reference_png:1,directly_viewed:40,source118:true,import118:true,chrome_tests:3,appearance_passed:false,release_approved:false}));
