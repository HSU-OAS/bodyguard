// FR-A-02/03/05/06/08: verify byte lineage and actual native/browser outcomes, not adoption.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const zlib = require('node:zlib'), assert = require('node:assert/strict');
const directory = __dirname, root = path.resolve(directory, '../../../../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(directory,'copy-manifest.json')));
const read = file => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(directory,file+'.txt.gz'))));
assert.equal(manifest.copies.length,138);
assert.deepEqual(manifest.counts,{gzip:55,PNG:78,blend:3,GLB:2});
assert.equal(manifest.protected_prior.length,1123);
assert.equal(manifest.appearance_approved,false);assert.equal(manifest.production_adopted,false);
let total = 0;
for (const item of manifest.copies) {
  const bytes = fs.readFileSync(path.join(directory,item.file));
  const raw = item.gzip ? zlib.gunzipSync(bytes) : bytes;
  assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256);
  assert.equal(sha(raw),item.decoded_sha256);total += item.bytes;
  if (item.file.startsWith('production-'))
    assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender',item.file.slice(11,-7)))),item.decoded_sha256);
  if (item.file.startsWith('frontend/'))
    assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/frontend',item.file.slice(9,-7)))),item.decoded_sha256);
}
assert.equal(total,manifest.total_bytes);
for (const e of manifest.protected_prior)
  assert.equal(sha(fs.readFileSync(path.join(root,e.file))),e.sha256,e.file);
