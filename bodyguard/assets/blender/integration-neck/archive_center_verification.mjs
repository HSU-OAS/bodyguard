// FR-A-02/03/08: preserve independently executed QA, never approve appearance.
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
const review = resolve(source, "../../../docs/review/avatar-neck-integration");
const output = join(review, "lower-verification");
const input = join(review, "projected-attempt/candidate-projected.blend");
const candidate = join(review, "lower-attempt/candidate-neck-center.blend");
const inputSha =
	"2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394";
const candidateSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const views = ["male", "female"].flatMap((gender) =>
	["back", "side", "quarter", "front"].map((view) => `${gender}-${view}.png`),
);
const raw = [
	["reopen.json", "reopen.json"],
	["reopen.log", "reopen.log"],
	["render.log", "render.log"],
	["render/render.json", "render.json"],
	...views.map((name) => [`render/${name}`, name]),
];
const helpers = [
	"reopen_neck_center.py",
	"artist_snapshot_values.py",
	"surface_visibility.py",
	"render_comparison.py",
	"archive_center_verification.mjs",
];
const falseFlags = [
	"appearance_approved",
	"all_regions_authored",
	"full_deformation_glb_browser_executed",
	"actual_camera",
	"final_avatar_adopted",
	"stages_1_to_6_complete",
];
const compressed = (name) => !name.endsWith(".png");
const archived = (name) => (compressed(name) ? `${name}.gz` : name);
const savedNames = [
	...raw.map(([, name]) => name),
	...helpers.map((name) => `executed-${name}`),
]
	.map(archived)
	.sort();
assert.equal(savedNames.length, 17);

