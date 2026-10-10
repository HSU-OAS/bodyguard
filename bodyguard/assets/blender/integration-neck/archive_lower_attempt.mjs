// FR-A-02/03/08: preserve real partial authoring and explicit unexecuted QA.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

const source = dirname(fileURLToPath(import.meta.url));
const output = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/projected-attempt/candidate-projected.blend",
);
const inputSha =
	"2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394";
const candidateSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const names = [
	"lower-inspection.json",
	"lower-inspection.log",
	"posterior-contours.json",
	"posterior-contours.log",
	"posterior-contours-final.json",
	"posterior-contours-final.log",
	"posterior-contour-initial.py",
	"posterior-lint-initial.log",
	"visible-patches.json",
	"visible-patches.log",
	"sided-domains.json",
	"sided-domains.log",
	"sided-domains-final.json",
	"sided-domains-final.log",
	"visibility-initial.py",
	"visibility-lint-initial.log",
	"neck-domains.json",
	"neck-domains.log",
	"author-lint-initial.log",
	"author-center.json",
	"author-center.log",
	"candidate-neck-center.blend",
	"render-approval-blocked.json",
].sort();
const helpers = [
	"inspect_lower_sections.py",
	"inspect_posterior_contours.py",
	"posterior_contour.py",
	"inspect_visible_patches.py",
	"surface_visibility.py",
	"inspect_sided_domain.py",
	"inspect_neck_domains.py",
	"posterior_surface_guides.py",
	"author_neck_center.py",
	"reopen_neck_center.py",
	"artist_snapshot_values.py",
	"projected_ribbon.py",
	"render_comparison.py",
	"archive_lower_attempt.mjs",
];
const observedRuns = [
	"lower-inspection",
	"posterior-contours",
	"posterior-contours-final",
	"visible-patches",
	"sided-domains",
	"sided-domains-final",
	"neck-domains",
	"author-center",
].map((name) => ({ name, exit: 0 }));
const falseFlags = [
	"independent_reopen_executed",
	"independent_reopen_passed",
	"native_render_executed",
	"appearance_approved",
	"all_regions_authored",
	"full_deformation_glb_browser_executed",
	"actual_camera",
	"final_avatar_adopted",
	"stages_1_to_6_complete",
];
const compressed = (name) => !name.endsWith(".blend");
const archived = (name) => (compressed(name) ? `${name}.gz` : name);
const savedNames = [...names, ...helpers.map((h) => `current-${h}`)]
	.map(archived)
	.sort();
assert.equal(savedNames.length, 37);