const originalSha='0e6243e64b65841510d2ed926f3bf315e3cc101dbfa57d41beafb8bcedc8a104';
const newSha='2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff';
assert.equal(sha(fs.readFileSync(path.join(root,'bodyguard/assets/blender/review/candidate-a243-a251-diagnosis/a250/artist-candidate.blend'))),originalSha);
assert.equal(sha(fs.readFileSync(path.join(directory,'native/artist-candidate.blend'))),newSha);
const differential=read('a316-differential.json'), failed=read('a317-rejected-iteration.json');
assert.equal(differential.completed,true);assert.equal(differential.exact_A315_native_rejection_reproduced,true);
assert.deepEqual(differential.rows.map(r=>r.same_original_frozen_QA_edges),[27741,27366]);
for (const r of differential.rows) {
  assert.equal(r.all_original_authored_body_and_rig_unchanged_by_diagnosis,true);
  assert.equal(r.additional_original_body_editing,false);assert.equal(r.posthoc_body_or_skin_restoration,false);
}
assert.equal(failed.saved_candidate,false);assert.equal(failed.rows.length,0);
assert.equal(failed.original_polygon_solver_results.length,1);
assert.equal(failed.original_polygon_solver_results[0].linear_solver.converged,false);
assert.equal(failed.original_polygon_solver_results[0].linear_solver.iterations,256);
assert(!manifest.copies.some(e=>e.file==='a319-reopen-report.json.txt.gz'));
const sculpt=read('a318-native-surface.json');
assert.equal(sculpt.source_sha256,originalSha);assert.equal(sculpt.candidate_sha256,newSha);
assert.equal(sculpt.saved_candidate,true);assert.equal(sculpt.appearance_approved,false);
assert.deepEqual(sculpt.rows.map(r=>r.actually_changed_points),[9698,9609]);
assert.deepEqual(sculpt.rows.map(r=>r.before.frozen_posterior_edge_angles_deg.count),[27741,27366]);
assert.deepEqual(sculpt.rows.map(r=>r.after.frozen_posterior_edge_angles_deg.p95),[3.2275002378008018,3.59941961947704]);
assert.deepEqual(sculpt.rows.map(r=>r.after.frozen_posterior_edge_angles_deg.max),[11.574485525054152,11.598168352227525]);
for (const r of sculpt.rows) {
  for (const field of ['vertices','faces','nonmanifold','winding_errors','tiny_faces','long_folds'])
    assert.equal(r.before[field],r.after[field]);
  for (const field of ['all_original_XZ_exact','all_protected_attributes_exact',
    'front_hands_outside_original_support_exact','all_boundary_points_exact',
    'existing_structural_and_6mm_guard_passed','same_original_edge_p95_and_max_not_worse',
    'strict_original_modifiers_rest_flags_and_all_nonpoint_data_exact']) assert.equal(r[field],true);
  assert.equal(r.posthoc_coordinate_or_skin_restoration,false);
  assert(r.maximum_artist_displacement_m<=0.006);
  assert.equal(r.before.frozen_posterior_edge_angles_deg.count,r.after.frozen_posterior_edge_angles_deg.count);
  for (const metric of ['p95','max'])
    assert(r.after.frozen_posterior_edge_angles_deg[metric]<=r.before.frozen_posterior_edge_angles_deg[metric]);
}
assert.deepEqual(sculpt.native_plan.same_original_positive_support_points,[9789,9693]);
for (const r of sculpt.original_polygon_solver_results) {
  assert.equal(r.original_mixed_polygon_rows_no_triangulation,true);
  assert.equal(r.body_and_rig_untouched_before_native_transfer,true);
  assert.equal(r.original_frozen_QA_region_unchanged,true);
  assert.equal(r.linear_solver.converged,true);assert.equal(r.linear_solver.ridge,0.01);
  assert.equal(r.linear_solver.relative_tolerance,1e-8);
  assert(r.linear_solver.final_relative_residual<=1e-8);
  assert.equal(r.linear_solver.same_original_normal_equation_objective,true);
  assert.equal(r.linear_solver.no_strength_or_iteration_sweep,true);
}
assert.deepEqual(sculpt.native_transfer_correspondence.map(r=>r.whole_original_point_count),[131645,130548]);
for (const r of sculpt.native_transfer_correspondence) {
  assert.equal(r.native_float32_Y_mismatches,0);assert.deepEqual(r.first_mismatch_indices,[]);
  assert.equal(r.common_budget_unchanged,true);
}
const diagnosis=read('a320-property-difference.json');
assert.equal(diagnosis.completed,true);
for (const r of diagnosis.rows) {
  assert.deepEqual(r.differing_strict_nonpoint_keys,['properties']);
  for (const key of ['raw_custom_property_types_exact','all_raw_custom_property_values_exact','every_other_strict_nonpoint_field_exact'])
    assert.equal(r[key],true);
  assert.equal(r.repr_differing_property_count,5);assert.equal(r.additional_body_editing,false);
}
const reopened=read('a321-independent-reopen.json');
assert.equal(reopened.passed,true);assert.equal(reopened.independent_saved_native_reopen,true);
assert.deepEqual(reopened.rows.map(r=>r.changed_points),[9698,9609]);
for (const r of reopened.rows) {
  for (const key of ['all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact',
    'all_original_points_outside_head_interface_artist_band_exact',
    'independent_individual_and_sum_skin_guard_passed','all_original_x_and_z_exact_y_only',
    'original_normal_y_le_zero_coordinates_exact','all_point_ledgers_and_a239_parent_attribute_exact',
    'pose_basis_exact','all_strict_original_modifiers_rest_flags_properties_and_nonpoint_data_exact'])
    assert.equal(r[key],true);
  assert.deepEqual(r.predeclared_artist_region,[0.875,0.975]);assert.equal(r.predeclared_artist_half_width_fraction,0.06);
}
for (const folder of ['source-review','roundtrip-review']) {
  const report=read(folder+'/deformation-report.json');
  assert.equal(report.passed,true);assert.equal(report.rendered,true);assert.deepEqual(report.failures,[]);
  assert.equal(report.checks.length,121);assert.equal(report.checks.filter(r=>r.pose!=='neutral').length,118);
  assert.equal(manifest.copies.filter(r=>r.file.startsWith(folder+'/')&&r.file.endsWith('.png')).length,34);
  for (const r of report.checks.filter(r=>r.pose!=='neutral')) assert(r.edge_ratio_max<3);
  assert.deepEqual(report.checks[0].garments,[]);
}
const glb=read('glb/roundtrip-report.json');
assert.equal(glb.maximum_skin_influences,8);assert.equal(glb.transforms_passed,true);
// Export-time pending flag is historical: the separate full roundtrip report supplies completed QA.
assert.equal(glb.geometry_deformation_pending,true);
assert.deepEqual(glb.checks.map(r=>r.bytes),[11638276,11541880]);
for (const r of glb.final_surface_topology) {
  assert.equal(r.zero_triangles_after,0);assert.equal(r.coordinates_skin_unrelated_triangles_exact,true);
  assert.equal(r.appearance_approved,false);
}
const browser=read('browser/summary.json'), playwright=read('browser/playwright-report.json');
assert.equal(browser.exit_code,0);assert.equal(browser.actual_Chrome,true);
assert.equal(browser.stats.expected,3);
for (const k of ['unexpected','flaky','skipped']) assert.equal(browser.stats[k],0);
assert.equal(browser.human_camera_calls,0);assert.equal(browser.default_assets_not_replaced,true);
assert.equal(browser.target_laptop_exclusive_performance,false);
function specs(suites) {
  return suites.flatMap(s=>[...(s.specs||[]),...specs(s.suites||[])]);
}
const allSpecs=specs(playwright.suites);assert.equal(allSpecs.length,3);
for (const spec of allSpecs) {
  assert.equal(spec.ok,true);
  for (const test of spec.tests) for (const result of test.results) {
    assert.equal(result.status,'passed');assert.deepEqual(result.errors,[]);
    for (const attachment of result.attachments.filter(a=>a.name.endsWith('-native-asset'))) {
      const asset=JSON.parse(Buffer.from(attachment.body,'base64'));
      assert.equal(sha(fs.readFileSync(path.join(directory,'glb',asset.filename))),asset.sha256);
      assert.equal(asset.eightWeightPrimitives,1);
    }
    for (const attachment of result.attachments.filter(a=>a.name.endsWith('-technical-render'))) {
      const render=JSON.parse(Buffer.from(attachment.body,'base64'));
      assert.equal(render.samples,180);assert.equal(render.skeletons_independent,true);
      assert.equal(render.eight_weight_meshes,2);
      assert.equal(render.static_angle_max,0);assert(render.moving_angle_max>0.2);
    }
  }
}
const execution=read('execution-record.json');
assert.deepEqual(execution.runs.map(r=>r.chunks.at(-1).exit_code),[0,1,0,1,0,0,0,0,0,0]);
for (const r of execution.runs) {
  assert.equal(r.full_stdout_preserved,true);
  assert(r.chunks.every(c=>!c.output.includes('tokens truncated')));
  if (r.id!=='a322Browser') assert(r.cmd.includes('--factory-startup')&&r.cmd.includes('--disable-autoexec'));
}
assert.equal(execution.static.python_files_present,18);assert.equal(execution.static.python_files_checked,17);
assert.equal(execution.static.pure_tests,23);assert.equal(execution.static.pure_actual_run.exit_code,0);
assert.equal(execution.static.final_lint.exit_code,0);assert.equal(execution.static.final_format.exit_code,0);
assert.equal(execution.frontend.tests,151);assert.equal(execution.frontend.chunks.at(-1).exit_code,0);
assert.equal(execution.saved_native_artist_models,1);assert.equal(execution.saved_total_blend_files,3);
assert.equal(execution.saved_GLB,2);assert.equal(execution.saved_PNG,78);assert.equal(execution.camera_calls,0);
assert.equal(execution.actual_viewed_files.length,24);
assert.equal(execution.scoped_runtime.project_or_global_dependency_changed,false);
for (const key of ['new_source_reopen_QA','new_source_deformation_QA','new_GLB_QA','new_browser_QA']) assert.equal(execution[key],true);
for (const key of ['target_laptop_exclusive_performance','actual_human_motion_QA',
  'human_validation_approval_received','coaching_examples_or_user_retargeting_validated',
  'appearance_approved','production_adopted','PR9_merged','stage2_complete','stages_1_to_6_complete',
  'operational_db_or_secret_or_deployment_or_release_changed']) assert.equal(execution[key],false);
console.log(JSON.stringify({exact_copies:138,protected_prior_unchanged:1123,
  native_artist_models:1,source_poses:118,roundtrip_poses:118,actual_Chrome_passed:3,
  actual_viewed_images:24,PNG:78,appearance_approved:false,PR9_merged:false}));
