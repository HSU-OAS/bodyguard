// FR-A-02/03/08: preserve actual rejected native ribbons and read-only diagnostics.
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
const root = resolve(source, "../../..");
const output = join(root, "docs/review/avatar-neck-integration/ribbon-attempt");
const input = join(
	root,
	"docs/review/avatar-neck-integration/candidate-unapproved.blend",
);
const original =
	"ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const names = [
	"author.json",
	"author.log",
	"author_sectioned_clear_band-executed.py",
	"author_sectioned_domain-executed.py",
	"author_sectioned_interior-executed.py",
	"author_sectioned_ribbon-executed.py",
	"blender-v5.1.1-bmo_bridge.cc",
	"clear-band-author.json",
	"clear-band-author.log",
	"clear-diagnostic-author.json",
	"clear-diagnostic-result.json",
	"clear-diagnostic.log",
	"diagnose_sectioned_ribbon-executed.py",
	"diagnostic-author.json",
	"diagnostic.json",
	"diagnostic.log",
	"domain-author.json",
	"domain-author.log",
	"domain-inspection-final.json",
	"domain-inspection-final.log",
	"domain-inspection.json",
	"domain-inspection.log",
	"inspect_patch_domain-executed.py",
	"inspect_patch_domain-final-executed.py",
	"interior-author.json",
	"interior-author.log",
	"native-domain-fill-probe.json",
	"native-domain-fill-probe.log",
	"native-open-path-final.json",
	"native-open-path-final.log",
	"native-open-path-probe.json",
	"native-open-path-probe.log",
	"probe_domain_fill-executed.py",
	"probe_ribbon_bridge-executed.py",
	"render-clear-failure/female-back.png",
	"render-clear-failure/female-front.png",
	"render-clear-failure/female-quarter.png",
	"render-clear-failure/female-side.png",
	"render-clear-failure/male-back.png",
	"render-clear-failure/male-front.png",
	"render-clear-failure/male-quarter.png",
	"render-clear-failure/male-side.png",
	"render-clear-failure/render.json",
	"render-failure/female-back.png",
	"render-failure/female-front.png",
	"render-failure/female-quarter.png",
	"render-failure/female-side.png",
	"render-failure/male-back.png",
	"render-failure/male-front.png",
	"render-failure/male-quarter.png",
	"render-failure/male-side.png",
	"render-failure/render.json",
	"render_clear_band_failure-executed.py",
	"render_comparison-executed.py",
];
const helpers = [
	"author_sectioned_ribbon.py",
	"author_sectioned_domain.py",
	"author_sectioned_interior.py",
	"author_sectioned_clear_band.py",
	"probe_ribbon_bridge.py",
	"probe_domain_fill.py",
	"diagnose_sectioned_ribbon.py",
	"inspect_patch_domain.py",
	"render_clear_band_failure.py",
	"render_comparison.py",
	"artist_snapshot_values.py",
	"archive_ribbon_attempt.mjs",
];
const compressed = (file) => !file.endsWith(".png");
const saved = (file) => (compressed(file) ? file + ".gz" : file);
const expected = [...names, ...helpers.map((file) => "current-" + file)]
	.map(saved)
	.sort();
const flags = [
	"authoring_passed",
	"candidate_saved",
	"appearance_approved",
	"final_avatar_adopted",
	"female_authored",
	"full_deformation_glb_browser_executed",
	"actual_camera",
	"stages_1_to_6_complete",
];
const observed = [
	{ name: "native-open-path-probe", exit: 0 },
	{ name: "native-open-path-final", exit: 0 },
	{ name: "author", exit: 1 },
	{ name: "diagnostic", exit: 1 },
	{ name: "native-domain-fill-probe", exit: 0 },
	{ name: "domain-author", exit: 1 },
	{ name: "interior-author", exit: 1 },
	{ name: "domain-inspection", exit: 0 },
	{ name: "domain-inspection-final", exit: 0 },
	{ name: "clear-band-author", exit: 1 },
	{ name: "clear-diagnostic", exit: 1 },
];

