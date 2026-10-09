// Preserve partial native CDT success, actual previews and remaining appearance P2.
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
	"../../../docs/review/avatar-neck-integration/projected-attempt",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/candidate-unapproved.blend",
);
const original =
	"ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b";
const candidate =
	"2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const views = ["male", "female"].flatMap((gender) =>
	["back", "side", "quarter", "front"].map((v) => `${gender}-${v}.png`),
);
const names = [
	"archive-count-initial.mjs",
	"archive-count-initial.log",
	"candidate-projected.blend",
	"projected-constraints.json",
	"projected-constraints.log",
	"private-annulus.json",
	"private-annulus.log",
	"author-report.json",
	"author.log",
	"reopen.json",
	"reopen.log",
	"ribbon-reopen.json",
	"ribbon-reopen.log",
	"render.log",
	"render/render.json",
	...views.map((v) => `render/${v}`),
	"unchanged-negative.json",
	"unchanged-negative.log",
	"overwrite-negative.log",
].sort();
const helpers = [
	"inspect_projected_constraints.py",
	"projected_ribbon.py",
	"probe_projected_ribbon.py",
	"author_projected_ribbon.py",
	"inspect_projected_ribbon.py",
	"artist_snapshot_values.py",
	"reopen_sectioned_patch.py",
	"render_comparison.py",
	"archive_projected_attempt.mjs",
];
const compressed = (file) => !file.endsWith(".blend") && !file.endsWith(".png");
const archiveName = (file) => (compressed(file) ? `${file}.gz` : file);
const savedNames = [...names, ...helpers.map((h) => `current-${h}`)]
	.map(archiveName)
	.sort();
