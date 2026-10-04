'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const zlib = require('node:zlib'), assert = require('node:assert/strict');
const directory = __dirname, root = path.resolve(directory,'../../../../..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(directory,'copy-manifest.json')));
const read = file => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(directory,file+'.txt.gz'))));
assert.equal(manifest.copies.length,23); assert.equal(manifest.protected_prior.length,1264);
let bytes = 0;
for (const e of manifest.copies) {
  const compressed = fs.readFileSync(path.join(directory,e.file));
  assert.equal(compressed.length,e.bytes);assert.equal(sha(compressed),e.sha256);
  assert.equal(sha(zlib.gunzipSync(compressed)),e.decoded_sha256);bytes += e.bytes;
}
assert.equal(bytes,74126);assert.equal(bytes,manifest.total_bytes);
for (const e of manifest.protected_prior)
  assert.equal(sha(fs.readFileSync(path.join(root,e.file))),e.sha256,e.file);
for (const key of ['saved_new_artist_models','saved_new_GLB','saved_new_PNG']) assert.equal(manifest[key],0);
for (const key of ['appearance_approved','production_adopted','PR9_merged']) assert.equal(manifest[key],false);
const diagnosis=read('a323-diagnosis.json');assert.equal(diagnosis.native_rays,420);
assert.equal(diagnosis.input_bytes_unchanged,true);assert.equal(diagnosis.sculpt_source_save_export_camera_calls,0);
assert.deepEqual(Object.values(diagnosis.measurements).map(m=>m.original.fixed_original_edges),[27741,27366]);
const first=read('a324-pointer-failure.json');assert.equal(first.saved_candidate,false);
assert.equal(first.rows.length,0);assert.equal(first.solver_results.length,2);
for (const file of ['a324b-rejected-native.json','a326-rejected-quadratic.json']) {
  const failed=read(file);assert.equal(failed.saved_candidate,false);assert.equal(failed.rows.length,2);
  assert.deepEqual(failed.rows.map(r=>r.before.frozen_edges),[27741,27366]);
  for (const r of failed.rows) {
    assert.equal(r.structural_guard,true);assert.equal(r.same_original_curvature_guard,false);
    assert.equal(r.all_original_XZ_exact,true);assert.equal(r.all_nonpoint_values_types_exact,true);
    assert.equal(r.native_float32_y_mismatches,0);assert(r.maximum_cumulative_m<0.006);
    assert.equal(r.protected_front_hands_outside_and_boundary_exact,true);
    for (const key of ['vertices','faces','nonmanifold','winding_errors','tiny_faces','long_folds'])
      assert.equal(r.before[key],r.after[key]);
  }
}
const precision=read('a325-precision.json');assert.equal(precision.source_bytes_unchanged,true);
assert.deepEqual(precision.rows.map(r=>r.actual_original_point_neighborhoods),[10218,10143]);
for (const r of precision.rows) {
  assert.deepEqual(r.quadratic_invalid_neighborhoods,[]);
  assert(r.old_graph_affine_error_max_m>0.06);assert(r.quadratic_affine_error_max_m<1e-10);
  assert.equal(r.quadratic_valid_neighborhoods,r.actual_original_point_neighborhoods);
}
const e=read('execution-record.json');
assert.equal(e.native_runs[0].observed_terminal_from_transcript.exit_code,0);
assert.equal(e.native_runs[0].full_stdout_in_record,false);
assert.deepEqual(e.native_runs.slice(1).map(r=>r.chunks.at(-1).exit_code),[1,1,0,1]);
assert(e.native_runs.every(r=>r.cmd.includes('--factory-startup')&&r.cmd.includes('--disable-autoexec')));
for(const run of e.pure_runs)assert.equal(run.chunks.at(-1).exit_code,0);
assert.deepEqual(e.pure_runs.map(r=>r.tests),[5,11]);
assert.equal(e.static.python_files,9);assert.equal(e.static.final_lint.exit_code,0);
assert.equal(e.static.final_format.exit_code,0);assert.equal(e.frontend.tests,211);
assert.equal(e.frontend.test_runs.at(-1).exit_code,0);
for(const key of ['biome','typecheck','build'])assert.equal(e.frontend[key].at(-1).exit_code,0);
assert.equal(e.actual_viewed_files.length,4);for(const file of e.actual_viewed_files)assert(fs.existsSync(path.join(root,file)));
for (const key of ['saved_new_artist_models','saved_new_GLB','saved_new_PNG','human_camera_calls'])assert.equal(e[key],0);
for (const key of ['independent_new_source_reopen_executed','new_source_deformation_executed',
  'new_GLB_deformation_executed','new_browser_executed','human_motion_QA','appearance_approved',
  'production_adopted','PR9_merged','stages_1_to_6_complete','operational_db_secret_deployment_release_changed'])
  assert.equal(e[key],false);
const runtime=read('runtime-version-record.json');assert.equal(runtime.chunks.at(-1).exit_code,0);
assert.equal(runtime.numpy,'2.3.4');assert.equal(runtime.scipy,'1.16.2');assert.equal(runtime.new_install,false);
console.log(JSON.stringify({exact_copies:23,protected_prior_unchanged:1264,native_read_only_rays:420,
  new_artist_models:0,new_GLB:0,new_PNG:0,failed_native_studies_preserved:3,
  actual_pure_tests:11,frontend_tests:211,new_browser_executed:false,appearance_approved:false,PR9_merged:false}));
