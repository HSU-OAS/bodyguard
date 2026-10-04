// Immutable actual geometry evidence and versioned helper provenance; not appearance/clinical approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'../../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=f=>fs.readFileSync(path.join(__dirname,f));
const decoded=f=>zlib.gunzipSync(bytes(f));
const json=f=>JSON.parse(bytes(f)),gz=f=>JSON.parse(decoded(f));
const manifest=json('copy-manifest.json'),record=json('execution-record.json');
assert.deepEqual(manifest.counts,{copies:184,gzip:76,PNG:104,blend:2,GLB:2});
assert.equal(new Set(manifest.copies.map(c=>c.file)).size,184);
for(const r of manifest.copies){
 const raw=bytes(r.file),content=r.file.endsWith('.gz')?zlib.gunzipSync(raw):raw;
 assert.equal(raw.length,r.bytes);assert.equal(sha(raw),r.sha256);assert.equal(sha(content),r.decoded_sha256);
 if(r.file.endsWith('.png'))assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
}
const history=gz(manifest.prior_bytes_report);
assert(history.historical_evidence_and_other_inputs_unchanged&&history.one_intentional_exporter_change);
assert.equal(history.protected_old_targets,1066);assert.equal(history.unchanged_live_old_targets,1065);
assert.equal(history.old_checker_semantics_rerun,false);
for(const r of history.all_checked_files){
 const snapshot=manifest.historical_input_snapshots.find(s=>s.file===r.file);
 const content=snapshot?decoded(snapshot.snapshot):fs.readFileSync(path.join(root,r.file));
 assert.equal(sha(content),r.sha256,r.file);
}
const oldExporter=manifest.historical_input_snapshots.find(r=>r.file==='bodyguard/assets/blender/export_avatar_candidate.py');
assert.equal(sha(decoded(oldExporter.snapshot)),history.old_exporter_snapshot_sha256);
assert.equal(sha(decoded('executed-helpers/export_avatar_candidate.py.txt.gz')),history.current_exporter_sha256);
const regression=gz('diagnosis/a210-finalizer-regression.json.txt.gz');
assert(regression.passed&&regression.rows.length===2&&regression.saved_assets===0&&regression.camera_calls===0);
const moduleInput=Object.entries(regression.input_sha256).find(([p])=>p.endsWith('/web_surface_topology.py'));
assert.equal(sha(decoded('executed-helpers/web_surface_topology.py.txt.gz')),moduleInput[1]);
for(const [i,r]of regression.rows.entries()){
 assert.equal(r.positive.repaired_bad_parents,[31,10][i]);
 assert.equal(r.positive.explicit_good_parents,[40,33][i]);
 assert.equal(r.positive.zero_triangles_before,[11,4][i]);assert.equal(r.positive.zero_triangles_after,0);
 assert.equal(r.positive.preserved_existing_tiny_triangles,[1,0][i]);assert(r.positive.coordinates_skin_unrelated_triangles_exact);
 assert.equal(r.synthetic_zero_triangle_rejected,'Existing zero-area triangle requires source repair');
}
assert(decoded('diagnosis/a201-tessellation-parents.json.txt.gz').equals(decoded('diagnosis/a202-tessellation-parents-compact.json.txt.gz')));
const oldRaw=gz('diagnosis/a200-raw-glb-surface.json.txt.gz');
assert.deepEqual(oldRaw.rows.map(r=>r.meshes.find(m=>m.eight_weights).zero_area_triangles),[11,4]);
const finalRaw=gz('diagnosis/a211-raw-glb-surface.json.txt.gz');
for(const [i,r]of finalRaw.rows.entries()){
 const file='glb/bodyguard-'+r.gender+'-candidate.glb';assert.equal(sha(bytes(file)),r.sha256);
 assert(r.meshes.every(m=>m.zero_area_triangles===0&&m.zero_normals===0&&m.posterior_tiny_triangles===0));
 assert.equal(r.meshes.reduce((s,m)=>s+m.tiny_triangles_1e_minus_10,0),[1,0][i]);
}
const preserved=gz('diagnosis/a213-saved-web-differences.json.txt.gz');
assert(preserved.passed&&preserved.rows.length===2);
let changed=0,max=0;
for(const row of preserved.rows){
 const body=row.surface_differences.find(s=>s.surface.endsWith('sculpt WIP'));
 assert(body.changed_points===0&&body.changed_numeric_skin_rows===0&&body.group_order_exact&&body.world_exact);
 assert(row.all_163_rest_bones_and_world_exact&&row.shared_material_finish_exact&&row.fully_explicit_triangles);
 assert.equal(row.all_saved_surface_coordinates_numeric_skin_groups_world_exact,false);
 for(const s of row.surface_differences){assert.equal(s.changed_points,0);changed+=s.changed_numeric_skin_rows;max=Math.max(max,s.max_weight_delta);}
}
assert.equal(changed,5);assert.equal(max,5.960464477539063e-8);
for(const folder of ['artist-review','web-review','roundtrip-review']){
 const r=gz(folder+'/deformation-report.json.txt.gz');assert(r.passed&&r.rendered&&r.candidate&&!r.failures.length);
 assert.equal(r.checks.length,121);assert.equal(r.checks.filter(c=>c.pose!=='neutral').length,118);
 assert.equal(manifest.copies.filter(c=>c.file.startsWith(folder+'/')&&c.file.endsWith('.png')).length,34);
}
assert.equal(record.native_runs.length,19);
assert.deepEqual(record.native_runs.map(r=>r.exit_code),[1,1,0,0,0,1,0,1,0,1,0,0,0,0,0,1,0,0,0]);
for(const r of record.native_runs){
 const log=gz(r.log);assert.equal(log.exit_code,r.exit_code);assert.equal(log.chunks.at(-1).exit_code,r.exit_code);
 assert.equal(log.chunks.at(-1).chunk_id,r.terminal_chunk_id);
 assert.equal(log.full_stdout_retained,r.full_stdout_retained);
}
const browser=gz('diagnosis/a211-browser-report.json.txt.gz');
assert(browser.stats.expected===3&&browser.stats.unexpected===0&&browser.stats.skipped===0);
assert.equal(browser.stats.duration,42277.59);
assert.equal(gz('logs/a211Browser-observed.json.txt.gz').exit_code,0);
for(const r of gz('logs/final-static-observed.json.txt.gz'))assert.equal(r.completion?.exit_code??r.exit_code,0);
assert(record.native_actors_sequential&&record.native_and_browser_actors_not_overlapped);
assert(record.evidence_copy.exit_code===0&&record.evidence_copy.chunks.at(-1).exit_code===0);
assert.equal(record.directly_viewed.length,14);assert.equal(new Set(record.directly_viewed).size,14);
for(const f of record.directly_viewed)assert(manifest.copies.some(c=>c.file===f&&f.endsWith('.png')));
assert(Object.values(record.limitations).every(v=>v===false));assert(Object.values(record.preserved_rules).every(v=>v===true));
assert.equal(record.new_verification.camera_calls,0);assert.equal(record.artist_original_file_unchanged,true);
// Deliberately limited patterns; this is not a complete security audit.
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bghp_[A-Za-z0-9]{36}\b/,/\bgithub_pat_[A-Za-z0-9_]{60,}\b/];
for(const c of manifest.copies.filter(c=>c.file.endsWith('.gz'))){const text=decoded(c.file).toString('utf8');for(const pattern of patterns)assert(!pattern.test(text),'Potential credential: '+c.file);}
let localLinks=0;
for(const doc of ['bodyguard/docs/stories/stage2-avatar-candidate.md','bodyguard/docs/avatar-production.md','bodyguard/docs/tasks.md','bodyguard/assets/blender/review/candidate-a196-a213-review/README.md']){
 const file=path.join(root,doc),text=fs.readFileSync(file,'utf8');
 for(const m of text.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
  if(/^(https?:|codex:|mailto:|#)/.test(m[1]))continue;
  const target=m[1].split('#')[0].replace(/^<|>$/g,'');if(!target)continue;
  assert(fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(target))),doc+' -> '+target);localLinks++;
 }
}
console.log(JSON.stringify({local_links_checked:localLinks,limited_credential_scan_gzip:76,not_full_security_audit:true}));
console.log(JSON.stringify({integrity_passed:true,...manifest.counts,protected_prior_targets:1066,unchanged_live_prior_targets:1065,intentional_exporter_change:1,directly_viewed:14,native_runs:19,native_failures:6,source118:118,web118:118,GLB118:118,Chrome:3,appearance_approved:false,service_adopted:false}));