function regular(path) {
	assert(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
	return readFileSync(path);
}
function verify() {
	assert.equal(sha(regular(input)), original);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, original);
	for (const flag of flags) assert.equal(manifest[flag], false);
	assert.deepEqual(manifest.observed_native_runs, observed);
	assert.deepEqual(
		manifest.entries.map((entry) => entry.file).sort(),
		expected,
	);
	for (const entry of manifest.entries) {
		assert(expected.includes(entry.file));
		const bytes = regular(join(output, entry.file));
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(
			sha(entry.compressed ? gunzipSync(bytes) : bytes),
			entry.raw_sha256,
		);
	}
	const raw = (file) => {
		const bytes = regular(join(output, saved(file)));
		return compressed(file) ? gunzipSync(bytes) : bytes;
	};
	const json = (file) => JSON.parse(raw(file));
	for (const file of [
		"author.json",
		"domain-author.json",
		"interior-author.json",
		"clear-band-author.json",
		"diagnostic-author.json",
		"clear-diagnostic-author.json",
	]) {
		const report = json(file);
		assert.equal(report.input_sha256, original);
		assert.equal(report.blender, "5.1.1");
		assert.equal(report.passed, false);
		assert.equal(report.appearance_approved, false);
		assert.equal(report.clinical_or_camera_work, false);
		assert.deepEqual(report.rows, []);
		assert(!report.output_sha256);
	}
	assert(
		json("author.json").failure.includes(
			"New ribbon has an inward-facing projected face",
		),
	);
	assert(
		json("domain-author.json").failure.includes(
			"Original projected row is not a single interval",
		),
	);
	assert(
		json("interior-author.json").failure.includes(
			"Original projected row has no unique central interior",
		),
	);
	assert(
		json("clear-band-author.json").failure.includes(
			"New patch leaves the original projected interior",
		),
	);
	assert.deepEqual(
		json("author.json").last_grid.actual_native_corner_tags,
		[1, 2, 3, 4],
	);
	assert.equal(
		json("author.json").last_grid.ribbon_geometry.negative_y_faces,
		68,
	);
	assert.equal(
		json("author.json").last_grid.ribbon_geometry.candidate_multiple_hits,
		118,
	);
	assert.equal(
		json("diagnostic.json").new_points_outside_original_xz_polygon,
		19,
	);
	assert(json("diagnostic.json").female_unchanged_control);
	const last = json("clear-band-author.json").last_grid;
	assert.equal(last.ribbon_geometry.new_points_outside_original_projection, 0);
	assert.equal(
		last.ribbon_geometry.new_face_centers_outside_original_projection,
		4,
	);
	assert.equal(last.ribbon_geometry.negative_y_faces, 12);
	assert.equal(last.ribbon_geometry.candidate_multiple_hits, 48);
	assert.equal(last.ribbon_geometry.original_multiple_hits, 0);
	assert.equal(last.geometry_diagnostic.points_exceeding_6mm, 0);
	const read = json("domain-inspection-final.json");
	assert(
		read.read_only_scene &&
			!read.model_authored_or_saved &&
			!read.appearance_approved &&
			!read.clinical_or_camera_data,
	);
	assert.deepEqual(
		read.rows.map((row) => row.gender),
		["Male", "Female"],
	);
	assert.deepEqual(
		read.rows.map((row) => row.old_rows_missing_central_interior),
		[1, 0],
	);
	assert(
		read.rows.every(
			(row) => row.clear_band_rows_missing_central_interior === 0,
		),
	);
	assert.deepEqual(json("domain-inspection.json"), read);
	for (const file of [
		"native-open-path-final.json",
		"native-domain-fill-probe.json",
	])
		assert(json(file).passed);
	assert(json("native-domain-fill-probe.json").inner_hole_preserved);
	assert(json("native-domain-fill-probe.json").input_points_exact);
	assert.equal(json("native-domain-fill-probe.json").scene_saved, false);
	const result = json("clear-diagnostic-result.json");
	assert.equal(result.candidate_saved, false);
	assert.equal(result.authoring_passed, false);
	assert.equal(result.full_deformation_glb_browser_executed, false);
	assert.equal(result.final_avatar_adopted, false);
	assert(result.female.includes("unchanged source control"));
	const views = ["male", "female"].flatMap((g) =>
		["back", "side", "quarter", "front"].map((v) => g + "-" + v + ".png"),
	);
	for (const folder of ["render-failure", "render-clear-failure"]) {
		const report = json(folder + "/render.json");
		assert.equal(report.appearance_approved, false);
		assert.equal(report.blender, "5.1.1");
		assert.deepEqual(report.views, views);
	}
	for (const run of observed) {
		const log = raw(run.name + ".log").toString("utf8");
		assert.equal(log.includes("Error: script failed"), run.exit === 1);
	}
	for (const [executed, helper] of [
		["author_sectioned_ribbon-executed.py", "author_sectioned_ribbon.py"],
		["author_sectioned_domain-executed.py", "author_sectioned_domain.py"],
		["author_sectioned_interior-executed.py", "author_sectioned_interior.py"],
		[
			"author_sectioned_clear_band-executed.py",
			"author_sectioned_clear_band.py",
		],
		["probe_ribbon_bridge-executed.py", "probe_ribbon_bridge.py"],
		["probe_domain_fill-executed.py", "probe_domain_fill.py"],
		["diagnose_sectioned_ribbon-executed.py", "diagnose_sectioned_ribbon.py"],
		["inspect_patch_domain-final-executed.py", "inspect_patch_domain.py"],
		["render_clear_band_failure-executed.py", "render_clear_band_failure.py"],
		["render_comparison-executed.py", "render_comparison.py"],
	])
		assert.equal(sha(raw(executed)), sha(regular(join(source, helper))));
	for (const helper of helpers)
		assert.equal(
			sha(raw("current-" + helper)),
			sha(regular(join(source, helper))),
		);
	assert(
		raw("blender-v5.1.1-bmo_bridge.cc")
			.toString("utf8")
			.includes("SPDX-License-Identifier: GPL-2.0-or-later"),
	);
	return {
		artifacts: expected.length,
		byteAuditOnly: true,
		authoringPassed: false,
		newModelSaved: false,
		actualDiagnosticPreviews: 16,
		appearanceApproved: false,
		fullPoseGlbBrowserExecuted: false,
	};
}
if (process.argv[2] === "--check") {
	assert.equal(process.argv.length, 3);
	console.log(JSON.stringify(verify()));
} else {
	assert.equal(process.argv[2], "--archive");
	assert.equal(process.argv.length, 4);
	const proof = process.argv[3];
	assert(/^\/private\/tmp\/bodyguard-neck-ribbon\.[A-Za-z0-9]+$/.test(proof));
	assert.equal(realpathSync(proof), proof);
	const found = readdirSync(proof)
		.flatMap((name) => {
			const path = join(proof, name);
			assert(!lstatSync(path).isSymbolicLink());
			if (lstatSync(path).isDirectory()) {
				assert(["render-failure", "render-clear-failure"].includes(name));
				return readdirSync(path).map((file) => name + "/" + file);
			}
			assert(lstatSync(path).isFile());
			return [name];
		})
		.sort();
	assert.deepEqual(found, names);
	assert(!names.some((file) => file.endsWith(".blend")));
	assert.equal(sha(regular(input)), original);
	if (existsSync(output)) {
		assert(
			lstatSync(output).isDirectory() && !lstatSync(output).isSymbolicLink(),
		);
		assert.deepEqual(readdirSync(output), ["README.md"]);
	} else mkdirSync(output);
	for (const folder of ["render-failure", "render-clear-failure"])
		mkdirSync(join(output, folder));
	const entries = [];
	for (const [file, bytes] of [
		...names.map((file) => [file, regular(join(proof, file))]),
		...helpers.map((helper) => [
			"current-" + helper,
			regular(join(source, helper)),
		]),
	]) {
		const compressedFile = compressed(file);
		const bytesOut = compressedFile
			? gzipSync(bytes, { level: 9, mtime: 0 })
			: bytes;
		writeFileSync(join(output, saved(file)), bytesOut, { flag: "wx" });
		entries.push({
			file: saved(file),
			compressed: compressedFile,
			bytes: bytesOut.length,
			sha256: sha(bytesOut),
			raw_sha256: sha(bytes),
		});
	}
	writeFileSync(
		join(output, "manifest.json"),
		JSON.stringify(
			{
				input_sha256: original,
				...Object.fromEntries(flags.map((flag) => [flag, false])),
				observed_native_runs: observed,
				standalone_probe_not_avatar_authoring: true,
				actual_diagnostic_previews: 16,
				source_coordinate_data_is_professional_asset_not_person: true,
				official_source_provenance: {
					url: "https://github.com/blender/blender/blob/v5.1.1/source/blender/bmesh/operators/bmo_bridge.cc",
					license: "GPL-2.0-or-later",
					used_as_read_only_reference_not_runtime_code: true,
				},
				entries,
			},
			null,
			2,
		) + "\n",
		{ flag: "wx" },
	);
	console.log(JSON.stringify(verify()));
}
