// Repeatable integrity/technical evidence, never appearance or clinical approval.
const assert = require('node:assert/strict'), fs = require('node:fs');
const path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root=path.resolve(__dirname,'../../../../..');
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,file)));
const manifest=read('copy-manifest.json'), execution=read('execution-record.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'inherit'});
for(const row of manifest.previous_control_files) assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256);
for(const row of manifest.copies) {
 const bytes=fs.readFileSync(path.join(__dirname,row.file));
 assert.equal(bytes.length,row.bytes); assert.equal(sha(bytes),row.sha256);
 assert.equal(sha(row.file.endsWith('.gz')?zlib.gunzipSync(bytes):bytes),row.decoded_sha256);
}
assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.protected_old_file_count,302);
assert.equal(manifest.copies.length,116);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,24);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.png')).length,76);
assert.equal(execution.native_runs.length,10);
assert(execution.native_actors_sequential && execution.native_runs.every(r=>r.exit_code===0));
const stage=read('diagnosis/a130-stage.json');
for(const row of stage.rows) {
 assert.deepEqual(row.native_stages.slice(0,2).map(s=>[s.stats.tiny_faces,s.stats.global_nonmanifold]),[[0,0],[0,0]]);
 assert(!row.geometry_guards_passed);
}
assert.deepEqual(stage.rows.map(r=>r.native_stages[2].stats.tiny_faces),[27,33]);
assert.equal(stage.rows[0].native_stages[2].nonmanifold_examples[0].linked_faces,4);
assert.equal(stage.rows[0].native_stages[2].nonmanifold_kinds.boundary,0);
for(const file of ['diagnosis/a131-earclip.json','diagnosis/a132-grid.json','diagnosis/a133-dense-area.json'])
 assert(read(file).rows.every(r=>!r.geometry_guards_passed));
const cap=read('topology-report.json'), saved=read('saved-preservation.json');
assert(cap.candidate_saved && !cap.input_source_saved && !cap.density_added);
assert(cap.rows.every(r=>r.geometry_guards_passed));
assert(saved.passed && !saved.appearance_approved);
assert.deepEqual(saved.rows.map(r=>r.coordinate_named_skin_exact),[123513,122269]);
assert.deepEqual(saved.rows.map(r=>r.outside_face_winding_exact),[163732,161970]);
assert.equal(sha(fs.readFileSync(path.join(__dirname,'artist-candidate.blend'))),cap.candidate_sha256);
for(const name of ['source','roundtrip']) {
 const r=read(`${name}-deformation-report.json`), stress=r.checks.filter(x=>x.edge_ratio_max!==undefined);
 assert(r.passed && r.rendered && !r.failures.length);
 assert.equal(r.checks.length,121); assert.equal(stress.length,118);
 assert(stress.every(x=>Number.isFinite(x.edge_ratio_max)&&x.edge_ratio_max<3));
 assert.equal(manifest.copies.filter(r=>r.file.startsWith(`${name}/`)&&r.file.endsWith('.png')).length,34);
}
const exported=read('export-report.json');
assert.equal(exported.ratio,1); assert.equal(exported.maximum_skin_influences,8);
assert(exported.transforms_passed && exported.checks.every(r=>r.meshes===5&&!r.animations&&!r.images));
const browser=read('browser-report.json');
assert.equal(browser.stats.expected,4);
assert.equal(browser.stats.unexpected+browser.stats.flaky+browser.stats.skipped,0);
assert.equal(execution.browser_conditions.camera_calls,0);
assert.equal(execution.directly_viewed.total,34);
assert.equal(execution.directly_viewed.not_viewed,42);
assert.equal(execution.static_verification.historical_executed_raw_producer_unused_import_F401,1);
assert(!execution.static_verification.clean_reproducer_native_executed);
for(const field of ['appearance_approved','service_asset_adopted','pr9_merge','stage1_6_completed']) assert.equal(execution.limits[field],false);
console.log(JSON.stringify({integrity_passed:true,copies:116,gzip:24,protected_old_files:302,native_exits:Array(10).fill(0),actual_png:76,directly_viewed:34,source_and_roundtrip_technical_pass:true,actual_Chrome:4,appearance_passed:false}));
