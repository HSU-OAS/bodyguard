// Repeatable evidence integrity and native data checks, not avatar approval.
const assert = require('node:assert/strict'), fs = require('node:fs');
const path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname,'../../../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'copy-manifest.json')));
const execution = JSON.parse(fs.readFileSync(path.join(__dirname,'execution-record.json')));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
execFileSync(process.execPath,[path.join(root,manifest.previous_integrity_checker)],{stdio:'inherit'});
for(const row of manifest.previous_control_files)
 assert.equal(sha(fs.readFileSync(path.join(root,row.file))),row.sha256);
for(const row of manifest.copies) {
 const bytes=fs.readFileSync(path.join(__dirname,row.file));
 assert.equal(bytes.length,row.bytes);
 assert.equal(sha(bytes),row.sha256);
 assert.equal(sha(row.file.endsWith('.gz')?zlib.gunzipSync(bytes):bytes),row.decoded_sha256);
}
assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,20);
assert.equal(manifest.copies.filter(r=>r.file.endsWith('.gz')).length,16);
assert.equal(manifest.protected_old_file_count,278);
assert.deepEqual(execution.native_runs.map(r=>r.exit_code),[0,1,1,1,0,1]);
assert(execution.native_actors_sequential);
for(const field of ['new_saved_sources','new_glb','new_png','new_source_118','new_roundtrip_118','new_browser_tests','camera_calls'])
 assert.equal(execution[field],0);
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname,file)));
const seams = read('cap-seam.json');
assert(seams.read_only && !seams.source_saved && !seams.appearance_approved);
assert.deepEqual(seams.rows.map(r=>r.seam_edges),[374,363]);
for(const file of ['weighted-fairing.json','depth-fairing.json','density-trial.json']) {
 const report=read(file);
 assert(!report.source_saved && !report.appearance_approved && !report.full_deformation_qa);
 assert.equal(report.rows.length,2);
 assert(report.rows.every(r=>!r.geometry_guards_passed));
}
const probe=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'native-point-retention.json.txt.gz'))));
assert(!probe.source_saved);
assert.deepEqual(probe.rows.map(r=>r.old_vertices),[123513,122269]);
for(const row of probe.rows) {
 assert.equal(row.retained_exact_coordinate_skin_parents,row.old_vertices);
 assert.equal(row.after_subdivide.invalid_old_handles.length,row.old_vertices);
 assert.equal(row.missing_exact_parents.length+row.missing_a106_original_points.length+row.missing_hands.length,0);
 assert(!row.same_coordinate_count_duplicates);
}
const density=read('density-trial.json');
assert.deepEqual(density.rows.map(r=>r.after.long_folds),[1,0]);
assert.deepEqual(density.rows.map(r=>r.after.tiny_faces),[27,33]);
assert.deepEqual(density.rows.map(r=>r.after.global_nonmanifold),[1,0]);
assert.deepEqual(density.rows.map(r=>r.retained_a123_coordinate_skin_exact),[123513,122269]);
assert(!execution.limits.geometry_guards_passed && !execution.limits.appearance_approved && !execution.limits.service_asset_adopted && !execution.limits.pr9_merge && !execution.limits.stage1_6_completed);
console.log(JSON.stringify({integrity_passed:true,copies:20,gzip:16,protected_old_files:278,native_exits:[0,1,1,1,0,1],new_assets:0,new_png:0,new_browser:0,geometry_or_appearance_passed:false}));