assert.equal(savedNames.length, 35);
function regular(path) {
	assert(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
	return readFileSync(path);
}
function verify() {
	assert.equal(sha(regular(input)), original);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, original);
	assert.equal(manifest.candidate_sha256, candidate);
	assert(
		manifest.partial_occipital_authoring_passed &&
			manifest.independent_reopen_passed,
	);
	for (const field of [
		"appearance_approved",
		"final_avatar_adopted",
		"all_regions_authored",
		"full_deformation_glb_browser_executed",
		"actual_camera",
		"stages_1_to_6_complete",
	])
		assert.equal(manifest[field], false);
	assert.deepEqual(manifest.entries.map((e) => e.file).sort(), savedNames);
	assert.deepEqual(manifest.observed_native_runs, [
		{ name: "projected-constraints", exit: 0 },
		{ name: "private-annulus", exit: 0 },
		{ name: "author", exit: 0 },
		{ name: "reopen", exit: 0 },
		{ name: "ribbon-reopen", exit: 0 },
		{ name: "render", exit: 0 },
		{ name: "unchanged-negative", exit: 1 },
		{ name: "overwrite-negative", exit: 1 },
	]);
	for (const e of manifest.entries) {
		assert(savedNames.includes(e.file));
		const bytes = regular(join(output, e.file));
		assert.equal(bytes.length, e.bytes);
		assert.equal(sha(bytes), e.sha256);
		assert.equal(sha(e.compressed ? gunzipSync(bytes) : bytes), e.raw_sha256);
	}
	const raw = (file) => {
		const bytes = regular(join(output, archiveName(file)));
		return compressed(file) ? gunzipSync(bytes) : bytes;
	};
	const json = (file) => JSON.parse(raw(file));
	assert.equal(sha(raw("candidate-projected.blend")), candidate);
	const constraints = json("projected-constraints.json");
	assert(
		constraints.inspection_completed &&
			constraints.read_only_scene &&
			!constraints.model_authored_or_saved,
	);
	assert.equal(constraints.input_sha256, original);
	assert(
		constraints.rows.every(
			(r) =>
				r.source_body_rig_exact &&
				r.nonadjacent_intersections.length === 0 &&
				r.source_selected_negative_y_faces === 0 &&
				r.cdt.one_to_one_original_vertices &&
				r.cdt.maximum_returned_vertex_shift_m === 0 &&
				r.cdt.constraint_edges_present_without_splits,
		),
	);
	const probe = json("private-annulus.json");
	assert(
		probe.probe_passed &&
			probe.private_non_human_mesh &&
			!probe.model_authored_or_saved,
	);
	assert(
		probe.observation.input_3d_coordinates_exact &&
			probe.observation.all_constraints_preserved_without_splits,
	);
	assert.equal(probe.observation.projected_annulus_area_m2, 6);
	const author = json("author-report.json"),
		reopened = json("reopen.json");
	for (const report of [author, reopened]) {
		assert(
			report.passed &&
				!report.appearance_approved &&
				!report.clinical_or_camera_work,
		);
		assert.equal(report.input_sha256, original);
		assert.equal(report.blender, "5.1.1");
		assert.deepEqual(
			report.rows.map((r) => r.gender),
			["Male", "Female"],
		);
		assert(
			report.rows.every((r) => r.outside_coordinates_raw_skin_polygons_exact),
		);
	}
	assert.equal(author.output_sha256, candidate);
	assert.equal(reopened.candidate_sha256, candidate);
	assert(
		reopened.independent_reopen &&
			!reopened.source_saved_or_modified &&
			!reopened.full_deformation_glb_browser_executed,
	);
	assert.deepEqual(
		author.rows.map((r) => r.native_section_guides.length),
		[37, 32],
	);
	for (const row of author.rows) {
		assert(row.front_hands_preserved && row.rest_rig_world_material_exact);
		assert(row.maximum_surface_binding_distance_m < 0.006);
		assert(
			row.after.nonmanifold === 0 &&
				row.after.winding === 0 &&
				row.after.tiny_faces <= row.before.tiny_faces,
		);
		for (const f of [
			"new_points_outside_original_projection",
			"new_face_centers_outside_original_projection",
			"negative_y_faces",
			"tiny_faces",
			"candidate_multiple_hits",
			"additional_intersection_samples",
		])
			assert.equal(row.ribbon_geometry[f], 0);
		assert.equal(row.ribbon_geometry.rear_samples, 2178);
	}
	assert(author.last_grid.native_projected_annulus[0].native_projected_cdt);
	const ribbon = json("ribbon-reopen.json");
	assert(
		ribbon.read_only_scene &&
			ribbon.inspection_passed &&
			ribbon.mixed_origin_ribbon_subset_only &&
			!ribbon.source_saved_or_modified &&
			!ribbon.appearance_approved &&
			!ribbon.clinical_or_camera_data,
	);
	assert.equal(ribbon.input_sha256, original);
	assert.equal(ribbon.candidate_sha256, candidate);
	for (const row of ribbon.rows) {
		assert.equal(row.candidate.ribbon_negative_y_normal_faces, 0);
		assert.equal(row.candidate.ribbon_tiny_faces, 0);
		assert.equal(row.candidate.multiple_rear_hits, 0);
		assert.equal(row.original.multiple_rear_hits, 0);
		assert.deepEqual(
			row.candidate.rear_hit_counts,
			row.original.rear_hit_counts,
		);
		assert.equal(row.candidate.rear_hit_counts.length, 2178);
	}
	assert.equal(json("unchanged-negative.json").passed, false);
	assert(
		json("unchanged-negative.json").failure.includes(
			"Unchanged input cannot be a new candidate",
		),
	);
	for (const log of ["unchanged-negative.log", "overwrite-negative.log"])
		assert(raw(log).toString().includes("Error: script failed"));
	for (const log of [
		"author.log",
		"reopen.log",
		"ribbon-reopen.log",
		"render.log",
		"projected-constraints.log",
		"private-annulus.log",
	])
		assert(!raw(log).toString().includes("Error: script failed"));
	const render = json("render/render.json");
	assert.deepEqual(render.views, views);
	assert(
		render.same_source_material_world_lights &&
			!render.appearance_approved &&
			render.samples === 32,
	);
	for (const h of helpers)
		assert.equal(sha(raw(`current-${h}`)), sha(regular(join(source, h))));
	return {
		artifacts: 35,
		byteAuditOnly: true,
		partialNativeAuthoringPassed: true,
		independentReopenPassed: true,
		actualNativePreviews: 8,
		appearanceApproved: false,
		fullPoseGlbBrowserRerun: false,
	};
}
if (process.argv[2] === "--check") {
	assert.equal(process.argv.length, 3);
	console.log(JSON.stringify(verify()));
} else {
	assert.equal(process.argv[2], "--archive");
	assert.equal(process.argv.length, 4);
	const proof = process.argv[3];
	assert(/^\/private\/tmp\/bodyguard-neck-cdt\.[A-Za-z0-9]+$/.test(proof));
	assert.equal(realpathSync(proof), proof);
	const found = readdirSync(proof)
		.flatMap((name) => {
			const path = join(proof, name);
			assert(!lstatSync(path).isSymbolicLink());
			if (lstatSync(path).isDirectory()) {
				assert.equal(name, "render");
				return readdirSync(path).map((f) => `${name}/${f}`);
			}
			assert(lstatSync(path).isFile());
			return [name];
		})
		.sort();
	assert.deepEqual(found, names);
	assert.equal(sha(regular(input)), original);
	assert.equal(
		sha(regular(join(proof, "candidate-projected.blend"))),
		candidate,
	);
	if (existsSync(output)) {
		assert(
			lstatSync(output).isDirectory() && !lstatSync(output).isSymbolicLink(),
		);
		assert.deepEqual(readdirSync(output), ["README.md"]);
	} else mkdirSync(output);
	mkdirSync(join(output, "render"));
	const entries = [];
	for (const [file, bytes] of [
		...names.map((f) => [f, regular(join(proof, f))]),
		...helpers.map((h) => [`current-${h}`, regular(join(source, h))]),
	]) {
		const saved = compressed(file)
			? gzipSync(bytes, { level: 9, mtime: 0 })
			: bytes;
		const name = archiveName(file);
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
				input_sha256: original,
				candidate_sha256: candidate,
				partial_occipital_authoring_passed: true,
				independent_reopen_passed: true,
				appearance_approved: false,
				final_avatar_adopted: false,
				all_regions_authored: false,
				full_deformation_glb_browser_executed: false,
				actual_camera: false,
				stages_1_to_6_complete: false,
				source_capture:
					"Current unchanged executed sources archived after native execution; no pre-execution duplicate claimed",
				observed_native_runs: [
					{ name: "projected-constraints", exit: 0 },
					{ name: "private-annulus", exit: 0 },
					{ name: "author", exit: 0 },
					{ name: "reopen", exit: 0 },
					{ name: "ribbon-reopen", exit: 0 },
					{ name: "render", exit: 0 },
					{ name: "unchanged-negative", exit: 1 },
					{ name: "overwrite-negative", exit: 1 },
				],
				entries,
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	console.log(JSON.stringify(verify()));
}
