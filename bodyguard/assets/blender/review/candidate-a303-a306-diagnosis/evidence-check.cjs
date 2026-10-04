// FR-A-02/03/08: distinguish real failures, no-op and hypothetical solver preflight.
const a=require('node:assert/strict'),f=require('node:fs'),p=require('node:path'),c=require('node:crypto'),z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..'),sha=b=>c.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json'))),texts={};
a.equal(m.copies.length,24);a.equal(m.protected_prior.length,1042);a.deepEqual(m.counts,{gzip:24,PNG:0,blend:0,GLB:0});
a.equal(m.appearance_approved,false);a.equal(m.production_adopted,false);
for(const e of m.copies){
  const b=f.readFileSync(p.join(__dirname,e.file));a.equal(b.length,e.bytes);a.equal(sha(b),e.sha256);
  const raw=z.gunzipSync(b);a.equal(sha(raw),e.decoded_sha256);texts[e.file]=raw.toString();
  a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(texts[e.file]));
}
for(const e of m.protected_prior)a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=name=>JSON.parse(texts[name+'.txt.gz']);
const previous=p.join(root,'bodyguard/assets/blender/review/candidate-a300-a302-diagnosis');
const a302=JSON.parse(z.gunzipSync(f.readFileSync(p.join(previous,'a302-rejected-profile.json.txt.gz'))));
const replay=json('a303-reproduced-a302.json');a.deepEqual(replay.rows,a302.rows);a.deepEqual(replay.profile_field_plan,a302.profile_field_plan);
a.equal(sha(z.gunzipSync(f.readFileSync(p.join(previous,'refine_native_coherent_field.py.txt.gz')))),sha(Buffer.from(texts['reproduced-a302-helper.py.txt.gz'])));
const boundary=json('a303-boundary.json');a.equal(boundary.completed,true);a.equal(boundary.exact_A302_rejection_reproduced,true);
a.equal(boundary.actual_BVH_rays_from_reproduction,42024);a.deepEqual(boundary.rows.map(r=>r.same_original_edges),[27741,27366]);
a.deepEqual(boundary.rows.map(r=>r.highest40_incident_triangles_with_boundary_corner),[61,74]);
a(boundary.rows.every(r=>r.highest_40_actual_angles_with_boundary_details.length===40&&r.all_analysis_body_rig_ledger_properties_unchanged));
const conditioned=json('a304-rejected-profile.json');a.equal(conditioned.saved_candidate,false);
a.deepEqual(conditioned.rows.map(r=>r.existing_6mm_guard_and_geometry_passed),[true,true]);
a.deepEqual(conditioned.rows.map(r=>r.same_original_edge_p95_and_max_not_worse),[false,false]);
a.deepEqual(conditioned.rows.map(r=>r.after.long_folds),[76,107]);
for(const r of conditioned.rows){a(r.all_original_xz_exact&&r.all_boundary_points_exact&&r.all_front_and_outside_support_exact&&!r.posthoc_coordinate_restoration);
  a(r.after.frozen_posterior_edge_angles_deg.max>r.before.frozen_posterior_edge_angles_deg.max);}
for(const r of conditioned.profile_field_plan.native_scalar_coherence){a.equal(r.native_factor,.5);a.equal(r.native_iterations,32);
  a.equal(r.post_fairing_boundary_width_m,.008);a.equal(r.compact_weight_quintic_C2_only_not_whole_surface,true);}
const noop=json('a305-rejected-noop.json'),noopReplay=json('a306-reproduced-a305.json');a.deepEqual(noop,noopReplay);
a.equal(noop.saved_candidate,false);a.equal(noop.native_plan.volume_preserve,false);a.equal(noop.native_plan.use_y,true);
a.equal(noop.native_plan.use_x,false);a.equal(noop.native_plan.use_z,false);a.equal(noop.native_plan.lambda_factor,.05);a.equal(noop.native_plan.iterations,12);
for(const r of noop.rows){a.equal(r.actually_changed_points,0);a.equal(r.maximum_artist_displacement_m,0);
  a(r.all_original_XZ_exact&&r.all_protected_attributes_exact&&r.front_hands_outside_original_support_exact&&r.all_boundary_points_exact);
  a.equal(r.existing_structural_and_6mm_guard_passed,false);a.equal(r.same_original_edge_p95_and_max_not_worse,true);a.deepEqual(r.before,r.after);}
const cutoff=json('a306-cutoff.json');a.equal(cutoff.completed,true);a.equal(cutoff.expected_no_op_rejection_reproduced,true);
a.equal(cutoff.actual_scaled_authoring_executed,false);a.equal(cutoff.official_source_read_from_preserved_prior_evidence,true);
a.equal(cutoff.remote_web_open_failed_cache_miss_not_verification,true);
a.deepEqual(cutoff.rows.map(r=>r.original_cutoff.positive_mask_frozen_points),[9789,9693]);
a.deepEqual(cutoff.rows.map(r=>r.hypothetical_binary_units_cutoff.positive_mask_frozen_points),[0,0]);
for(const r of cutoff.rows){a.equal(r.original_cutoff.positive_mask_points,r.original_cutoff.positive_mask_frozen_points);
  a(r.body_rig_original_points_attributes_unchanged&&r.no_op_exactly_reproduced&&r.scaled_native_authoring_QA_not_performed);}
for(const [file,expected] of Object.entries(cutoff.input_sha256))if(file.startsWith(root+'/'))a.equal(sha(f.readFileSync(file)),expected,file);
for(const q of [boundary,cutoff]){for(const k of ['saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(q[k],0);
  for(const k of ['appearance_approved','new_deformation_QA','new_browser_QA'])a.equal(q[k],false);}
const execution=json('execution-record.json');a.deepEqual(execution.runs.map(r=>r.chunks.at(-1).exit_code),[0,1,1,0]);
for(const r of execution.runs){a.equal(r.full_stdout_preserved,true);a(r.chunks.every(v=>!v.output.includes('Warning: truncated output')));}
a.equal(execution.static.python_files_checked,9);a.equal(execution.static.lint_and_format_and_pure_math.exit_code,0);a.equal(execution.static.pure_math_tests,7);
a.equal(execution.actual_BVH_rays_including_reproduction,84048);
for(const k of ['saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(execution[k],0);
for(const k of ['actual_scaled_authoring_executed','new_source_deformation_QA','new_GLB_QA','new_browser_QA','appearance_approved',
  'production_adopted','PR9_merged','stage2_complete','stages_1_to_6_complete'])a.equal(execution[k],false);
console.log(JSON.stringify({exact_copies:24,protected_prior_unchanged:1042,actual_native_exit_codes:[0,1,1,0],actual_BVH_rays_including_reproduction:84048,
  actual_scaled_authoring_executed:false,new_models:0,new_GLB:0,new_PNG:0,real_rejections_noop_and_hypothetical_preflight_separated:true,appearance_approved:false}));
