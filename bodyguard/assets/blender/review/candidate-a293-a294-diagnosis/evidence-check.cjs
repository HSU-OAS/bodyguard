// Integrity and actual failed gates; not appearance, webcam or release approval.
const a=require('node:assert/strict'),f=require('node:fs'),p=require('node:path'),c=require('node:crypto'),z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..'),sha=b=>c.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json'))),text={};
a.equal(m.copies.length,13);a.deepEqual(m.counts,{gzip:13,PNG:0,blend:0,GLB:0});a.equal(m.protected_prior.length,975);
a.equal(m.appearance_approved,false);a.equal(m.production_adopted,false);
for(const e of m.copies){
 const b=f.readFileSync(p.join(__dirname,e.file));a.equal(b.length,e.bytes);a.equal(sha(b),e.sha256);
 const raw=z.gunzipSync(b);a.equal(sha(raw),e.decoded_sha256);text[e.file]=raw.toString();
 a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(text[e.file]));
}
for(const e of m.protected_prior)a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=name=>JSON.parse(text[name+'.txt.gz']),diagnostic=json('a293-distribution-report.json');
a.equal(diagnostic.completed,true);a.equal(diagnostic.rows.length,6);a.equal(diagnostic.same_original_regions_and_edges,true);
a.equal(diagnostic.all_in_memory_numeric_geometry_skin_139_groups_163_bones_pose_world_PBR_ledgers_exact,true);a.equal(diagnostic.all_input_file_SHA_unchanged,true);
a.equal(diagnostic.rows.reduce((n,r)=>n+r.actual_local_rays,0),4830);
a.equal(diagnostic.rows.reduce((n,r)=>n+r.actual_hits,0),4728);a.equal(diagnostic.rows.reduce((n,r)=>n+r.actual_misses,0),102);
for(const gender of ['Male','Female']){
 const rows=diagnostic.rows.filter(r=>r.gender===gender),expected=gender==='Male'?27741:27366;
 a.deepEqual(rows.map(r=>r.same_original_edges),[expected,expected,expected]);
 a(rows[2].same_original_region_angles_deg.p95>rows[0].same_original_region_angles_deg.p95);
 a(rows[2].original_z_bins[0].actual_angles_deg.p95>rows[0].original_z_bins[0].actual_angles_deg.p95);
}
for(const key of ['saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(diagnostic[key],0);
const trial=json('a294-profile-report.json'),contract=json('contract.json');
a.equal(contract.common_strength_m,.004);a.equal(trial.local_sculpt_plan.broad_fairing_performed,false);a.equal(trial.rows.length,2);a.equal(trial.saved_candidate,false);
for(const r of trial.rows){a(r.existing_6mm_guard_and_geometry_passed&&r.all_original_xz_exact&&r.all_boundary_points_exact&&r.all_front_and_outside_support_exact&&!r.posthoc_coordinate_restoration);a(r.maximum_artist_displacement_m<.0041);}
a.deepEqual(trial.rows.map(r=>r.actually_changed_points),[1567,1686]);a.deepEqual(trial.rows.map(r=>r.same_original_edge_p95_and_max_not_worse),[true,false]);
a(trial.rows[0].after.frozen_posterior_edge_angles_deg.p95<trial.rows[0].before.frozen_posterior_edge_angles_deg.p95);
a(trial.rows[1].after.frozen_posterior_edge_angles_deg.p95>trial.rows[1].before.frozen_posterior_edge_angles_deg.p95);
for(const key of ['appearance_approved','full_deformation_qa','GLB_qa','browser_qa'])a.equal(trial[key],false);
const execution=json('execution-record.json');a.equal(execution.runs.length,2);a.deepEqual(execution.runs.map(r=>r.chunks.at(-1).exit_code),[0,1]);
for(const r of execution.runs){a(r.full_stdout_preserved);a(r.chunks.every(v=>!v.output.includes('Warning: truncated output')));}
for(const key of ['saved_models','saved_GLB','saved_PNG','camera_calls'])a.equal(execution[key],0);
for(const key of ['appearance_approved','production_adopted','PR9_merged','stage2_complete','stages_1_to_6_complete'])a.equal(execution[key],false);
a(execution.prepared_not_executed.includes('test_saved_native_local_junction.py'));
a.equal(execution.final_static.standard_lint.exit_code,0);a.equal(execution.final_static.local_strict_lint.exit_code,0);a.equal(execution.final_static.format.exit_code,0);
a(execution.final_static.node_syntax.every(r=>r.exit_code===0));a.equal(execution.final_static.diagnostic_extra_E501.exit_code,1);
console.log(JSON.stringify({exact_copies:13,protected_prior_unchanged:975,actual_native_exit_codes:[0,1],actual_local_BVH_rays:4830,saved_models:0,saved_GLB:0,saved_PNG:0,rejection_preserved:true,appearance_approved:false}));
