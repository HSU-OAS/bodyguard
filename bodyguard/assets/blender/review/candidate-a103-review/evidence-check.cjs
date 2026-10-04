// FR-A-02/08: evidence integrity is not appearance or release approval.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib')
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n))),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const root=path.resolve(__dirname,'../../../../..'),manifest=read('copy-manifest.json'),record=read('execution-record.json')
assert.equal(manifest.old_files_changed,0)
assert.equal(manifest.copies.length,99)
assert.equal(new Set(manifest.copies.map(x=>x.file)).size,99)
for(const x of manifest.copies){const b=fs.readFileSync(path.join(__dirname,x.file));assert.equal(b.length,x.bytes);assert.equal(sha(b),x.sha256);assert.equal(sha(x.file.endsWith('.gz')?zlib.gunzipSync(b):b),x.decoded_sha256);if(x.file.endsWith('.png'))assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a')}
assert.equal(manifest.copies.filter(x=>x.file.endsWith('.gz')).length,14)
assert.equal(manifest.copies.filter(x=>x.file.endsWith('.png')).length,76)
for(const[p,n]of [['comparison/',4],['source/',34],['import/',34],['browser/',4]])assert.equal(manifest.copies.filter(x=>x.file.startsWith(p)&&x.file.endsWith('.png')).length,n)
assert.equal(record.directly_viewed.length,29)
assert.equal(new Set(record.directly_viewed).size,29)
for(const f of record.directly_viewed)assert(manifest.copies.some(x=>x.file===f))
for(const x of [...record.unchanged_files,record.candidate]){const b=fs.readFileSync(path.join(root,x.file));assert.equal(sha(b),x.sha256);if(x.bytes!=null)assert.equal(b.length,x.bytes)}
const comparison=read('interpolation-comparison.json'),native=read('native-path.json'),saved=read('saved-preservation.json')
for(const q of [comparison,native]){assert(!q.cut_plane_reapplied&&!q.full_deformation_qa&&!q.new_browser_comparison&&!q.appearance_approved);assert.equal(q.source_sha256,record.input_sha256)}
assert.equal(comparison.assets_saved,0)
assert.equal(native.assets_saved,1)
assert.equal(native.candidate_sha256,record.candidate.sha256)
assert.equal(comparison.rows.length,4)
for(const x of comparison.rows){assert(x.retained_coordinates_skin_hands_guard_passed&&x.rest_bones_matrices_preserved);assert.equal(x.after.global_nonmanifold,0);if(x.mode==='SURFACE')assert.deepEqual(x.before,x.after);else{assert.equal(x.mode,'PATH');assert.equal(x.after.long_fold_edges,0);assert.equal(x.after.narrow_faces,0)}}
assert.equal(native.rows.length,2)
for(const[i,x]of native.rows.entries()){assert.equal(x.interpolation,'PATH');assert.deepEqual(x.after,comparison.rows[i+2].after);assert(x.retained_coordinates_skin_hands_guard_passed&&x.rest_bones_matrices_preserved)}
assert(saved.passed&&!saved.full_deformation_qa&&!saved.appearance_approved)
assert.equal(saved.rows.length,2)
for(const[i,x]of saved.rows.entries()){assert.equal(x.outside_vertices,[140155,137978][i]);assert.equal(x.outside_faces,[200169,196172][i]);assert.equal(x.protected_hand_vertices,[50689,50673][i]);assert(x.outside_coordinates_named_skin_exact&&x.outside_faces_winding_exact&&x.hands_coordinates_named_skin_exact&&x.groups_rest_bones_head_tail_matrices_exact);assert.equal(x.whole_topology_unchanged,false)}
assert.equal(saved.inputs_sha256[record.input_file],record.input_sha256)
assert.equal(saved.inputs_sha256[record.candidate.file],record.candidate.sha256)
for(const[f,m]of [['source-deformation.json',record.deformation.source_max_edge_ratio],['roundtrip-deformation.json',record.deformation.reimport_max_edge_ratio]]){const q=read(f),p=q.checks.filter(x=>x.edge_ratio_max!=null);assert(q.candidate&&q.rendered&&q.passed);assert.deepEqual(q.failures,[]);assert.equal(q.checks.length,121);assert.equal(p.length,118);assert.equal(Math.max(...p.map(x=>x.edge_ratio_max)),m);assert(p.every(x=>Number.isFinite(x.edge_ratio_max)&&x.edge_ratio_max<3));for(const x of q.checks.filter(x=>x.surface))assert(x.components===1&&x.non_manifold===0&&x.unnormalized===0);assert.equal(q.checks[0].surface_style,'unified-white-mannequin');assert.deepEqual(q.checks[0].garments,[])}
const glb=read('glb-roundtrip.json')
assert(glb.transforms_passed&&glb.geometry_deformation_pending) // Export-time pending; later separate actual QA.
assert.equal(glb.ratio,1)
assert.equal(glb.maximum_skin_influences,8)
for(const x of glb.checks)assert(x.meshes===5&&x.animations===0&&x.images===0)
const results=s=>(s.specs||[]).flatMap(x=>x.tests.flatMap(t=>t.results)).concat((s.suites||[]).flatMap(results))
const browser=read('browser-report.json'),runs=results(browser),attachments=runs.flatMap(x=>x.attachments||[])
assert.deepEqual(browser.stats,record.browser)
assert.deepEqual(browser.errors,[])
assert.equal(runs.length,4)
assert(runs.every(x=>x.status==='passed'&&x.errors.length===0))
for(const a of attachments.filter(x=>x.name.endsWith('-native-asset'))){const x=JSON.parse(Buffer.from(a.body,'base64')),m=manifest.copies.find(y=>y.file===x.filename);assert(m);assert.equal(x.sha256,m.sha256);assert.equal(x.bytes,m.bytes);assert.equal(x.eightWeightPrimitives,1)}
const frames=attachments.filter(x=>x.name.endsWith('-camera-only-frame')),timing=attachments.filter(x=>x.name.endsWith('-technical-render'))
assert.equal(frames.length,2)
assert.equal(timing.length,2)
for(const a of frames){const x=JSON.parse(Buffer.from(a.body,'base64'));assert.equal(x.length,10);assert(x.every(y=>y.visible&&y.vertices>0))}
for(const a of timing){const x=JSON.parse(Buffer.from(a.body,'base64'));assert(x.samples===180&&x.skeletons_independent&&x.static_angle_max===0&&x.moving_angle_max>0)}
assert.equal(record.runs.length,8)
assert(record.runs.every(x=>x.exit_code===0))
assert.equal(record.style.first_preservation_format_check_exit,1)
assert.deepEqual(record.style.ruff_check_exits,[0,0,0])
assert.deepEqual(record.style.isolated_88_format_check_exits,[0,0,0])
for(const k of ['temporary_typecheck_exit','temporary_biome_check_exit','restored_typecheck_exit','restored_biome_check_exit','copy_script_syntax_exit'])assert.equal(record.style[k],0)
assert(record.temporary_test_helpers_restored&&!fs.existsSync(path.join(root,'bodyguard/frontend/e2e/a103-frame-client.ts')))
assert.equal(record.new_blend_files,1)
assert.equal(record.new_glb_files,2)
assert(record.new_full_deformation_qa&&record.new_browser_comparison)
for(const k of ['human_camera_capture','human_coordinate_collection','appearance_passed','adopted','release_approved','stages_1_to_6_complete','pr9_merge_allowed'])assert.equal(record[k],false)
for(const f of [path.join(root,'bodyguard/docs/avatar-production.md'),path.join(root,'bodyguard/docs/stories/stage2-avatar-candidate.md'),path.join(__dirname,'README.md')])for(const m of fs.readFileSync(f,'utf8').matchAll(/\]\(([^\s)]+)\)/g))if(!/^(https?:|#)/.test(m[1]))assert(fs.existsSync(path.resolve(path.dirname(f),m[1].split('#')[0])),m[1])
console.log(JSON.stringify({integrity_passed:true,copies:99,png:76,directly_viewed:29,source_poses:118,reimport_poses:118,Chrome:4,old_files_changed:0,appearance_passed:false,adopted:false}))
