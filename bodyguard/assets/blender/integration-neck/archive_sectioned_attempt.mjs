// FR-A-02/03/08: preserve partial native success and observed appearance failure.
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
const output = join(
	root,
	"docs/review/avatar-neck-integration/sectioned-attempt",
);
const input = join(
	root,
	"docs/review/avatar-neck-integration/candidate-unapproved.blend",
);
const original =
	"ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b";
const candidate =
	"7481c5f87f9d4de987f1b8999367b070b1c42b53467bbb4d9dbcdab4b306885a";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const views = ["male", "female"].flatMap((gender) =>
	["back", "side", "quarter", "front"].map((view) => `${gender}-${view}.png`),
);
const names = [
	"author-executed.py",
	"author.json",
	"author.log",
	"candidate-occipital.blend",
	"render-executed.py",
	"render.log",
	"reopen-executed.py",
	"reopen.json",
	"reopen.log",
	"ribbon-inspection-executed.py",
	"ribbon.json",
	"ribbon.log",
	"unchanged-negative.json",
	"unchanged-negative.log",
	"overwrite-negative.log",
	"render/render.json",
	...views.map((view) => `render/${view}`),
].sort();
const helpers = [
	"author_sectioned_patch.py",
	"reopen_sectioned_patch.py",
	"inspect_sectioned_ribbon.py",
	"artist_snapshot_values.py",
	"render_comparison.py",
	"archive_sectioned_attempt.mjs",
];
const compressed = (file) => !file.endsWith(".blend") && !file.endsWith(".png");
const archiveName = (file) => (compressed(file) ? `${file}.gz` : file);
const savedNames = [...names, ...helpers.map((helper) => `current-${helper}`)]
	.map(archiveName)
	.sort();
assert.equal(savedNames.length, 30);

function regular(path) {
	assert(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
	return readFileSync(path);
}

function verify() {
	assert.equal(sha(regular(input)), original);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, original);
	assert.equal(manifest.candidate_sha256, candidate);
	assert.equal(manifest.partial_occipital_authoring_passed, true);
	assert.equal(manifest.independent_reopen_passed, true);
	for (const field of [
		"appearance_approved",
		"final_avatar_adopted",
		"all_regions_authored",
		"full_deformation_glb_browser_executed",
		"actual_camera",
		"stages_1_to_6_complete",
	])
		assert.equal(manifest[field], false);
	assert.deepEqual(
		manifest.entries.map((entry) => entry.file).sort(),
		savedNames,
	);
	for (const entry of manifest.entries) {
		assert(savedNames.includes(entry.file));
		const bytes = regular(join(output, entry.file));
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(
			sha(entry.compressed ? gunzipSync(bytes) : bytes),
			entry.raw_sha256,
		);
	}
	const raw = (file) => {
		const bytes = regular(join(output, archiveName(file)));
		return compressed(file) ? gunzipSync(bytes) : bytes;
	};
	const json = (file) => JSON.parse(raw(file));
	assert.equal(sha(raw("candidate-occipital.blend")), candidate);
	const author = json("author.json"),
		reopened = json("reopen.json");
	assert(author.passed && reopened.passed && reopened.independent_reopen);
	assert.equal(author.input_sha256, original);
	assert.equal(author.output_sha256, candidate);
	assert.equal(reopened.candidate_sha256, candidate);
	for (const report of [author, reopened]) {
		assert.equal(report.blender, "5.1.1");
		assert.equal(report.appearance_approved, false);
		assert.equal(report.clinical_or_camera_work, false);
		assert.deepEqual(
			report.rows.map((row) => row.gender),
			["Male", "Female"],
		);
		assert(
			report.rows.every(
				(row) => row.outside_coordinates_raw_skin_polygons_exact,
			),
		);
	}
	assert.equal(author.rows[0].native_section_guides.length, 37);
	assert.equal(author.rows[1].native_section_guides.length, 32);
	for (const row of author.rows) {
		assert(row.front_hands_preserved && row.rest_rig_world_material_exact);
		assert(row.maximum_surface_binding_distance_m < 0.006);
		assert(row.after.nonmanifold === 0 && row.after.winding === 0);
		assert(row.after.tiny_faces <= row.before.tiny_faces);
	}
	assert.equal(author.last_grid.geometry_diagnostic.core_wrong_facing_faces, 0);
	assert.equal(reopened.full_deformation_glb_browser_executed, false);
	assert(
		json("unchanged-negative.json").failure.includes(
			"Unchanged input cannot be a new candidate",
		),
	);
	assert.equal(json("unchanged-negative.json").passed, false);
	for (const log of ["unchanged-negative.log", "overwrite-negative.log"])
		assert(raw(log).toString("utf8").includes("Error: script failed"));
	for (const log of ["author.log", "reopen.log", "render.log", "ribbon.log"])
		assert(!raw(log).toString("utf8").includes("Error: script failed"));
	assert.deepEqual(json("render/render.json").views, views);
	const ribbon = json("ribbon.json");
	assert.equal(ribbon.input_sha256, original);
	assert.equal(ribbon.candidate_sha256, candidate);
	assert(
		ribbon.read_only_scene &&
			!ribbon.source_saved_or_modified &&
			!ribbon.appearance_approved &&
			!ribbon.clinical_or_camera_data,
	);
	assert.deepEqual(
		ribbon.rows.map((row) => row.candidate.multiple_rear_hits),
		[45, 44],
	);
	assert(ribbon.rows.every((row) => row.original.multiple_rear_hits === 0));
	for (const [file, helper] of [
		["author-executed.py", "author_sectioned_patch.py"],
		["reopen-executed.py", "reopen_sectioned_patch.py"],
		["ribbon-inspection-executed.py", "inspect_sectioned_ribbon.py"],
		["render-executed.py", "render_comparison.py"],
	])
		assert.equal(sha(raw(file)), sha(regular(join(source, helper))));
	for (const helper of helpers)
		assert.equal(
			sha(raw(`current-${helper}`)),
			sha(regular(join(source, helper))),
		);
	return {
		artifacts: 30,
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
	assert(
		/^\/private\/tmp\/bodyguard-neck-sectioned\.[A-Za-z0-9]+$/.test(proof),
	);
	assert.equal(realpathSync(proof), proof);
	const found = readdirSync(proof)
		.flatMap((name) => {
			const path = join(proof, name);
			assert(!lstatSync(path).isSymbolicLink());
			if (lstatSync(path).isDirectory()) {
				assert.equal(name, "render");
				return readdirSync(path).map((file) => `${name}/${file}`);
			}
			assert(lstatSync(path).isFile());
			return [name];
		})
		.sort();
	assert.deepEqual(found, names);
	assert.equal(sha(regular(input)), original);
	assert.equal(
		sha(regular(join(proof, "candidate-occipital.blend"))),
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
		...names.map((file) => [file, regular(join(proof, file))]),
		...helpers.map((helper) => [
			`current-${helper}`,
			regular(join(source, helper)),
		]),
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
				observed_runs: [
					{ name: "author", exit: 0 },
					{ name: "reopen", exit: 0 },
					{ name: "render", exit: 0 },
					{ name: "ribbon", exit: 0 },
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
