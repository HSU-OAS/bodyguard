// FR-A-02/03/08: evidence integrity, not appearance or clinical approval.
const a=require('node:assert/strict'), f=require('node:fs'), p=require('node:path');
const c=require('node:crypto'), z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..');
const sha=b=>c.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json')));
a.equal(m.copies.length,38); a.deepEqual(m.counts,{gzip:23,PNG:10,blend:3,GLB:2});
a.equal(m.protected_prior.length,708); a.equal(m.appearance_approved,false);
a.equal(m.production_adopted,false);
const texts={};
for(const e of m.copies) {
  const b=f.readFileSync(p.join(__dirname,e.file)); a.equal(b.length,e.bytes);
  a.equal(sha(b),e.sha256);
  const decoded=e.gzip?z.gunzipSync(b):b; a.equal(sha(decoded),e.decoded_sha256);
  if(e.gzip) {
    texts[e.file]=decoded.toString();
    a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(texts[e.file]));
  }
}
for(const e of m.protected_prior) a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=name=>JSON.parse(texts[name+'.txt.gz']);
for(const name of ['a268-profile-report.json','a270-profile-report.json']) {
  const r=json(name); a.equal(r.saved_candidate,false);
  a(r.rows.every(v=>!v.existing_6mm_guard_and_geometry_passed));
}
const r=json('a271-profile-report.json'); a.equal(r.saved_candidate,true);
a(r.rows.every(v=>v.existing_6mm_guard_and_geometry_passed&&v.maximum_artist_displacement_m<.006&&v.all_boundary_points_exact));
a.deepEqual(r.rows.map(v=>v.actually_changed_points),[7894,7536]);
a.equal(sha(f.readFileSync(p.join(__dirname,'native/artist-candidate.blend'))),r.candidate_sha256);
const independent=json('a272-independent.json'); a.equal(independent.passed,true);
a(independent.rows.every(v=>v.all_numeric_skin_topology_group_order_hands_163_rest_bones_world_finish_exact&&v.all_point_ledgers_and_a239_parent_attribute_exact&&v.pose_basis_exact));
a.deepEqual(independent.rows.map(v=>v.changed_points),[7894,7536]);
for(const name of ['source-deformation-report.json','roundtrip-deformation-report.json']) {
  const q=json(name); a.equal(q.passed,true); a.equal(q.checks.length,121);
  a.equal(q.checks.filter(v=>v.pose!=='neutral').length,118);
  a.equal(q.rendered,false); a.deepEqual(q.failures,[]);
}
const exported=json('roundtrip-report.json'); a.equal(exported.ratio,1);
a(exported.checks.every(v=>v.meshes===1&&v.images===0&&v.animations===0));
const x=json('execution-record.json'); a.equal(x.runs.length,7);
a.deepEqual(x.runs.map(v=>v.chunks.at(-1).exit_code),[1,1,0,0,0,0,0]);
for(const run of [...x.runs,x.browser]) {
  a.equal(run.full_stdout_preserved,true);
  a(run.chunks.every(v=>!v.output.includes('Warning: truncated output')));
}
a.equal(x.browser.chunks.at(-1).exit_code,0);
a.equal(x.appearance_approved,false); a.equal(x.production_adopted,false);
a.equal(x.PR9_merged,false); a.equal(x.stage2_complete,false); a.equal(x.camera_calls,0);
const browser=json('browser-report.json');
a.equal(browser.stats.expected,3); a.equal(browser.stats.unexpected,0);
a.equal(browser.stats.skipped,0); a.equal(browser.stats.flaky,0);
const walk=s=>s.flatMap(v=>[...(v.specs||[]),...walk(v.suites||[])]);
const cases=walk(browser.suites).flatMap(s=>s.tests.flatMap(t=>t.results));
a.equal(cases.length,3); a(cases.every(v=>v.status==='passed'));
const attachments=cases.flatMap(v=>v.attachments).filter(v=>v.body);
let nativeAssets=0, renderings=0;
for(const entry of attachments) {
  const value=JSON.parse(Buffer.from(entry.body,'base64').toString());
  if(entry.name.endsWith('-native-asset')) {
    const raw=f.readFileSync(p.join(__dirname,'export',value.filename));
    a.equal(value.bytes,raw.length); a.equal(value.sha256,sha(raw));
    a.equal(value.eightWeightPrimitives,1); nativeAssets++;
  } else if(entry.name.endsWith('-technical-render')) {
    a.equal(value.samples,180); a.equal(value.skeletons_independent,true);
    a.equal(value.eight_weight_meshes,2); a.equal(value.static_angle_max,0);
    a(value.moving_angle_max>0); renderings++;
  }
}
a.equal(nativeAssets,6); a.equal(renderings,2);
console.log(JSON.stringify({exact_copies:38,gzip:23,PNG:10,blend:3,GLB:2,protected_prior_unchanged:708,native_exit0:5,native_guard_exit1:2,source_technical_poses:118,roundtrip_technical_poses:118,actual_Chrome_passed:3,appearance_approved:false}));
