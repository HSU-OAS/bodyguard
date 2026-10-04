// FR-A-02/03/08: exact evidence integrity, not appearance/medical/release approval.
const a=require('node:assert/strict'),f=require('node:fs'),p=require('node:path');
const c=require('node:crypto'),z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..');
const sha=b=>c.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json')));
a.equal(m.copies.length,57);a.deepEqual(m.counts,{gzip:34,PNG:18,blend:3,GLB:2});
a.equal(m.protected_prior.length,808);a.equal(m.appearance_approved,false);
a.equal(m.production_adopted,false);
const texts={};
for(const e of m.copies) {
  const b=f.readFileSync(p.join(__dirname,e.file));a.equal(b.length,e.bytes);
  a.equal(sha(b),e.sha256);const decoded=e.gzip?z.gunzipSync(b):b;
  a.equal(sha(decoded),e.decoded_sha256);
  if(e.gzip) {
    texts[e.file]=decoded.toString();
    a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(texts[e.file]));
  }
}
for(const e of m.protected_prior)
  a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=name=>JSON.parse(texts[name+'.txt.gz']);
const diagnostic=json('a283-posterior-report.json');
a.equal(diagnostic.completed,true);a.equal(diagnostic.renders.length,8);
a.equal(diagnostic.rows.reduce((s,v)=>s+v.actual_rays,0),486);
a.deepEqual(diagnostic.rows.map(v=>v.actual_hits),[205,198]);
a.deepEqual(diagnostic.rows.map(v=>v.actual_misses),[38,45]);
a(diagnostic.rows.every(v=>v.flat_faces===0&&!v.has_custom_normals));
a.equal(diagnostic.geometry_changes,0);a.equal(diagnostic.saved_models,0);
a.equal(diagnostic.native_geometry_skin_topology_163_rest_pose_world_point_ledgers_exact,true);
a.equal(diagnostic.input_SHA_unchanged,true);a.equal(diagnostic.lighting_only_RAM_not_saved,true);
for(const row of diagnostic.rows) {
 a(row.rays.filter(v=>v.hit).every(v=>v.reprojection_error_pixels<.05));
 a(row.materials.every(v=>v.nodes.length===2&&v.links.length===1));
}
for(const render of diagnostic.renders) {
 a.equal(render.width,600);a.equal(render.height,700);a.equal(render.actual_Cycles_render,true);
 a.equal(sha(f.readFileSync(p.join(__dirname,'diagnostic',render.file))),render.SHA256);
}
const junction=json('a284-junction-report.json');a.equal(junction.completed,true);
a.equal(junction.rows.reduce((s,v)=>s+v.actual_rays,0),610);
a.deepEqual(junction.rows.map(v=>v.actual_hits),[305,278]);
a.deepEqual(junction.rows.map(v=>v.actual_misses),[0,27]);
for(const row of junction.rows) {
 a.equal(row.native_edge_connected_components.length,1);
 a.equal(row.all_grid_hits_same_native_edge_component,true);
 a.equal(row.rays.length,305);a(row.rays.filter(v=>v.hit).every(v=>v.reprojection_error_pixels<.05&&v.component===0));
}
a.equal(junction.native_geometry_skin_topology_163_rest_pose_world_point_ledgers_exact,true);
a.equal(junction.input_SHA_unchanged,true);a.equal(junction.no_rounded_coordinate_or_nearest_weld,true);
const rejected=json('a285-profile-report.json');
a.equal(rejected.saved_candidate,false);
a.deepEqual(rejected.rows.map(v=>v.existing_6mm_guard_and_geometry_passed),[true,false]);
a(rejected.rows[1].maximum_artist_displacement_m>.006);
const r=json('a287-profile-report.json');a.equal(r.saved_candidate,true);
a(r.rows.every(v=>v.existing_6mm_guard_and_geometry_passed&&v.maximum_artist_displacement_m<.006&&v.cumulative_guard_reference_is_A250_not_A276));
a(r.rows.every(v=>v.all_original_normal_y_le_zero_points_exact&&v.outside_support_exact&&!v.posthoc_coordinate_restoration));
a.deepEqual(r.rows.map(v=>v.actually_changed_points),[9795,9689]);
a.deepEqual(r.rows.map(v=>v.actually_changed_original_normal_y_le_quarter_points),[1638,1839]);
a.deepEqual(r.rows.map(v=>v.native_added_changed_points),[1978,2263]);
a.deepEqual(r.rows.map(v=>v.after.long_folds),[76,107]);
a.equal(r.budget_plan.unchanged_final_guard_m,.006);a.equal(r.budget_plan.radius_m,.0059);
a.equal(r.budget_plan.computed_before_any_native_edit,true);
a.equal(r.budget_plan.per_point_coordinate_clamping_or_restoration,false);
a.equal(r.budget_plan.derived_common_native_strength_m,.003308148407723882);
a(r.rows.every(v=>v.all_native_added_xz_exact_and_y_positive&&v.native_added_maximum_m<=r.budget_plan.derived_common_native_strength_m+1e-7));
a.equal(sha(f.readFileSync(p.join(__dirname,'native/artist-candidate.blend'))),r.candidate_sha256);
const independent=json('a288-independent.json');a.equal(independent.passed,true);
a(independent.rows.every(v=>v.all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact&&v.all_point_ledgers_and_a239_parent_attribute_exact&&v.pose_basis_exact&&v.original_normal_y_le_zero_coordinates_exact));
a.deepEqual(independent.rows.map(v=>v.changed_points),[9795,9689]);
a.deepEqual(independent.rows.map(v=>v.preserved_original_points),[121850,120859]);
const artist=sha(f.readFileSync(p.join(__dirname,'native/artist-candidate.blend')));
const originalFile=p.join(root,'bodyguard/assets/blender/review/candidate-a243-a251-diagnosis/a250/artist-candidate.blend');
const originalSHA=sha(f.readFileSync(originalFile));
const priorSHA=sha(f.readFileSync(p.join(root,'bodyguard/assets/blender/review/candidate-a274-a278-review/native/artist-candidate.blend')));
a.equal(originalSHA,r.source_sha256);a.equal(priorSHA,r.working_source_sha256);
a.equal(diagnostic.source_sha256,priorSHA);a.equal(junction.source_sha256,priorSHA);
a.equal(rejected.source_sha256,originalSHA);a.equal(rejected.working_source_sha256,priorSHA);
a(Object.values(independent.input_sha256).includes(artist));a(Object.values(independent.input_sha256).includes(originalSHA));
for(const name of ['source-deformation-report.json','roundtrip-deformation-report.json']) {
  const q=json(name);a.equal(q.passed,true);a.equal(q.checks.length,121);
  a.equal(q.checks.filter(v=>v.pose!=='neutral').length,118);
  a.equal(q.rendered,false);a.deepEqual(q.failures,[]);
}
const exported=json('roundtrip-report.json');a.equal(exported.ratio,1);
a(exported.checks.every(v=>v.meshes===1&&v.images===0&&v.animations===0));
const x=json('execution-record.json');a.equal(x.runs.length,8);
a.deepEqual(x.runs.map(v=>v.chunks.at(-1).exit_code),[0,0,1,0,0,0,0,0]);
for(const run of [...x.runs,x.browser]) {
  a.equal(run.full_stdout_preserved,true);
  a(run.chunks.every(v=>!v.output.includes('Warning: truncated output')));
}
a.equal(x.browser.chunks.at(-1).exit_code,0);a.equal(x.A286_saved_native_test_executed,false);
a.equal(x.A285_saved_assets,0);a.equal(x.A288_uses_unchanged_A277_helper,true);
a.equal(x.static_final.chunks.at(-1).exit_code,0);
a.equal(x.static_final.python_helpers,13);a.equal(x.static_final.pure_math_tests,24);
a.equal(x.full_34_source_or_roundtrip_renders_executed,false);
a.deepEqual(x.directly_viewed_actual_images,{diagnostic:8,new_native:8,new_Chrome:2,total:18});
a.equal(x.appearance_approved,false);a.equal(x.production_adopted,false);
a.equal(x.PR9_merged,false);a.equal(x.stage2_complete,false);a.equal(x.camera_calls,0);
const browser=json('browser-report.json');
a.equal(browser.stats.expected,3);a.equal(browser.stats.unexpected,0);
a.equal(browser.stats.skipped,0);a.equal(browser.stats.flaky,0);
const walk=s=>s.flatMap(v=>[...(v.specs||[]),...walk(v.suites||[])]);
const cases=walk(browser.suites).flatMap(s=>s.tests.flatMap(t=>t.results));
a.equal(cases.length,3);a(cases.every(v=>v.status==='passed'));
const attachments=cases.flatMap(v=>v.attachments).filter(v=>v.body);
let nativeAssets=0,renderings=0;
for(const entry of attachments) {
  const value=JSON.parse(Buffer.from(entry.body,'base64').toString());
  if(entry.name.endsWith('-native-asset')) {
    const raw=f.readFileSync(p.join(__dirname,'export',value.filename));
    a.equal(value.bytes,raw.length);a.equal(value.sha256,sha(raw));
    a.equal(value.eightWeightPrimitives,1);nativeAssets++;
  } else if(entry.name.endsWith('-technical-render')) {
    a.equal(value.samples,180);a.equal(value.skeletons_independent,true);
    a.equal(value.eight_weight_meshes,2);a.equal(value.static_angle_max,0);
    a(value.moving_angle_max>0);renderings++;
  }
}
a.equal(nativeAssets,6);a.equal(renderings,2);
console.log(JSON.stringify({exact_copies:57,gzip:34,PNG:18,blend:3,GLB:2,protected_prior_unchanged:808,native_exit0:7,native_guard_exit1:1,actual_diagnostic_rays:1096,source_technical_poses:118,roundtrip_technical_poses:118,actual_Chrome_passed:3,appearance_approved:false}));
