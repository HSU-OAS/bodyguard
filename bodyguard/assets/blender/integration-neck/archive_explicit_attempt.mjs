// FR-A-02/03/08: preserve failed native geometry; no model / browser rerun.
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
	"docs/review/avatar-neck-integration/explicit-attempt",
);
const input = join(
	root,
	"docs/review/avatar-neck-integration/candidate-unapproved.blend",
);
const expected =
	"ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b";
const sha = (data) => createHash("sha256").update(data).digest("hex");
const views = ["male", "female"].flatMap((gender) =>
	["back", "side", "quarter", "front"].map((view) => `${gender}-${view}.png`),
);
const folders = ["diagnostic-render", "curved-diagnostic-render"];
const names = [
	"author-executed.py",
	"author.json",
	"author.log",
	"diagnostic-author-executed.py",
	"diagnostic-wrapper-executed.py",
	"diagnostic-author.json",
	"diagnostic-render.log",
	"diagnostic-result.json",
	"curved-author-executed.py",
	"curved-author.json",
	"curved-author.log",
	"curved-diagnostic-author-executed.py",
	"curved-diagnostic-wrapper-executed.py",
	"curved-diagnostic-author.json",
	"curved-diagnostic-render.log",
	"curved-diagnostic-result.json",
	"mcp-observed.json",
	...folders.flatMap((folder) =>
		["render.json", ...views].map((file) => `${folder}/${file}`),
	),
].sort();
const helpers = [
	"author_explicit_patch.py",
	"author_curved_patch.py",
	"render_explicit_failure.py",
	"render_curved_failure.py",
	"artist_snapshot_values.py",
	"render_comparison.py",
	"archive_explicit_attempt.mjs",
];
assert.equal(names.length + helpers.length, 42);
assert.equal(sha(readFileSync(input)), expected);