function regular(path) {
	assert(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
	return readFileSync(path);
}
function directory(path) {
	assert(lstatSync(path).isDirectory() && !lstatSync(path).isSymbolicLink());
	assert.equal(realpathSync(path), path);
}
function verify() {
	directory(output);
	assert.equal(sha(regular(input)), inputSha);
	assert.equal(sha(regular(candidate)), candidateSha);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, inputSha);
	assert.equal(manifest.candidate_sha256, candidateSha);
	assert.equal(manifest.independent_reopen_executed, true);
	assert.equal(manifest.independent_reopen_passed, true);
	assert.equal(manifest.native_render_executed, true);
	assert.equal(manifest.automatic_approval_passed_normally, true);
	assert.equal(manifest.approval_bypassed, false);
	assert.equal(manifest.inspected_native_previews, 8);
	assert.equal(manifest.visual_comparison_previous_previews, 2);
	assert.deepEqual(manifest.observed_native_runs, [
		{ name: "independent-reopen", exit: 0 },
		{ name: "native-render", exit: 0 },
	]);
	for (const flag of falseFlags) assert.equal(manifest[flag], false);
	assert.deepEqual(
		manifest.entries.map((entry) => entry.file).sort(),
		savedNames,
	);
	for (const entry of manifest.entries) {
		assert(savedNames.includes(entry.file));
		assert.equal(entry.compressed, entry.file.endsWith(".gz"));
		const bytes = regular(join(output, entry.file));
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(
			sha(entry.compressed ? gunzipSync(bytes) : bytes),
			entry.raw_sha256,
		);
	}
	const read = (name) => {
		const bytes = regular(join(output, archived(name)));
		return compressed(name) ? gunzipSync(bytes) : bytes;
	};
	const reopen = JSON.parse(read("reopen.json"));
	assert(reopen.passed && reopen.independent_reopen);
	assert.equal(reopen.blender, "5.1.1");
	assert.equal(reopen.input_sha256, inputSha);
	assert.equal(reopen.candidate_sha256, candidateSha);
	for (const flag of [
		"appearance_approved",
		"clinical_or_camera_work",
		"source_saved_or_modified",
		"full_deformation_glb_browser_executed",
	])
		assert.equal(reopen[flag], false);
	assert.deepEqual(
		reopen.rows.map((row) => row.gender),
		["Male", "Female"],
	);
	assert.deepEqual(
		reopen.rows.map((row) => row.new_points),
		[1470, 1152],
	);
	for (const row of reopen.rows) {
		assert(row.outside_coordinates_raw_skin_polygons_exact);
		assert(row.rest_rig_world_material_history_front_hands_exact);
		assert(row.previous_point_integer_attributes_exact);
		assert(row.actual_anterior_visible_faces_protected > 97000);
		assert(row.maximum_surface_distance_m < 0.006);
		assert.equal(row.geometry.nonmanifold, 0);
		assert.equal(row.geometry.winding, 0);
	}
	assert.deepEqual(
		reopen.rows.map((row) => row.geometry.tiny_faces),
		[2, 0],
	);
	const render = JSON.parse(read("render.json"));
	assert.equal(render.blender, "5.1.1");
	assert.equal(render.samples, 32);
	assert.deepEqual(render.views, views);
	assert(render.same_source_material_world_lights);
	assert.equal(render.appearance_approved, false);
	for (const name of views) {
		const bytes = read(name);
		assert(bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")));
		assert.equal(bytes.readUInt32BE(16), 600);
		assert.equal(bytes.readUInt32BE(20), 700);
		assert(read("render.log").toString().includes(`/render/${name}'`));
	}
	for (const name of ["reopen.log", "render.log"]) {
		assert(read(name).toString().includes("Blender quit"));
		assert(!read(name).toString().includes("Error: script failed"));
	}
	for (const helper of helpers) {
		assert.equal(
			sha(read(`executed-${helper}`)),
			sha(regular(join(source, helper))),
		);
		if (helper !== "archive_center_verification.mjs") {
			// The earlier checkpoint captured these same helpers before this QA run.
			assert.equal(
				sha(read(`executed-${helper}`)),
				sha(
					gunzipSync(
						regular(join(review, "lower-attempt", `current-${helper}.gz`)),
					),
				),
			);
		}
	}
	return {
		artifacts: 17,
		byteAuditOnly: true,
		independentReopenPassed: true,
		actualPreviews: 8,
		appearanceApproved: false,
		fullDeformationGlbBrowser: "not executed",
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
		/^\/private\/tmp\/bodyguard-neck-center-qa\.[A-Za-z0-9]+$/.test(proof),
	);
	directory(proof);
	directory(join(proof, "render"));
	assert.deepEqual(readdirSync(proof).sort(), [
		"render",
		"render.log",
		"reopen.json",
		"reopen.log",
	]);
	assert.deepEqual(
		readdirSync(join(proof, "render")).sort(),
		[...views, "render.json"].sort(),
	);
	directory(review);
	if (existsSync(output)) {
		directory(output);
		assert.deepEqual(readdirSync(output), ["README.md"]);
	} else mkdirSync(output);
	const entries = [];
	for (const [name, bytes] of [
		...raw.map(([path, name]) => [name, regular(join(proof, path))]),
		...helpers.map((name) => [`executed-${name}`, regular(join(source, name))]),
	]) {
		const saved = compressed(name)
			? gzipSync(bytes, { level: 9, mtime: 0 })
			: bytes;
		const file = archived(name);
		writeFileSync(join(output, file), saved, { flag: "wx" });
		entries.push({
			file,
			compressed: compressed(name),
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
				independent_reopen_executed: true,
				independent_reopen_passed: true,
				native_render_executed: true,
				automatic_approval_passed_normally: true,
				approval_bypassed: false,
				inspected_native_previews: 8,
				visual_comparison_previous_previews: 2,
				...Object.fromEntries(falseFlags.map((flag) => [flag, false])),
				observed_native_runs: [
					{ name: "independent-reopen", exit: 0 },
					{ name: "native-render", exit: 0 },
				],
				source_capture:
					"Executed native helpers are unchanged from the earlier lower-attempt checkpoint; their exact copies are preserved after these observed runs. The new archive helper does not execute native QA.",
				appearance_result:
					"P2 remains: posterior lower neck and shoulders are rough; the small central patch does not establish whole-avatar visual improvement.",
				entries,
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	console.log(JSON.stringify(verify()));
}
