// FR-A-02/03/08: preserve failed native authoring; byte audit is not a rerun.
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
	"docs/review/avatar-neck-integration/segmented-attempt",
);
const input = join(
	root,
	"docs/review/avatar-neck-integration/candidate-unapproved.blend",
);
const expected =
	"ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const mode = process.argv[2];
const views = ["male", "female"].flatMap((gender) =>
	["back", "side", "quarter", "front"].map((view) => `${gender}-${view}.png`),
);
assert.equal(sha(readFileSync(input)), expected);

function check() {
	const manifest = JSON.parse(readFileSync(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, expected);
	assert.equal(manifest.entries.length, 42);
	for (const key of [
		"authoring_passed",
		"candidate_saved",
		"appearance_approved",
		"final_avatar_adopted",
		"stages_1_to_6_complete",
		"actual_camera",
		"female_authoring_executed",
		"independent_reopen_executed",
		"full_deformation_glb_browser_executed",
	])
		assert.equal(manifest[key], false);
	for (const entry of manifest.entries) {
		assert(!entry.file.includes("..") && !entry.file.startsWith("/"));
		assert(lstatSync(join(output, entry.file)).isFile());
		const bytes = readFileSync(join(output, entry.file));
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(
			sha(entry.compressed ? gunzipSync(bytes) : bytes),
			entry.raw_sha256,
		);
	}
	const read = (file) =>
		JSON.parse(gunzipSync(readFileSync(join(output, `${file}.gz`))));
	for (const file of ["segments.json", "segments-body-space.json"]) {
		const report = read(file);
		assert.equal(report.input_sha256, expected);
		assert(report.read_only && !report.camera_data);
		assert.equal(report.rows.length, 2);
	}
	for (const file of [
		"author-occipital.json",
		"diagnostic-author.json",
		"author-simple.json",
		"layout-diagnostic.json",
		"author-ribbon.json",
	]) {
		const report = read(file);
		assert.equal(report.input_sha256, expected);
		assert.equal(report.passed, false);
		assert.equal(report.appearance_approved, false);
		assert.equal(report.clinical_or_camera_work, false);
		assert.equal(report.rows.length, 0);
		assert.equal(report.last_grid.gender, "Male");
		assert(report.failure);
	}
	const ribbon = read("author-ribbon.json");
	assert.deepEqual(ribbon.last_grid.original_side_intervals, [36, 89, 38, 55]);
	assert.deepEqual(ribbon.last_grid.inner_side_intervals, [36, 55, 36, 55]);
	assert.deepEqual(ribbon.last_grid.actual_native_corner_tags, [0, 0, 1, 3]);
	const native = read("native-api.json");
	assert(
		native.read_only && !native.geometry_modified && !native.candidate_saved,
	);
	assert(!native.two_explicit_open_boundaries_authoring_executed);
	const diagnostic = read("diagnostic-result.json");
	assert(
		diagnostic.diagnostic_neutral_render_only && !diagnostic.candidate_saved,
	);
	assert(
		!diagnostic.authoring_passed &&
			!diagnostic.full_deformation_glb_browser_executed,
	);
	assert.deepEqual(read("diagnostic-render/render.json").views, views);
	assert.equal(
		sha(gunzipSync(readFileSync(join(output, "author-ribbon-executed.py.gz")))),
		sha(readFileSync(join(source, "author_segmented_patch.py"))),
	);
	assert.equal(sha(readFileSync(input)), expected);
	return {
		artifacts: manifest.entries.length,
		byteAuditOnly: true,
		authoringPassed: false,
		candidateSaved: false,
		diagnosticRenders: 8,
		newModelVerificationRerun: false,
	};
}

if (mode === "--check") {
	assert.equal(process.argv.length, 3);
	console.log(JSON.stringify(check()));
} else {
	assert.equal(mode, "--archive");
	assert.equal(process.argv.length, 4);
	const proof = process.argv[3];
	assert(/^\/private\/tmp\/bodyguard-neck-segments\.[A-Za-z0-9]+$/.test(proof));
	assert.equal(realpathSync(proof), proof);
	assert(lstatSync(proof).isDirectory());
	const names = [
		"inspect-executed.py",
		"inspect.log",
		"segments.json",
		"inspect-space-executed.py",
		"inspect-space.log",
		"segments-body-space.json",
		"author-occipital-executed.py",
		"author-occipital.json",
		"author-occipital.log",
		"render-failed-executed.py",
		"diagnostic-author.json",
		"diagnostic-render.log",
		"diagnostic-result.json",
		"author-simple-executed.py",
		"author-simple.json",
		"author-simple.log",
		"author-layout-diagnostic-executed.py",
		"layout-diagnostic.json",
		"layout-diagnostic.log",
		"author-ribbon-executed.py",
		"author-ribbon.json",
		"author-ribbon.log",
		"native-api-executed.py",
		"native-api.json",
		"native-api.log",
		"diagnostic-render/render.json",
		...views.map((file) => `diagnostic-render/${file}`),
	].sort();
	const actual = readdirSync(proof)
		.flatMap((name) => {
			const path = join(proof, name);
			assert(!lstatSync(path).isSymbolicLink());
			if (lstatSync(path).isDirectory()) {
				assert.equal(name, "diagnostic-render");
				return readdirSync(path).map((file) => `${name}/${file}`);
			}
			assert(lstatSync(path).isFile());
			return [name];
		})
		.sort();
	assert.deepEqual(actual, names);
	assert(
		!actual.some((file) => file.endsWith(".blend") || file.endsWith(".glb")),
	);
	for (const run of [
		"author-occipital",
		"author-simple",
		"layout-diagnostic",
		"author-ribbon",
	]) {
		const report = JSON.parse(readFileSync(join(proof, `${run}.json`)));
		assert(
			!report.passed && report.input_sha256 === expected && report.failure,
		);
		assert(
			readFileSync(join(proof, `${run}.log`), "utf8").includes(
				"Error: script failed",
			),
		);
	}
	assert(
		readFileSync(join(proof, "diagnostic-render.log"), "utf8").includes(
			"Error: script failed",
		),
	);
	for (const log of ["inspect.log", "inspect-space.log", "native-api.log"]) {
		assert(
			!readFileSync(join(proof, log), "utf8").includes("Error: script failed"),
		);
		assert(readFileSync(join(proof, log), "utf8").includes("Blender quit"));
	}
	if (existsSync(output)) assert.deepEqual(readdirSync(output), ["README.md"]);
	else mkdirSync(output);
	const entries = [];
	function save(file, bytes) {
		assert(
			/^(diagnostic-render\/)?[a-z0-9_.-]+\.(json|log|py|mjs|png)$/.test(file),
		);
		const compressed = !file.endsWith(".png");
		const stored = compressed ? gzipSync(bytes, { level: 9, mtime: 0 }) : bytes;
		const name = compressed ? `${file}.gz` : file;
		writeFileSync(join(output, name), stored, { flag: "wx" });
		entries.push({
			file: name,
			compressed,
			bytes: stored.length,
			sha256: sha(stored),
			raw_sha256: sha(bytes),
		});
	}
	mkdirSync(join(output, "diagnostic-render"));
	for (const file of names) save(file, readFileSync(join(proof, file)));
	for (const file of [
		"author_segmented_patch.py",
		"inspect_segments.py",
		"render_failed_segment.py",
		"artist_snapshot_values.py",
		"render_comparison.py",
		"archive_segment_attempt.mjs",
		"author_quad_patch.py",
		"inspect_segment_api.py",
	])
		save(`current-${file}`, readFileSync(join(source, file)));
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
				stages_1_to_6_complete: false,
				actual_camera: false,
				female_authoring_executed: false,
				independent_reopen_executed: false,
				full_deformation_glb_browser_executed: false,
				diagnostic_renders: {
					executed: true,
					count: 8,
					male: "rejected curvature state before skin/remap",
					female: "unchanged source control; no authoring pass",
					native_process_exit: 1,
				},
				observed_runs: [
					{
						name: "inspect",
						native_process_exit: 0,
						read_only: true,
						correct_body_space: false,
					},
					{
						name: "inspect-space",
						native_process_exit: 0,
						read_only: true,
						correct_body_space: true,
					},
					{
						name: "native-api",
						native_process_exit: 0,
						read_only: true,
						authoring_executed: false,
					},
					...[
						"author-occipital",
						"author-simple",
						"layout-diagnostic",
						"author-ribbon",
					].map((name) => ({ name, native_process_exit: 1, passed: false })),
				],
				entries,
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	console.log(JSON.stringify(check()));
}