function verify() {
	const manifest = JSON.parse(readFileSync(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, expected);
	assert.equal(manifest.entries.length, 42);
	assert.equal(new Set(manifest.entries.map((entry) => entry.file)).size, 42);
	for (const field of [
		"authoring_passed",
		"candidate_saved",
		"appearance_approved",
		"final_avatar_adopted",
		"female_authoring_executed",
		"actual_camera",
		"stages_1_to_6_complete",
		"independent_reopen_executed",
		"full_deformation_glb_browser_executed",
	])
		assert.equal(manifest[field], false);
	for (const entry of manifest.entries) {
		assert(!entry.file.startsWith("/") && !entry.file.includes(".."));
		const path = join(output, entry.file);
		assert(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
		const bytes = readFileSync(path);
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(
			sha(entry.compressed ? gunzipSync(bytes) : bytes),
			entry.raw_sha256,
		);
	}
	const raw = (file) => gunzipSync(readFileSync(join(output, `${file}.gz`)));
	const json = (file) => JSON.parse(raw(file));
	for (const file of [
		"author.json",
		"diagnostic-author.json",
		"curved-author.json",
		"curved-diagnostic-author.json",
	]) {
		const report = json(file);
		assert.equal(report.input_sha256, expected);
		assert.equal(report.blender, "5.1.1");
		assert(
			!report.passed &&
				!report.appearance_approved &&
				!report.clinical_or_camera_work,
		);
		assert.equal(report.last_grid.gender, "Male");
		assert.deepEqual(report.last_grid.actual_native_corner_tags, [1, 2, 3, 4]);
		assert.deepEqual(report.last_grid.explicit_open_boundary_edges, [36, 36]);
	}
	const simple = json("diagnostic-author.json");
	assert(simple.diagnostic_no_save && simple.rows.length === 0);
	assert(
		simple.last_grid.geometry_diagnostic.maximum_source_distance_m > 0.022,
	);
	assert.equal(simple.last_grid.geometry_diagnostic.points_exceeding_6mm, 1416);
	for (const file of ["curved-author.json", "curved-diagnostic-author.json"]) {
		const report = json(file);
		assert.equal(report.rows.length, 1);
		const row = report.rows[0];
		assert.equal(row.gender, "Male");
		assert(row.maximum_surface_binding_distance_m < 0.006);
		assert(
			row.outside_coordinates_raw_skin_polygons_exact &&
				row.front_hands_preserved &&
				row.rest_rig_world_material_exact,
		);
		assert.equal(row.before.tiny_faces, 2);
		assert.equal(row.after.tiny_faces, 3);
		assert.equal(row.after.nonmanifold, 0);
		assert.equal(row.after.winding, 0);
		assert.equal(
			report.last_grid.geometry_diagnostic.core_wrong_facing_faces,
			180,
		);
	}
	assert(json("curved-diagnostic-author.json").diagnostic_no_save);
	for (const [folder, file] of [
		["diagnostic-render", "diagnostic-result.json"],
		["curved-diagnostic-render", "curved-diagnostic-result.json"],
	]) {
		const result = json(file);
		assert.equal(result.source_sha256, expected);
		assert(
			result.diagnostic_neutral_render_only &&
				!result.authoring_passed &&
				!result.candidate_saved,
		);
		assert(
			!result.full_deformation_glb_browser_executed &&
				!result.appearance_approved,
		);
		assert.deepEqual(json(`${folder}/render.json`).views, views);
	}
	for (const [file, helper] of [
		["diagnostic-author-executed.py", "author_explicit_patch.py"],
		["curved-author-executed.py", "author_curved_patch.py"],
		["diagnostic-wrapper-executed.py", "render_explicit_failure.py"],
		["curved-diagnostic-wrapper-executed.py", "render_curved_failure.py"],
	])
		assert.equal(sha(raw(file)), sha(readFileSync(join(source, helper))));
	assert(
		json("mcp-observed.json").structuredContent.result.includes(
			"Could not connect to Blender",
		),
	);
	assert.equal(sha(readFileSync(input)), expected);
	return {
		artifacts: 42,
		byteAuditOnly: true,
		actualDiagnosticRenders: 16,
		authoringPassed: false,
		candidateSaved: false,
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
	assert(/^\/private\/tmp\/bodyguard-neck-explicit\.[A-Za-z0-9]+$/.test(proof));
	assert.equal(realpathSync(proof), proof);
	const actual = readdirSync(proof)
		.flatMap((name) => {
			const path = join(proof, name);
			assert(!lstatSync(path).isSymbolicLink());
			if (lstatSync(path).isDirectory()) {
				assert(folders.includes(name));
				return readdirSync(path).map((file) => `${name}/${file}`);
			}
			assert(lstatSync(path).isFile());
			return [name];
		})
		.sort();
	assert.deepEqual(actual, names);
	for (const file of actual)
		assert(
			lstatSync(join(proof, file)).isFile() &&
				!lstatSync(join(proof, file)).isSymbolicLink(),
		);
	for (const log of [
		"author.log",
		"diagnostic-render.log",
		"curved-author.log",
		"curved-diagnostic-render.log",
	])
		assert(
			readFileSync(join(proof, log), "utf8").includes("Error: script failed"),
		);
	if (existsSync(output)) assert.deepEqual(readdirSync(output), ["README.md"]);
	else mkdirSync(output);
	for (const folder of folders) mkdirSync(join(output, folder));
	const entries = [];
	function save(file, bytes) {
		assert(
			/^(curved-)?(diagnostic-render\/)?[a-z0-9_.-]+\.(json|log|py|mjs|png)$/.test(
				file,
			),
		);
		const compressed = !file.endsWith(".png");
		const saved = compressed ? gzipSync(bytes, { level: 9, mtime: 0 }) : bytes;
		const name = compressed ? `${file}.gz` : file;
		writeFileSync(join(output, name), saved, { flag: "wx" });
		entries.push({
			file: name,
			compressed,
			bytes: saved.length,
			sha256: sha(saved),
			raw_sha256: sha(bytes),
		});
	}
	for (const name of names) save(name, readFileSync(join(proof, name)));
	for (const name of helpers)
		save(`current-${name}`, readFileSync(join(source, name)));
	writeFileSync(
		join(output, "manifest.json"),
		`${JSON.stringify(
			{
				input_sha256: expected,
				native_blender: "5.1.1",
				authoring_passed: false,
				candidate_saved: false,
				appearance_approved: false,
				final_avatar_adopted: false,
				female_authoring_executed: false,
				actual_camera: false,
				stages_1_to_6_complete: false,
				independent_reopen_executed: false,
				full_deformation_glb_browser_executed: false,
				observed_runs: [
					"author",
					"diagnostic-render",
					"curved-author",
					"curved-diagnostic-render",
				].map((name) => ({ name, native_process_exit: 1, passed: false })),
				diagnostic_renders: {
					executed: true,
					count: 16,
					female: "unchanged source control",
					male_simple: "failed geometry before skin/remap",
					male_curved: "failed tiny-face guard after protected skin/remap",
				},
				entries,
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	console.log(JSON.stringify(verify()));
}
