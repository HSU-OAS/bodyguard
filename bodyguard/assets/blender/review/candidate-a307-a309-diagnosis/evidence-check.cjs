// FR-A-02/03/08: actual scaled authoring is not appearance or downstream QA approval.
const a=require('node:assert/strict'),f=require('node:fs'),p=require('node:path'),c=require('node:crypto'),z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..'),sha=b=>c.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json'))),texts={};
a.equal(m.copies.length,16);a.equal(m.protected_prior.length,1069);a.deepEqual(m.counts,{gzip:16,PNG:0,blend:0,GLB:0});
a.equal(m.appearance_approved,false);a.equal(m.production_adopted,false);
for(const e of m.copies){const b=f.readFileSync(p.join(__dirname,e.file));a.equal(b.length,e.bytes);a.equal(sha(b),e.sha256);
  const raw=z.gunzipSync(b);a.equal(sha(raw),e.decoded_sha256);texts[e.file]=raw.toString();
  a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(texts[e.file]));}
for(const e of m.protected_prior)a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=name=>JSON.parse(texts[name+'.txt.gz']);
const unit=json('a307-rejected-unit.json');a.equal(unit.saved_candidate,false);
a.equal(unit.native_plan.temporary_original_copy_binary_unit_scale,128);a.equal(unit.native_plan.lambda_factor,.05);a.equal(unit.native_plan.iterations,12);
a.equal(unit.native_plan.volume_preserve,false);a.equal(unit.precomputed_common_budget.common_factor,1);
a.deepEqual(unit.native_unit_copy_results.map(r=>r.native_actually_changed_points),[9609,9524]);
for(const r of unit.native_unit_copy_results){a(r.binary_encoded_coordinates_exact&&r.native_all_XZ_exact&&r.native_zero_support_exact&&r.native_all_attributes_exact);
  a.equal(r.native_zero_support_changed_points,0);a(r.body_unmodified_before_transfer&&r.native_copy_guard_passed&&!r.posthoc_coordinate_or_skin_restoration);}
a.deepEqual(unit.rows.map(r=>r.actually_changed_points),[9609,9524]);a.deepEqual(unit.rows.map(r=>r.before.frozen_posterior_edge_angles_deg.count),[27741,27366]);
for(const r of unit.rows){a(r.existing_structural_and_6mm_guard_passed&&r.all_original_XZ_exact&&r.all_protected_attributes_exact&&r.front_hands_outside_original_support_exact&&r.all_boundary_points_exact);
  a.equal(r.same_original_edge_p95_and_max_not_worse,false);a.equal(r.posthoc_coordinate_or_skin_restoration,false);
  a(r.after.frozen_posterior_edge_angles_deg.p95>r.before.frozen_posterior_edge_angles_deg.p95);
  a(r.after.frozen_posterior_edge_angles_deg.max<r.before.frozen_posterior_edge_angles_deg.max);
  a(r.maximum_artist_displacement_m>0&&r.maximum_artist_displacement_m<.006);}
a.deepEqual(unit.rows.map(r=>r.after.long_folds),[76,107]);
const triangle=json('a308-rejected-triangulation.json'),replay=json('a309-reproduced-a308.json');a.deepEqual(triangle,replay);
a.equal(triangle.saved_candidate,false);a.deepEqual(triangle.rows,[]);a.equal(Object.hasOwn(triangle,'native_unit_copy_results'),false);
a.equal(triangle.native_plan.temporary_copy_fixed_triangulation_only,true);a.equal(triangle.native_plan.original_body_faces_unchanged,true);
const lineage=json('a309-lineage.json');a.equal(lineage.completed,true);
const first=lineage.first_A308_failure_exactly_reproduced;a.equal(first.expected_n_minus_2_triangles,263286);a.equal(first.actual_native_triangles,263280);
a(first.copy_points_skin_rig_exact&&first.original_body_unchanged&&first.native_laplacian_and_original_transfer_not_executed);
a.deepEqual(lineage.rows.map(r=>r.original_faces),[181201,179438]);
a.deepEqual(lineage.rows.map(r=>r.expected_n_minus_2_triangles),[263286,261092]);
a.deepEqual(lineage.rows.map(r=>r.actual_native_triangles),[263280,261075]);
a.deepEqual(lineage.rows.map(r=>r.exceptional_original_faces.length),[6,17]);
a.deepEqual(lineage.rows.map(r=>r.exceptional_original_faces.filter(e=>e.incident_original_selected_points>0).length),[0,4]);
for(const r of lineage.rows){a(r.all_temporary_point_skin_rig_attributes_exact&&r.all_actual_faces_triangles_and_lineage_in_range&&r.original_body_unchanged&&r.original_laplacian_and_transfer_not_executed);
  for(const e of r.exceptional_original_faces){a.equal(e.original_vertices.length,4);a.equal(e.unique_vertex_indices,4);a.equal(e.expected_n_minus_2,2);a.equal(e.actual_native_child_triangles,1);}}
for(const [file,expected] of Object.entries(lineage.input_sha256))if(file.startsWith(root+'/'))a.equal(sha(f.readFileSync(file)),expected,file);
const execution=json('execution-record.json');a.deepEqual(execution.runs.map(r=>r.chunks.at(-1).exit_code),[1,1,0]);
for(const r of execution.runs){a(r.full_stdout_preserved);a(r.chunks.every(v=>!v.output.includes('Warning: truncated output')));}
a.equal(execution.actual_native_scaled_authoring,true);a.equal(execution.original_body_native_Y_transfer_executed_A307,true);
a.equal(execution.actual_native_laplacian_in_triangle_copy_A308_A309,false);a.equal(execution.static.actual_python_files_checked,5);
a.equal(execution.static.final_check.exit_code,0);a.equal(execution.static.pure_math_tests_reexecuted,false);
for(const k of ['actual_BVH_rays','saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(execution[k],0);
for(const k of ['new_source_reopen_QA','new_source_deformation_QA','new_GLB_QA','new_browser_QA','appearance_approved','production_adopted','PR9_merged','stage2_complete','stages_1_to_6_complete'])a.equal(execution[k],false);
for(const k of ['saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(lineage[k],0);
a.equal(lineage.actual_native_fairing_in_triangle_units,false);
console.log(JSON.stringify({exact_copies:16,protected_prior_unchanged:1069,actual_native_exit_codes:[1,1,0],actual_scaled_authoring:true,
  max_improved_p95_worsened_not_saved:true,temporary_triangle_count_failure_before_fairing:true,female_selected_exceptional_faces:4,
  new_models:0,new_GLB:0,new_PNG:0,new_browser_QA:false,appearance_approved:false}));
