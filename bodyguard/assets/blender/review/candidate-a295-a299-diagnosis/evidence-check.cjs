// FR-A-02/03/08: preserve real rejection and diagnosis, not appearance approval.
const a=require('node:assert/strict'),f=require('node:fs'),p=require('node:path'),c=require('node:crypto'),z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..'),sha=b=>c.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json'))),text={};
a.equal(m.copies.length,24);a.equal(m.protected_prior.length,991);a.deepEqual(m.counts,{gzip:24,PNG:0,blend:0,GLB:0});
a.equal(m.appearance_approved,false);a.equal(m.production_adopted,false);
for(const e of m.copies){
 const b=f.readFileSync(p.join(__dirname,e.file));a.equal(b.length,e.bytes);a.equal(sha(b),e.sha256);
 const raw=z.gunzipSync(b);a.equal(sha(raw),e.decoded_sha256);text[e.file]=raw.toString();
 a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(text[e.file]));
}
for(const e of m.protected_prior)a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=n=>JSON.parse(text[n+'.txt.gz']);
const local=json('a295-localization.json');a.equal(local.completed,true);a.equal(local.rows.length,2);
a.deepEqual(local.rows.map(r=>r.same_original_edges),[27741,27366]);a.deepEqual(local.rows.map(r=>r.actual_rays),[1818,1818]);a(local.rows.every(r=>r.misses===0&&r.diagnosis_body_and_rig_unchanged));
a.equal(local.expected_rejection_reproduced,'Local sculpt worsened original fixed-edge p95 or maximum; no save or dependent QA');
const native=json('a296-rejected-profile.json'),reproduced=json('a298-reproduced-a296.json'),conditioned=json('a299-rejected-profile.json');
for(const q of [native,reproduced,conditioned]){
 a.equal(q.saved_candidate,false);a.equal(q.rows.length,2);a.equal(q.profile_field_plan.unchanged_final_guard_m,.006);
 a(q.rows.every(r=>r.all_original_xz_exact&&r.all_front_and_outside_support_exact&&r.all_boundary_points_exact&&!r.posthoc_coordinate_restoration));
 a.equal(q.appearance_approved,false);a.equal(q.full_deformation_qa,false);a.equal(q.GLB_qa,false);a.equal(q.browser_qa,false);
}
a.deepEqual(native.rows,reproduced.rows);a.deepEqual(native.profile_field_plan,reproduced.profile_field_plan);
a.deepEqual(native.rows.map(r=>r.existing_6mm_guard_and_geometry_passed),[true,false]);a.deepEqual(native.rows.map(r=>r.after.long_folds),[76,141]);
a.deepEqual(conditioned.rows.map(r=>r.existing_6mm_guard_and_geometry_passed),[true,true]);a.deepEqual(conditioned.rows.map(r=>r.after.long_folds),[76,107]);
a.deepEqual(conditioned.rows.map(r=>r.same_original_edge_p95_and_max_not_worse),[false,false]);
a.equal(conditioned.profile_field_plan.projection_normal_y_min,.75);a.equal(conditioned.profile_field_plan.physical_valid_domain_taper_m,.008);a.equal(conditioned.profile_field_plan.QA_original_region_unchanged,true);
a(conditioned.profile_field_plan.sampling.every(r=>r.misses===0&&r.unmatched_original_surface_points===0&&r.valid_domain_boundary_delta_exact_zero));
const boundary=json('a298-field-boundary.json');a.equal(boundary.completed,true);a.equal(boundary.expected_rejection_reproduced,'Original guard failure');a.deepEqual(boundary.rows.map(r=>r.worst_40_field_boundary_edges),[4,9]);
a(boundary.rows.every(r=>r.worst_increased_edges.length===40&&r.diagnosis_body_and_rig_unchanged));
const rays=q=>q.profile_field_plan.sampling.reduce((n,r)=>n+r.actual_rays,0);
a.equal(rays(native),154722);a.equal(rays(reproduced),154722);a.equal(rays(conditioned),42024);
const execution=json('execution-record.json');a.equal(execution.runs.length,4);a.deepEqual(execution.runs.map(r=>r.chunks.at(-1).exit_code),[0,1,0,1]);
for(const r of execution.runs){a(r.full_stdout_preserved);a(r.chunks.every(v=>!v.output.includes('Warning: truncated output')));}
a.equal(execution.static.lint.exit_code,0);a.equal(execution.static.format.exit_code,0);a.equal(execution.static.pure_math_tests.exit_code,0);a.equal(execution.static.pure_math_test_count,8);a.equal(execution.static.python_files_checked,10);
for(const k of ['saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(execution[k],0);
for(const k of ['appearance_approved','production_adopted','PR9_merged','stage2_complete','stages_1_to_6_complete'])a.equal(execution[k],false);
a(execution.prepared_not_executed.includes('test_saved_native_profile_field.py (A297)'));
console.log(JSON.stringify({exact_copies:24,protected_prior_unchanged:991,actual_native_exit_codes:[0,1,0,1],actual_BVH_rays_including_exact_reproduction:355104,new_models:0,new_GLB:0,new_PNG:0,real_rejections_preserved:true,appearance_approved:false}));
