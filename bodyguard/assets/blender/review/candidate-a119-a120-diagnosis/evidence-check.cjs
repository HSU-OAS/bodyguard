// FR-A-02/08: immutable authored-mesh diagnostics; integrity is not appearance approval.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const crypto = require("node:crypto"), zlib = require("node:zlib");
const root = path.resolve(__dirname, "../../../../..");
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, f)));
const manifest = read("copy-manifest.json"), record = read("execution-record.json");
assert.equal(manifest.old_files_changed, 0);
assert.equal(manifest.copies.length, 14);
assert.equal(new Set(manifest.copies.map(r => r.file)).size, 14);
assert.equal(manifest.copies.filter(r => r.file.endsWith(".gz")).length, 5);
assert.equal(manifest.protected_old_files.length, 137);
assert.equal(new Set(manifest.protected_old_files.map(r => r.file)).size, 137);
for (const row of manifest.protected_old_files) assert.equal(sha(fs.readFileSync(path.join(root, row.file))), row.sha256);
for (const row of manifest.copies) {
  const b = fs.readFileSync(path.join(__dirname, row.file));
  assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256);
  assert.equal(sha(row.file.endsWith(".gz") ? zlib.gunzipSync(b) : b), row.decoded_sha256);
  if (row.file.endsWith(".png")) {
    assert.equal(b.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(b.readUInt32BE(16), 1000); assert.equal(b.readUInt32BE(20), 1000);
  }
}
assert.equal(sha(fs.readFileSync(path.join(root, record.source.file))), record.source.sha256);
assert.equal(fs.statSync(path.join(root, record.source.file)).size, record.source.bytes);
assert.equal(sha(zlib.gunzipSync(fs.readFileSync(path.join(root, record.profile.file)))), record.profile.decoded_sha256);
for (const [folder, flips, folds, tiny] of [["nearest", [3995, 2065], [671, 293], [17, 9]], ["directional", [0, 0], [679, 445], [0, 0]]]) {
  const report = read(folder + "/grid-trial.json");
  assert.equal(report.source_sha256, record.source.sha256);
  assert.equal(report.source_saved, false); assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows.map(r => r.conformance_chart_trace.projected_orientation_flips), flips);
  assert.deepEqual(report.rows.map(r => r.before_after[1].long_folds), folds);
  assert.deepEqual(report.rows.map(r => r.before_after[1].tiny_faces), tiny);
  assert.deepEqual(report.rows.map(r => r.measured_two_loop_grid_before_conformance.long_folds), [197, 106]);
  for (const row of report.rows) {
    for (const key of ["all_retained_coordinates_skin_exact", "protected_hands_rest_matrices_exact", "unmodified_face_winding_exact", "conformance_all_skin_topology_winding_exact", "triangulation_coordinates_skin_exact", "modifier_move_up_apply_finished", "only_original_rig_modifier_remaining"]) assert.equal(row[key], true);
    assert.equal(row.trial_geometry_guards_passed, false);
    assert.equal(row.full_qa_or_appearance_approved, false); assert.equal(row.whole_topology_unchanged, false);
    assert.equal(row.new_skin_normalization_errors, 0);
    assert.equal(row.candidate_vertices, row.source_vertices - row.removed_local_vertices + row.native_generated_vertices);
    assert.equal(row.verified_active_body, "BODYGUARD " + row.body + " sculpt WIP");
    assert.equal(row.before_after[1].global_nonmanifold, 0); assert.equal(row.before_after[1].global_inconsistent_winding, 0);
    const chart = row.conformance_chart_trace;
    assert.equal(chart.trace_ids_unique_and_complete, true);
    assert.equal(chart["3d_collision_anatomy_or_appearance_proven"], false);
    assert.equal(chart.triangle_count, row.native_new_face_sizes["3"]);
    assert.equal(chart.before_positive_negative_nearzero.reduce((a,b)=>a+b,0), chart.triangle_count);
    assert.equal(chart.after_positive_negative_nearzero.reduce((a,b)=>a+b,0), chart.triangle_count);
    assert(chart.before_positive_negative_nearzero[0] > 0 && chart.before_positive_negative_nearzero[1] > 0);
    assert(chart.flipped_triangles_incident_to_local_long_folds <= chart.projected_orientation_flips);
    if (folder === "directional") {
      assert.equal(chart.max_abs_xyz_displacement_m[0], 0);
      assert.equal(chart.max_abs_xyz_displacement_m[2], 0);
      assert.deepEqual(chart.before_positive_negative_nearzero, chart.after_positive_negative_nearzero);
      assert(Math.max(row.old_to_new_sample_envelope_m, row.new_to_old_sample_envelope_m) > 0.006);
    }
  }
}
assert.equal(read("primary-source-read.json").exit_code, 0);
assert.deepEqual(record.runs.map(r => r.session), [24406,27886]);
assert.deepEqual(record.runs.map(r => r.exit_code), [0,0]);
assert.equal(record.runs[0].intermediate_stdout_archived, false);
assert.equal(record.observed_images.length, 2);
for (const f of record.observed_images) assert(manifest.copies.some(r => r.file === f && f.endsWith(".png")));
for (const key of ["source_saved", "new_full_deformation_qa", "new_browser_comparison", "human_camera_capture", "human_coordinate_collection", "appearance_passed", "adopted", "release_approved", "stages_1_to_6_complete", "pr9_merge_allowed"]) assert.equal(record[key], false);
assert.equal(record.new_blend_files,0); assert.equal(record.new_glb_files,0);
for (const file of ["README.md", "../../../../docs/avatar-production.md", "../../../../docs/stories/stage2-avatar-candidate.md"]) {
  const absolute = path.resolve(__dirname, file);
  for (const match of fs.readFileSync(absolute, "utf8").matchAll(/\]\(([^\s)]+)\)/g))
    if (!/^(https?:|#)/.test(match[1])) assert(fs.existsSync(path.resolve(path.dirname(absolute), match[1].split("#")[0])));
}
console.log(JSON.stringify({integrity_passed:true,copies:14,gzip:5,protected_old_files:137,new_png:2,directly_viewed:2,native_exits:[0,0],new_Chrome:0,geometry_or_appearance_passed:false}));
