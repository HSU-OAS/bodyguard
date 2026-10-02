// Read-only authored boundary evidence; never an appearance/release gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname,file)));
const manifest = read('copy-manifest.json');
const record = read('execution-record.json');
assert.equal(manifest.old_files_changed,0);
assert.equal(manifest.copies.length,5);
assert.equal(new Set(manifest.copies.map(r=>r.file)).size,5);
for(const row of manifest.copies) {
  const bytes=fs.readFileSync(path.join(__dirname,row.file));
  assert.equal(bytes.length,row.bytes);
  assert.equal(sha(bytes),row.sha256);
  assert.equal(sha(zlib.gunzipSync(bytes)),row.decoded_sha256);
}
const probe=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'ordered-boundary.json.gz'))));
assert.equal(probe.source_sha256,record.source.sha256);
assert.equal(probe.read_only,true);
assert.equal(probe.source_saved,false);
assert.deepEqual(probe.rows.map(r=>r.xz_geometric_side_edge_counts),[[56,107,104,107],[56,103,81,123]]);
assert.deepEqual(probe.rows.map(r=>r.boundary_edges),[374,363]);
for(const row of probe.rows) {
  assert.equal(row.ordered_authored_points.length,row.boundary_edges);
  assert.equal(new Set(row.ordered_authored_points.map(p=>p.original_id)).size,row.boundary_edges);
  assert.equal(row.xz_geometric_side_edge_counts.reduce((a,b)=>a+b,0),row.boundary_edges);
  assert.equal(row.opposite_counts_match,false);
  assert.equal(row.read_only,true);
  assert.equal(row.appearance_or_full_geometry_passed,false);
  assert.equal(row.xz_projected_strict_crossings,0);
}
assert.equal(sha(fs.readFileSync(path.resolve(__dirname,'../../../../..',record.source.file))),record.source.sha256);
assert.equal(record.native.session,76532);
assert.equal(record.native.exit_code,0);
for(const key of ['source_saved','new_full_deformation_qa','new_browser_comparison','appearance_passed','adopted','release_approved','stages_1_to_6_complete','pr9_merge_allowed']) assert.equal(record[key],false);
for(const key of ['new_blend_files','new_glb_files','new_png']) assert.equal(record[key],0);
for(const file of ['README.md','../../../../docs/avatar-production.md','../../../../docs/stories/stage2-avatar-candidate.md']){
  const absolute=path.resolve(__dirname,file);
  for(const match of fs.readFileSync(absolute,'utf8').matchAll(/\]\(([^\s)]+)\)/g)) if(!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(absolute),match[1].split('#')[0])));
}
console.log(JSON.stringify({integrity_passed:true,copies:5,gzip:5,native_exit:0,side_counts:record.boundary_side_counts,new_assets:0,appearance_passed:false}));
