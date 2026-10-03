// FR-A-01~08: actual evidence integrity; not appearance, clinical or release approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const bytes=f=>fs.readFileSync(path.join(__dirname,f)),gz=f=>JSON.parse(zlib.gunzipSync(bytes(f))),json=f=>JSON.parse(bytes(f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=json('copy-manifest.json'),record=json('execution-record.json');
assert.equal(manifest.counts.copies,138);assert.equal(manifest.counts.gzip,23);
assert.equal(manifest.counts.PNG,106);assert.equal(manifest.counts.blend,3);assert.equal(manifest.counts.GLB,4);
assert.equal(manifest.copies.length,manifest.counts.copies);assert.equal(new Set(manifest.copies.map(r=>r.file)).size,manifest.copies.length);
for(const r of manifest.copies){
 const raw=bytes(r.file),decoded=r.file.endsWith('.gz')?zlib.gunzipSync(raw):raw;
 assert.equal(raw.length,r.bytes);assert.equal(sha(raw),r.sha256,r.file);assert.equal(sha(decoded),r.decoded_sha256);
 if(r.file.endsWith('.png'))assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
}
const clearance=gz('diagnosis/joint-clearance.json.txt.gz');
assert(clearance.source_file_unchanged&&clearance.authored_mesh_coordinates_weights_faces_groups_world_unchanged);
assert(clearance.all_163_rest_bones_each_unchanged&&clearance.rows.length===10&&clearance.saved_assets===0&&clearance.camera_calls===0);
for(const r of clearance.rows.filter(r=>r.technical_pose.startsWith('lowerarm01.'))){
 const target=r.overlays.find(o=>o.surface.endsWith(r.technical_pose));assert(target.inside_body_vertices>0&&target.intersecting_triangle_pairs>0);
}
const removal=gz('diagnosis/removal-report.json.txt.gz');assert.equal(removal.removed_decorative_overlays.length,8);
assert(removal.all_retained_coordinates_skin_topology_groups_materials_world_exact&&removal.all_163_rest_bones_pose_world_each_exact);
assert.equal(sha(bytes('artist-candidate.blend')),removal.output_sha256);assert.equal(removal.source_sha256,manifest.source_sha256);
const creator=zlib.gunzipSync(bytes('executed-helpers/remove_joint_overlays-creator.py.txt.gz'));
const first=gz('diagnosis/saved-regression.json.txt.gz'),final=gz('diagnosis/saved-regression-final.json.txt.gz');
const hashFor=(r,suffix)=>Object.entries(r.input_sha256).find(([p])=>p.endsWith(suffix))[1];
assert.equal(sha(creator),hashFor(first,'/remove_joint_overlays.py'));
assert.equal(sha(zlib.gunzipSync(bytes('executed-helpers/remove_joint_overlays.py.txt.gz'))),hashFor(final,'/remove_joint_overlays.py'));
assert(first.passed&&final.passed&&final.independent_saved_reopen_body_and_163_rest_rigs_materials_exact);
assert.equal(final.unsafe_output_path_fixtures_rejected,4);assert.equal(final.positive_output_path_created_files,0);
assert.equal(final.saved_assets,0);assert.equal(final.camera_calls,0);
const raw=gz('diagnosis/raw-glb-surface.json.txt.gz'),preserved=gz('diagnosis/body-glb-preservation.json.txt.gz');
assert(preserved.passed&&preserved.rows.length===2);
for(const [i,r]of raw.rows.entries()){
 assert.equal(r.meshes.length,1);assert.equal(r.meshes[0].zero_area_triangles,0);assert.equal(r.meshes[0].zero_normals,0);
 assert.equal(r.meshes[0].tiny_triangles_1e_minus_10,[1,0][i]);assert.equal(r.meshes[0].posterior_tiny_triangles,0);assert(r.meshes[0].eight_weights);
 assert.equal(sha(bytes(`glb/bodyguard-${r.gender}-candidate.glb`)),r.sha256);
 const p=preserved.rows[i];assert.equal(p.candidate_sha256,r.sha256);assert.equal(p.skin_joints,163);assert.equal(p.decorative_nodes_remaining,0);
 assert(p.indices_inverse_bind_bone_transforms_hierarchy_and_body_material_exact);assert.equal(p.exact_attributes.length,6);
}
for(const folder of ['artist-review','web-review','roundtrip-review']){
 const r=gz(folder+'/deformation-report.json.txt.gz');assert(r.passed&&r.rendered&&r.candidate&&!r.failures.length);
 assert.equal(r.checks.length,121);assert.equal(r.checks.filter(c=>c.pose!=='neutral').length,118);
 assert.equal(manifest.copies.filter(c=>c.file.startsWith(folder+'/')&&c.file.endsWith('.png')).length,34);
}
for(const f of ['body-only-browser','browser']){
 const r=gz('diagnosis/'+f+'.json.txt.gz');assert.equal(r.stats.expected,3);assert.equal(r.stats.unexpected,0);assert.equal(r.stats.skipped,0);
}
assert.equal(record.native_runs.length,8);assert.equal(record.browser_runs.length,2);
for(const r of [...record.native_runs,...record.browser_runs]){assert.equal(r.chunks.at(-1).exit_code,0);assert(!r.chunks.some(c=>/Warning: truncated output/.test(c.output)));}
assert(record.native_and_browser_actors_sequential&&record.legacy_evidence_checker.exit_code===0);
assert.equal(new Set(record.directly_viewed).size,record.directly_viewed.length);
for(const f of record.directly_viewed)assert(manifest.copies.some(r=>r.file===f&&f.endsWith('.png')));
assert.equal(record.appearance_approved,false);assert.equal(record.service_adopted,false);assert.equal(record.stages_1_to_6_completed,false);
assert.equal(record.camera_calls,0);assert.equal(record.current_development_asset,'A37');assert.equal(record.pr_merge_allowed,false);
// Limited credential-pattern check, not a full security audit.
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[0-9A-Z]{16}\b/,/\bghp_[A-Za-z0-9]{36}\b/,/\bgithub_pat_[A-Za-z0-9_]{60,}\b/];
for(const r of manifest.copies.filter(r=>r.file.endsWith('.gz'))){const text=zlib.gunzipSync(bytes(r.file)).toString('utf8');assert(forbidden.every(p=>!p.test(text)),r.file);}
let localLinks=0;
for(const m of bytes('README.md').toString('utf8').matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
 if(/^(https?:|codex:|mailto:|#)/.test(m[1]))continue;
 const target=m[1].split('#')[0].replace(/^<|>$/g,'');if(!target)continue;
 assert(fs.existsSync(path.resolve(__dirname,decodeURIComponent(target))),target);localLinks++;
}
console.log(JSON.stringify({local_links_checked:localLinks,limited_credential_scan_gzip:23,not_full_security_audit:true}));
console.log(JSON.stringify({integrity_passed:true,...manifest.counts,native_runs:8,Chrome_tests:6,technical_poses_each:118,directly_viewed:record.directly_viewed.length,appearance_approved:false,service_adopted:false}));
