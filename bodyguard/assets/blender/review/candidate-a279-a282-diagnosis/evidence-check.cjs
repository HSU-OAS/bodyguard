// FR-A-02/03/08: actual diagnostic integrity, never appearance/release approval.
const a=require('node:assert/strict'),f=require('node:fs'),p=require('node:path');
const c=require('node:crypto'),z=require('node:zlib');
const root=p.resolve(__dirname,'../../../../..');
const sha=b=>c.createHash('sha256').update(b).digest('hex');
const m=JSON.parse(f.readFileSync(p.join(__dirname,'copy-manifest.json')));
a.equal(m.copies.length,16);a.deepEqual(m.counts,{gzip:16,PNG:0,blend:0,GLB:0});
a.equal(m.protected_prior.length,789);a.equal(m.new_assets,0);
a.equal(m.appearance_approved,false);a.equal(m.production_adopted,false);
const texts={};
for(const e of m.copies) {
 const b=f.readFileSync(p.join(__dirname,e.file));a.equal(b.length,e.bytes);a.equal(sha(b),e.sha256);
 const raw=z.gunzipSync(b);a.equal(sha(raw),e.decoded_sha256);texts[e.file]=raw.toString();
 a(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(texts[e.file]));
}
for(const e of m.protected_prior)a.equal(sha(f.readFileSync(p.join(root,e.file))),e.sha256,e.file);
const json=name=>JSON.parse(texts[name+'.txt.gz']);
const loc=json('a279-location-report.json');a.equal(loc.rows.length,4);
a.equal(loc.rows.reduce((s,v)=>s+v.actual_rays,0),78);
a.equal(loc.rows.reduce((s,v)=>s+v.hit_count,0),69);
a.equal(loc.rows.reduce((s,v)=>s+v.miss_count,0),9);
for(const row of loc.rows) {
 a.equal(row.samples.length,row.actual_rays);
 a(row.samples.filter(v=>v.hit).every(v=>v.reprojection_error_pixels<.05));
}
a.equal(loc.saved_assets,0);a.equal(loc.read_only_input_hashes_exact,true);
const reject=json('a280-profile-report.json');a.equal(reject.saved_candidate,false);
a(reject.rows.every(v=>!v.existing_6mm_guard_and_geometry_passed&&v.maximum_artist_displacement_m>.006));
a.deepEqual(reject.rows.map(v=>v.before.long_folds),[76,107]);
a.deepEqual(reject.rows.map(v=>v.after.long_folds),[81,109]);
const contour=json('a282-silhouette-report.json');a.equal(contour.rows.length,4);
a.equal(contour.rows.reduce((s,v)=>s+v.actual_rays,0),600);
a.equal(contour.rows.reduce((s,v)=>s+v.actual_hits,0),379);
a.equal(contour.rows.reduce((s,v)=>s+v.actual_misses,0),221);
for(const row of contour.rows) {
 a.equal(row.scans.length,6);a.equal(row.actual_rays,150);
 for(const scan of row.scans) {
  a.equal(scan.rays.length,25);
  a(scan.rays.filter(v=>v.hit).every(v=>v.reprojection_error_pixels<.05));
  for(const edge of scan.actual_body_to_background_transitions) {
   const body=scan.rays.find(v=>v.pixel[0]===edge.last_body_pixel[0]);
   const outside=scan.rays.find(v=>v.pixel[0]===edge.first_background_pixel[0]);
   a.equal(body.hit,true);a.equal(outside.hit,false);
   a.equal(outside.pixel[0]-body.pixel[0],1);
  }
 }
 if(row.gender==='Female')a.deepEqual(row.transition_count_per_row,[1,1,1,1,1,1]);
 else a.deepEqual(row.transition_count_per_row,[1,1,1,1,1,0]);
}
a.equal(contour.saved_assets,0);a.equal(contour.read_only_input_hashes_exact,true);
const inputFiles=[
 'bodyguard/assets/blender/review/candidate-a243-a251-diagnosis/a250/artist-candidate.blend',
 'bodyguard/assets/blender/review/candidate-a274-a278-review/native/artist-candidate.blend',
];
for(const report of [loc,contour]) {
 const seen=new Set();
 for(const [recorded,hash] of Object.entries(report.input_sha256)) {
  const relative=inputFiles.find(file=>recorded.endsWith('/'+file));
  a(relative,'Unexpected native input role');seen.add(relative);
  a.equal(sha(f.readFileSync(p.join(root,relative))),hash);
 }
 a.equal(seen.size,2);
 a.equal(report.new_source_deformation_QA,false);a.equal(report.new_GLB_QA,false);
 a.equal(report.new_browser_QA,false);a.equal(report.appearance_approved,false);
}
const x=json('execution-record.json');a.equal(x.runs.length,3);
a.deepEqual(x.runs.map(v=>v.chunks.at(-1).exit_code),[0,1,0]);
for(const run of x.runs) {
 a.equal(run.full_stdout_preserved,true);
 a(run.chunks.every(v=>!v.output.includes('Warning: truncated output')));
}
a.equal(x.A281_saved_native_test_executed,false);a.equal(x.A280_saved_assets,0);
a.equal(x.new_renders,0);a.equal(x.camera_calls,0);a.equal(x.PR9_merged,false);
a.equal(x.production_adopted,false);a.equal(x.appearance_approved,false);
console.log(JSON.stringify({exact_gzip_copies:16,protected_prior_unchanged:789,native_exit0:2,native_guard_exit1:1,actual_location_rays:78,actual_contour_rays:600,PNG:0,new_assets:0,appearance_approved:false}));
