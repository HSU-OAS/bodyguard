// FR-A-02/03/08: factual evidence integrity, not appearance/medical/release approval.
const a=require('node:assert/strict'),f=require('node:fs'),p=require('node:path'),c=require('node:crypto'),z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..'),sha=b=>c.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json'))),text={};
a.equal(manifest.copies.length,104);a.deepEqual(manifest.counts,{gzip:21,PNG:78,blend:3,GLB:2});
a.equal(manifest.protected_prior.length,868);a.equal(manifest.appearance_approved,false);a.equal(manifest.production_adopted,false);
for(const e of manifest.copies) {
 const b=f.readFileSync(p.join(__dirname,e.file));a.equal(b.length,e.bytes);a.equal(sha(b),e.sha256);
 const raw=e.gzip?z.gunzipSync(b):b;a.equal(sha(raw),e.decoded_sha256);
 if(e.gzip) {text[e.file]=raw.toString();a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(text[e.file]));}
}
for(const e of manifest.protected_prior)a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=name=>JSON.parse(text[name+'.txt.gz']);
const contract=json('contract.json');a.equal(contract.phase_1.use_x,false);a.equal(contract.phase_1.use_y,true);a.equal(contract.phase_1.use_z,false);
a.equal(contract.phase_2.unchanged_cumulative_original_guard_m,.006);a.equal(contract.phase_2.budget_radius_m,.0059);
const native=json('a290-profile-report.json');a.equal(native.saved_candidate,true);a.equal(native.rows.length,4);
a(native.rows.every(v=>v.existing_6mm_guard_and_geometry_passed&&v.all_original_xz_exact&&v.all_boundary_points_exact&&v.all_front_and_outside_support_exact&&!v.posthoc_coordinate_restoration));
a.deepEqual(native.rows.slice(2).map(v=>v.actually_changed_points),[9737,9655]);
a.deepEqual(native.rows.slice(2).map(v=>v.after.long_folds),[76,107]);
a(native.rows.every(v=>v.maximum_artist_displacement_m<.006));
a(native.rows.slice(2).every(v=>v.after.frozen_posterior_edge_angles_deg.p95>v.before.frozen_posterior_edge_angles_deg.p95));
a.equal(native.budget_plan.derived_common_strength_m,.004);a.equal(native.budget_plan.computed_before_phase_2_native_edit,true);
a.equal(sha(f.readFileSync(p.join(__dirname,'native/artist-candidate.blend'))),native.candidate_sha256);
const independent=json('a291-independent.json');a.equal(independent.passed,true);
a(independent.rows.every(v=>v.all_original_x_and_z_exact_y_only&&v.all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact&&v.all_point_ledgers_and_a239_parent_attribute_exact&&v.pose_basis_exact));
a.deepEqual(independent.rows.map(v=>v.changed_points),[9737,9655]);a.deepEqual(independent.rows.map(v=>v.preserved_original_points),[121908,120893]);
const original=p.join(root,'bodyguard/assets/blender/review/candidate-a243-a251-diagnosis/a250/artist-candidate.blend');
a.equal(sha(f.readFileSync(original)),native.source_sha256);
a(Object.values(independent.input_sha256).includes(native.candidate_sha256));a(Object.values(independent.input_sha256).includes(native.source_sha256));
for(const name of ['source-deformation-report.json','roundtrip-deformation-report.json']) {
 const q=json(name);a.equal(q.passed,true);a.equal(q.checks.length,121);a.equal(q.checks.filter(v=>v.pose!=='neutral').length,118);a.equal(q.rendered,true);a.deepEqual(q.failures,[]);
}
const exported=json('roundtrip-report.json');a.equal(exported.ratio,1);a(exported.checks.every(v=>v.meshes===1&&v.images===0&&v.animations===0));
const execution=json('execution-record.json');a.equal(execution.runs.length,6);a(execution.runs.every(r=>r.chunks.at(-1).exit_code===0));a.equal(execution.browser.chunks.at(-1).exit_code,0);
for(const r of [...execution.runs,execution.browser]) {a(r.full_stdout_preserved);a(r.chunks.every(v=>!v.output.includes('Warning: truncated output')));}
a.equal(execution.source_and_roundtrip_full_34_renders_executed,true);a.equal(execution.camera_calls,0);a.equal(execution.appearance_approved,false);a.equal(execution.production_adopted,false);a.equal(execution.PR9_merged,false);a.equal(execution.stage2_complete,false);
a.equal(execution.static_final.chunks.at(-1).exit_code,0);a.equal(execution.static_final.python_helpers,6);a.equal(execution.static_final.pure_math_tests,8);
const browser=json('browser-report.json');a.equal(browser.stats.expected,3);a.equal(browser.stats.unexpected,0);a.equal(browser.stats.skipped,0);a.equal(browser.stats.flaky,0);
const walk=s=>s.flatMap(v=>[...(v.specs||[]),...walk(v.suites||[])]);
const cases=walk(browser.suites).flatMap(s=>s.tests.flatMap(t=>t.results));a.equal(cases.length,3);a(cases.every(v=>v.status==='passed'));
let assets=0,renderings=0;
for(const entry of cases.flatMap(v=>v.attachments).filter(v=>v.body)) {
 const value=JSON.parse(Buffer.from(entry.body,'base64').toString());
 if(entry.name.endsWith('-native-asset')) {const raw=f.readFileSync(p.join(__dirname,'export',value.filename));a.equal(value.bytes,raw.length);a.equal(value.sha256,sha(raw));a.equal(value.eightWeightPrimitives,1);assets++;}
 else if(entry.name.endsWith('-technical-render')) {a.equal(value.samples,180);a.equal(value.skeletons_independent,true);a.equal(value.eight_weight_meshes,2);a.equal(value.static_angle_max,0);a(value.moving_angle_max>0);renderings++;}
}
a.equal(assets,6);a.equal(renderings,2);
console.log(JSON.stringify({exact_copies:104,gzip:21,PNG:78,blend:3,GLB:2,protected_prior_unchanged:868,actual_native_runs:6,source_technical_poses:118,roundtrip_technical_poses:118,source_and_roundtrip_actual_renders:68,actual_Chrome_passed:3,curvature_regression_preserved:true,appearance_approved:false}));
