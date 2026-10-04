// Verify immutable evidence. No camera/model edits or product adoption.
'use strict';
const f=require('node:fs'),p=require('node:path'),c=require('node:crypto'),z=require('node:zlib'),a=require('node:assert/strict');
const dir=__dirname,root=p.resolve(dir,'../../../../..');
const sha=b=>c.createHash('sha256').update(b).digest('hex');
const json=name=>JSON.parse(z.gunzipSync(f.readFileSync(p.join(dir,name+'.txt.gz'))));
const manifest=JSON.parse(f.readFileSync(p.join(dir,'copy-manifest.json')));
a.equal(manifest.copies.length,28);a.equal(manifest.protected_prior.length,1090);
a.deepEqual(manifest.counts,{gzip:28,PNG:0,blend:0,GLB:0});
a.equal(manifest.appearance_approved,false);a.equal(manifest.production_adopted,false);
for(const item of manifest.copies){
  const bytes=f.readFileSync(p.join(dir,item.file)),raw=z.gunzipSync(bytes);
  a.equal(bytes.length,item.bytes);a.equal(sha(bytes),item.sha256);a.equal(sha(raw),item.decoded_sha256);
  if(item.file.startsWith('production-')){
    const source=p.join(root,'bodyguard/assets/blender',item.file.slice(11,-7));
    a.equal(sha(f.readFileSync(source)),item.decoded_sha256);
  }
}
for(const e of manifest.protected_prior)a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256);
const source=p.join(root,'bodyguard/assets/blender/review/candidate-a243-a251-diagnosis/a250/artist-candidate.blend');
a.equal(sha(f.readFileSync(source)),'0e6243e64b65841510d2ed926f3bf315e3cc101dbfa57d41beafb8bcedc8a104');
const corner=json('a310-corners.json'),beauty=json('a311-rejected-beauty.json'),lineage=json('a312-lineage.json');
const old=json('a313-rejected-bmesh.json'),replay=json('a314-reproduced-a313.json'),edges=json('a314-edges.json'),fixed=json('a315-rejected-correct-budget.json');
a.equal(corner.completed,true);a.deepEqual(corner.rows.map(r=>r.exceptional_original_faces),[6,17]);
a.deepEqual(corner.rows.map(r=>r.native_BMesh_returned_faces),[12,34]);
for(const r of corner.rows)a.equal(r.all_original_body_rig_properties_unchanged,true);
const selected=corner.rows[1].details.filter(r=>r.incident_selected_points>0);
a.deepEqual(selected.map(r=>r.original_face),[54315,56678,56704,176918]);
for(const r of selected){
  a.equal(r.exact_coordinate_unique_points,4);
  a(r.all_six_pair_distances.every(e=>!e.exact_equal_coordinates));
  a.equal(r.native_modifier_children.length,1);a.equal(r.native_BMesh_children.length,2);
  a.equal(r.omitted_original_point_indices_by_modifier.length,1);
  a(r.alternate_diagonal_1_3.every(t=>t.oriented_double_area_against_original_face>0));
}
a.equal(selected.filter(r=>r.fixed_diagonal_0_2.some(t=>t.oriented_double_area_against_original_face<0)).length,3);
a.equal(beauty.rows.length,0);a.equal(beauty.native_unit_copy_results.length,1);
a.equal(beauty.native_unit_copy_results[0].gender,'Male');
a.equal(beauty.native_unit_copy_results[0].temporary_geometry_aware_triangles,263286);
a.equal(beauty.native_unit_copy_results[0].native_copy_guard_passed,true);
a.equal(lineage.completed,true);
a.deepEqual(lineage.rows.map(r=>r.same_original_selected_points),[9789,9693]);
a.deepEqual(lineage.rows.map(r=>r.same_original_frozen_QA_edges),[27741,27366]);
a.deepEqual(lineage.rows.map(r=>r.actual_native_BEAUTY_modifier_triangles),[263286,261091]);
a.deepEqual(lineage.rows.map(r=>r.actual_native_BMesh_BEAUTY_triangles),[263286,261092]);
a.deepEqual(lineage.rows.map(r=>r.BMesh_normalized_individual_sum_vertices),[131645,130548]);
for(const r of lineage.rows)for(const key of ['BMesh_preserved_complete_triangle_count','BMesh_triangles_only','BMesh_all_raw_coefficients_including_zero_exact','BMesh_all_original_points_exact','original_body_rig_world_materials_properties_unchanged'])a.equal(r[key],true);
const exception=lineage.rows[1].modifier_exceptional_original_faces;
a.equal(exception.length,1);a.equal(exception[0].original_face,75772);
a.equal(exception[0].incident_original_selected_points,0);a.equal(exception[0].actual_children,1);
a.deepEqual(replay,old);a.equal(edges.completed,true);a.equal(edges.exact_A313_rejection_reproduced,true);
a.deepEqual(edges.rows.map(r=>r.same_original_QA_edges),[27741,27366]);
a.deepEqual(edges.rows.map(r=>r.highest20_edges_incident_original_boundary_count),[0,0]);
for(const r of edges.rows){a.equal(r.additional_original_body_or_rig_editing,false);a.equal(r.posthoc_body_coordinate_restoration,false);a.equal(r.highest20_actual_angles.length,20);}
const worst=edges.rows[0].highest20_actual_angles[0];
a.deepEqual(worst.original_edge_indices,[39843,39850]);
a.equal(worst.source_angle_deg,17.68775669544121);
a.equal(worst.actual_authored_angle_deg,17.913923041880548);
a(worst.incident_point_fields.every(r=>!r.original_support_boundary_point));
const wrong=edges.rows[1].highest20_actual_angles[0].incident_point_fields.find(r=>r.index===48209);
a.equal(wrong.actual_Y_delta_m,0.00003213435411453247);
a.equal(wrong.native_field_delta_m,0.000017843209207057953);
a.notEqual(wrong.actual_Y_delta_m,wrong.native_field_delta_m);
a.deepEqual(old.rows.map(r=>r.same_original_edge_p95_and_max_not_worse),[false,true]);
a.deepEqual(fixed.rows.map(r=>r.same_original_edge_p95_and_max_not_worse),[false,false]);
a.deepEqual(fixed.native_unit_copy_results,old.native_unit_copy_results);
a.equal(fixed.precomputed_common_budget.immutable_across_gender_measurements,true);
a.equal(fixed.precomputed_common_budget.declared_before_body_native_edit,true);
a.equal(fixed.precomputed_common_budget.native_float32_expected_Y_required_each_point,true);
a.equal(fixed.precomputed_common_budget.no_strength_or_iteration_sweep,true);
a.equal(fixed.precomputed_common_budget.maximum_unscaled_Y_displacement_m,0.00006616325117647648);
a.deepEqual(fixed.native_transfer_correspondence.map(r=>r.whole_original_point_count),[131645,130548]);
for(const r of fixed.native_transfer_correspondence){a.equal(r.native_float32_Y_mismatches,0);a.deepEqual(r.first_mismatch_indices,[]);a.equal(r.common_budget_unchanged,true);}
for(const report of [beauty,old,replay,fixed]){
  for(const key of ['saved_candidate','appearance_approved','full_deformation_qa','GLB_qa','browser_qa'])a.equal(report[key],false);
  a.equal(report.camera_calls,0);
}
for(const report of [old,replay,fixed])for(const r of report.rows){
  for(const key of ['all_original_XZ_exact','all_protected_attributes_exact','front_hands_outside_original_support_exact','all_boundary_points_exact','existing_structural_and_6mm_guard_passed','strict_original_modifiers_rest_flags_and_all_nonpoint_data_exact'])a.equal(r[key],true);
  a.equal(r.posthoc_coordinate_or_skin_restoration,false);a.equal(r.appearance_approved,false);
  for(const key of ['vertices','faces','nonmanifold','winding_errors','tiny_faces','long_folds'])a.equal(r.before[key],r.after[key]);
  a.equal(r.before.frozen_posterior_edge_angles_deg.count,r.after.frozen_posterior_edge_angles_deg.count);
}
a.deepEqual(fixed.rows.map(r=>r.actually_changed_points),[9393,9296]);
a.equal(fixed.rows[0].after.frozen_posterior_edge_angles_deg.max,17.913923041880548);
a.equal(fixed.rows[1].after.frozen_posterior_edge_angles_deg.p95,4.299139629659466);
a.equal(fixed.rows[1].maximum_artist_displacement_m,fixed.native_unit_copy_results[1].native_decoded_max_Y_displacement_m);
a.notEqual(old.rows[1].maximum_artist_displacement_m,old.native_unit_copy_results[1].native_decoded_max_Y_displacement_m);
const execution=json('execution-record.json');
a.deepEqual(execution.runs.map(r=>r.chunks.at(-1).exit_code),[0,1,0,1,0,1]);
for(const r of execution.runs){a.equal(r.full_stdout_preserved,true);a(r.cmd.includes('--disable-autoexec'));a(r.cmd.includes('--factory-startup'));a(r.chunks.every(ch=>!ch.output.includes('tokens truncated')));}
a.equal(execution.static.python_files_checked,11);a.equal(execution.static.tests,7);a.equal(execution.static.actual_run.exit_code,0);
a.equal(execution.A310_direct_BMesh_raw_skin_not_measured_limitation,true);
a.equal(execution.A312_direct_BMesh_raw_skin_verified,true);
a.equal(execution.A315_correspondence_vertices,262193);
for(const key of ['actual_BVH_rays','saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(execution[key],0);
for(const key of ['new_source_reopen_QA','new_source_deformation_QA','new_GLB_QA','new_browser_QA','human_validation_approval_received','appearance_approved','production_adopted','PR9_merged','stage2_complete','stages_1_to_6_complete'])a.equal(execution[key],false);
a.equal(execution.human_validation_request_sent,true);
console.log(JSON.stringify({exact_gzip_copies:28,protected_prior_unchanged:1090,native_exit_codes:[0,1,0,1,0,1],raw_BMesh_skin_exact:true,native_Y_correspondence_vertices:262193,native_Y_mismatches:[0,0],curvature_pass:[false,false],saved_models:0,new_QA_executed:false,appearance_approved:false}));