function regular(path) {
	assert(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
	return readFileSync(path);
}
function verify() {
	assert.equal(sha(regular(input)), inputSha);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, inputSha);
	assert.equal(manifest.candidate_sha256, candidateSha);
	assert.equal(manifest.partial_central_neck_authoring_passed, true);
	assert.equal(manifest.automatic_approval_blocked, true);
	for (const field of falseFlags) assert.equal(manifest[field], false);
	assert.deepEqual(manifest.entries.map((e) => e.file).sort(), savedNames);
	assert.deepEqual(manifest.observed_native_runs, observedRuns);
	assert.equal(manifest.native_render_exit_code, null);
	for (const e of manifest.entries) {
		assert(savedNames.includes(e.file));
		const bytes = regular(join(output, e.file));
		assert.equal(bytes.length, e.bytes);
		assert.equal(sha(bytes), e.sha256);
		assert.equal(sha(e.compressed ? gunzipSync(bytes) : bytes), e.raw_sha256);
	}
	const raw = (file) => {
		const bytes = regular(join(output, archived(file)));
		return compressed(file) ? gunzipSync(bytes) : bytes;
	};
	const json = (file) => JSON.parse(raw(file));
	assert.equal(sha(raw("candidate-neck-center.blend")), candidateSha);
	for (const name of observedRuns.slice(0, -1).map((r) => r.name)) {
		const report = json(`${name}.json`);
		assert(report.inspection_completed && report.read_only_scene);
		assert(!report.model_authored_or_saved && !report.appearance_approved);
		assert(!report.clinical_or_camera_data);
		assert.equal(report.input_sha256, inputSha);
		assert.equal(report.blender, "5.1.1");
		assert.deepEqual(
			report.rows.map((r) => r.gender),
			["Male", "Female"],
		);
		assert(report.rows.every((r) => r.source_body_rig_exact));
	}
	assert.deepEqual(
		json("posterior-contours.json"),
		json("posterior-contours-final.json"),
	);
	assert.deepEqual(
		json("sided-domains.json"),
		json("sided-domains-final.json"),
	);
	const author = json("author-center.json");
	assert(author.passed && !author.diagnostic_no_save);
	assert(!author.appearance_approved && !author.clinical_or_camera_work);
	assert.equal(author.input_sha256, inputSha);
	assert.equal(author.output_sha256, candidateSha);
	assert.equal(author.segment, "neck-center");
	assert.equal(author.blender, "5.1.1");
	assert.deepEqual(
		author.rows.map((r) => r.gender),
		["Male", "Female"],
	);
	assert.deepEqual(
		author.rows.map((r) => r.original_patch_faces),
		[3428, 3191],
	);
	assert.deepEqual(
		author.rows.map((r) => r.new_points),
		[1470, 1152],
	);
	assert.deepEqual(
		author.rows.map((r) => r.native_section_guides.length),
		[49, 32],
	);
	for (const row of author.rows) {
		assert(row.outside_coordinates_raw_skin_polygons_exact);
		assert(row.front_hands_preserved && row.rest_rig_world_material_exact);
		assert(row.previous_point_provenance_preserved);
		assert(row.actual_anterior_visible_faces_protected > 97000);
		assert(row.maximum_surface_binding_distance_m < 0.006);
		assert.equal(row.after.nonmanifold, 0);
		assert.equal(row.after.winding, 0);
		assert(row.after.tiny_faces <= row.before.tiny_faces);
		assert(
			row.native_section_guides.every(
				(g) => g.actual_posterior_arc_not_coordinate_only,
			),
		);
		for (const field of [
			"new_points_outside_original_projection",
			"new_face_centers_outside_original_projection",
			"negative_y_faces",
			"tiny_faces",
			"original_multiple_hits",
			"candidate_multiple_hits",
			"additional_intersection_samples",
		])
			assert.equal(row.ribbon_geometry[field], 0);
		assert.equal(row.ribbon_geometry.rear_samples, 2178);
		assert.equal(row.ribbon_geometry.candidate_maximum_hits, 1);
	}
	const blocked = json("render-approval-blocked.json");
	assert.equal(blocked.process_started, false);
	assert.equal(blocked.native_exit_code, null);
	assert.equal(blocked.native_report_or_previews_created, false);
	assert.equal(blocked.approval_bypassed_or_native_retried, false);
	assert(blocked.tool_rejection.includes("Automatic approval review failed"));
	assert(blocked.tool_rejection.includes("usage limit"));
	for (const name of observedRuns.map((r) => r.name)) {
		const log = raw(`${name}.log`).toString();
		assert(!log.includes("Error: script failed"));
		assert(log.includes("Blender quit"));
	}
	assert(
		raw("author-center.log")
			.toString()
			.includes('Saved as "candidate-neck-center.blend"'),
	);
	assert(raw("posterior-lint-initial.log").toString().includes("RUF007"));
	assert(raw("visibility-lint-initial.log").toString().includes("F401"));
	assert(raw("author-lint-initial.log").toString().includes("I001"));
	for (const h of helpers)
		assert.equal(sha(raw(`current-${h}`)), sha(regular(join(source, h))));
	assert.equal(
		sha(raw("current-author_neck_center.py")),
		"0579c197a56defcfc8de560392e79d2dc58d556fe0e8911744bddaa131ef3daf",
	);
	assert.equal(
		sha(raw("current-posterior_surface_guides.py")),
		"d95da35dc3d0e899fe51ad60c56d23e73ac68ada8675cb2053b87af7a9879440",
	);
	return {
		artifacts: 37,
		byteAuditOnly: true,
		partialCentralNeckAuthoringPassed: true,
		independentReopen: "not executed",
		actualPreviews: 0,
		automaticApprovalBlocked: true,
		appearanceApproved: false,
	};
}

if (process.argv[2] === "--check") {
	assert.equal(process.argv.length, 3);
	console.log(JSON.stringify(verify()));
} else {
	assert.equal(process.argv[2], "--archive");
	assert.equal(process.argv.length, 4);
	const proof = process.argv[3];
	assert(/^\/private\/tmp\/bodyguard-neck-lower\.[A-Za-z0-9]+$/.test(proof));
	assert.equal(realpathSync(proof), proof);
	assert(!lstatSync(proof).isSymbolicLink());
	const found = readdirSync(proof).sort();
	assert.deepEqual(found, names);
	for (const file of found) regular(join(proof, file));
	assert.equal(sha(regular(input)), inputSha);
	assert.equal(
		sha(regular(join(proof, "candidate-neck-center.blend"))),
		candidateSha,
	);
	if (existsSync(output)) {
		assert(
			lstatSync(output).isDirectory() && !lstatSync(output).isSymbolicLink(),
		);
		assert.deepEqual(readdirSync(output), ["README.md"]);
	} else mkdirSync(output);
	const entries = [];
	for (const [file, bytes] of [
		...names.map((f) => [f, regular(join(proof, f))]),
		...helpers.map((h) => [`current-${h}`, regular(join(source, h))]),
	]) {
		const saved = compressed(file)
			? gzipSync(bytes, { level: 9, mtime: 0 })
			: bytes;
		const name = archived(file);
		writeFileSync(join(output, name), saved, { flag: "wx" });
		entries.push({
			file: name,
			compressed: compressed(file),
			bytes: saved.length,
			sha256: sha(saved),
			raw_sha256: sha(bytes),
		});
	}
	writeFileSync(
		join(output, "manifest.json"),
		`${JSON.stringify(
			{
				input_sha256: inputSha,
				candidate_sha256: candidateSha,
				partial_central_neck_authoring_passed: true,
				automatic_approval_blocked: true,
				...Object.fromEntries(falseFlags.map((f) => [f, false])),
				native_render_exit_code: null,
				source_capture:
					"Unchanged executed sources preserved after execution; reopen and render scripts are prepared but unexecuted for this candidate. Initial import-order failing sources were not captured; their logs are preserved.",
				observed_native_runs: observedRuns,
				entries,
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	console.log(JSON.stringify(verify()));
}
