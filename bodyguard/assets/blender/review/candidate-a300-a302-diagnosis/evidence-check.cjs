// FR-A-02/03/08: integrity of actual diagnostic/rejected evidence, not approval.
const a=require('node:assert/strict'), f=require('node:fs'), p=require('node:path');
const c=require('node:crypto'), z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..');
const sha=b=>c.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json'))), texts={};
a.equal(m.copies.length,21);a.equal(m.protected_prior.length,1018);
a.deepEqual(m.counts,{gzip:21,PNG:0,blend:0,GLB:0});
a.equal(m.appearance_approved,false);a.equal(m.production_adopted,false);
for(const e of m.copies){
  const bytes=f.readFileSync(p.join(__dirname,e.file));
  a.equal(bytes.length,e.bytes);a.equal(sha(bytes),e.sha256);
  const raw=z.gunzipSync(bytes);a.equal(sha(raw),e.decoded_sha256);
  texts[e.file]=raw.toString();
  a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(texts[e.file]));
}
for(const e of m.protected_prior)a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=name=>JSON.parse(texts[name+'.txt.gz']);
const previous=p.join(root,'bodyguard/assets/blender/review/candidate-a295-a299-diagnosis');
const priorReport=JSON.parse(z.gunzipSync(f.readFileSync(p.join(previous,'a299-rejected-profile.json.txt.gz'))));
a.equal(sha(z.gunzipSync(f.readFileSync(p.join(previous,'refine_native_conditioned_profile_field.py.txt.gz')))),
  sha(Buffer.from(texts['reproduced-a299-helper.py.txt.gz'])));
for(const name of ['a300-reproduced-a299.json','a301-reproduced-a299.json']){
  const q=json(name);a.deepEqual(q.rows,priorReport.rows);a.deepEqual(q.profile_field_plan,priorReport.profile_field_plan);
  a.equal(q.saved_candidate,false);
}
const tess=json('a300-tessellation.json'), field=json('a301-spatial-coherence.json');
for(const q of [tess,field]){
  a.equal(q.completed,true);a.equal(q.exact_A299_rejection_reproduced,true);
  a.equal(q.actual_BVH_rays_from_reproduction,42024);
  a.deepEqual(q.rows.map(r=>r.same_original_edges),[27741,27366]);
  for(const key of ['saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(q[key],0);
  for(const key of ['appearance_approved','new_deformation_QA','new_browser_QA'])a.equal(q[key],false);
}
for(const r of tess.rows){
  a.equal(r.worst_40_polygon_edges.length,40);
  a.equal(r.authored_body_rig_point_ledger_unchanged_during_diagnosis,true);
  a(r.native_beauty_rejected_angles_deg.max>r.native_beauty_original_angles_deg.max);
  a(r.fixed_original_triangles_rejected_angles_deg.max>r.native_beauty_original_angles_deg.max);
  a(r.fixed_original_triangles_rejected_angles_deg.p95>r.native_beauty_original_angles_deg.p95);
}
for(const r of field.rows){
  a.equal(r.worst_40_edges_with_actual_corner_deltas.length,40);
  a.equal(r.all_analysis_body_rig_ledger_properties_unchanged,true);
}
a.deepEqual(Object.keys(field.installed_native_smooth_capabilities),['use_x','use_y','use_z','factor','iterations','vertex_group']);
const trial=json('a302-rejected-profile.json');
a.equal(trial.saved_candidate,false);a.equal(trial.profile_field_plan.unchanged_final_guard_m,.006);
a.deepEqual(trial.rows.map(r=>r.after.long_folds),[76,107]);
a.deepEqual(trial.rows.map(r=>r.existing_6mm_guard_and_geometry_passed),[true,true]);
a.deepEqual(trial.rows.map(r=>r.same_original_edge_p95_and_max_not_worse),[false,false]);
for(const r of trial.rows){
  a(r.all_original_xz_exact&&r.all_boundary_points_exact&&r.all_front_and_outside_support_exact&&!r.posthoc_coordinate_restoration);
  a(r.after.frozen_posterior_edge_angles_deg.p95<r.before.frozen_posterior_edge_angles_deg.p95);
  a(r.after.frozen_posterior_edge_angles_deg.max>r.before.frozen_posterior_edge_angles_deg.max);
}
for(const r of trial.profile_field_plan.native_scalar_coherence){
  a.equal(r.native_type,'SMOOTH');a.equal(r.native_factor,.5);a.equal(r.native_iterations,32);
  a.equal(r.temporary_scalar_field_XZ_outside_boundary_exact,true);a.equal(r.body_coordinates_not_assigned,true);
}
const execution=json('execution-record.json');
a.deepEqual(execution.runs.map(r=>r.chunks.at(-1).exit_code),[0,0,1]);
for(const r of execution.runs){
  a.equal(r.full_stdout_preserved,true);a(r.chunks.every(v=>!v.output.includes('Warning: truncated output')));
}
a.equal(execution.static.python_files_checked,6);a.equal(execution.static.lint_and_format.exit_code,0);
for(const key of ['saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(execution[key],0);
for(const key of ['new_source_deformation_QA','new_GLB_QA','new_browser_QA','appearance_approved',
  'production_adopted','PR9_merged','stage2_complete','stages_1_to_6_complete'])a.equal(execution[key],false);
console.log(JSON.stringify({exact_copies:21,protected_prior_unchanged:1018,actual_native_exit_codes:[0,0,1],
  actual_BVH_rays_including_reproductions:126072,new_models:0,new_GLB:0,new_PNG:0,
  p95_partial_improvement_but_max_failure_preserved:true,appearance_approved:false}));
