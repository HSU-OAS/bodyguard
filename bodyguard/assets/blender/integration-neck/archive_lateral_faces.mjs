// FR-A-02/03/08: preserve actual diagnostic failure/success; never adopt a model.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
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
	"../../../docs/review/avatar-neck-integration/lateral-faces",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const inputSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const initial = [
	"faces.json",
	"faces.log",
	"inspector-before-format.py.gz",
	"executed-inspect_lateral_faces.py.gz",
	"native-api.json",
	"native-api.log",
	"executed-inspect_native_faces_api.py.gz",
];
const native = [
	"faces.json",
	"faces.log",
	"reproduced-author.json",
	"executed-inspect_lateral_faces_native.py.gz",
];
const self = "archive_lateral_faces.mjs";
const saved = (name) => (name.endsWith(".gz") ? name : `${name}.gz`);
const names = [
	...initial.map((name) => `initial/${saved(name)}`),
	...native.map((name) => `native/${saved(name)}`),
	`executed-${self}.gz`,
].sort();
const flags = [
	"appearance_approved",
	"new_candidate_saved",
	"new_authoring_passed",
	"female_authoring_executed",
	"new_render_executed",
	"full_glb_pose_browser_executed",
	"actual_camera",
	"final_avatar_adopted",
	"stages_1_to_6_complete",
];
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
	directory(join(output, "initial"));
	directory(join(output, "native"));
	assert.equal(sha(regular(input)), inputSha);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, inputSha);
	assert.equal(manifest.initial_observed_exit, 1);
	assert.equal(manifest.api_probe_observed_exit, 0);
	assert([0, 1].includes(manifest.native_observed_exit));
	for (const flag of flags) assert.equal(manifest[flag], false);
	assert.deepEqual(manifest.entries.map((entry) => entry.file).sort(), names);
	for (const entry of manifest.entries) {
		assert(names.includes(entry.file) && entry.compressed === true);
		const bytes = regular(join(output, entry.file));
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(sha(gunzipSync(bytes)), entry.raw_sha256);
	}
	const read = (name) => gunzipSync(regular(join(output, name)));
	const json = (name) => JSON.parse(read(name));
	const failure = json("initial/faces.json.gz");
	assert(!failure.diagnostic_completed && !failure.candidate_saved_or_present);
	assert.equal(
		failure.failure,
		"AttributeError: 'int' object has no attribute 'cross'",
	);
	const api = json("initial/native-api.json.gz");
	assert(
		api.passed &&
			api.nonhuman_private_probe &&
			!api.model_or_rig_saved_or_modified,
	);
	assert.equal(api.blender, "5.1.1");
	assert.equal(api.native_triangulate_faces, 2);
	assert(
		api.tessellation_indices
			.flat()
			.every((value) => Number.isInteger(value) && value >= 0 && value < 4),
	);
	const diagnostic = json("native/faces.json.gz");
	assert.equal(
		diagnostic.diagnostic_completed,
		manifest.native_observed_exit === 0,
	);
	assert(diagnostic.diagnostic_only && !diagnostic.new_authoring_parameters);
	assert(
		!diagnostic.appearance_approved && !diagnostic.candidate_saved_or_present,
	);
	assert.equal(diagnostic.input_sha256, inputSha);
	const reproduced = json("native/reproduced-author.json.gz");
	assert(!reproduced.passed && !reproduced.saved_candidate);
	assert.equal(
		reproduced.failure,
		"AssertionError: Lateral folded faces remain",
	);
	assert.equal(reproduced.rows.length, 1);
	assert.equal(reproduced.rows[0].moved_points, 4939);
	assert.equal(reproduced.rows[0].after.selected_dihedral_above_90, 4);
	assert(reproduced.rows[0].outside_original_coordinates_exact);
	assert(
		reproduced.rows[0]
			.raw_skin_topology_rest_pose_world_PBR_history_hands_attributes_exact,
	);
	if (diagnostic.diagnostic_completed) {
		assert(
			diagnostic.source_file_unchanged &&
				diagnostic.female_body_rig_exact &&
				diagnostic.private_probes_source_exact,
		);
		for (const key of ["original", "rejected_state"]) {
			assert.equal(diagnostic[key].faces.length, 6);
			assert(
				diagnostic[key].faces.every(
					(face) => face.all_points_selected && !face.original_anterior_visible,
				),
			);
			assert(diagnostic[key].private_triangulation_probe.point_positions_exact);
			assert(
				diagnostic[key].private_triangulation_probe.source_body_not_written,
			);
		}
	}
	for (const [folder, helper] of [
		["initial", "inspect_lateral_faces.py"],
		["initial", "inspect_native_faces_api.py"],
		["native", "inspect_lateral_faces_native.py"],
	])
		assert.equal(
			sha(read(`${folder}/executed-${helper}.gz`)),
			sha(regular(join(source, helper))),
		);
	assert.equal(
		sha(read(`executed-${self}.gz`)),
		sha(regular(join(source, self))),
	);
	return {
		artifacts: 12,
		byteAuditOnly: true,
		nativeDiagnosticCompleted: diagnostic.diagnostic_completed,
		newAuthoringPassed: false,
		appearanceApproved: false,
		newCandidateSaved: false,
	};
}
if (process.argv[2] === "--check") {
	assert.equal(process.argv.length, 3);
	console.log(JSON.stringify(verify()));
} else {
	assert.equal(process.argv[2], "--archive");
	assert.equal(process.argv.length, 6);
	const [first, next, nativeExit] = process.argv.slice(3);
	assert(/^\/private\/tmp\/bodyguard-lateral-faces\.[A-Za-z0-9]+$/.test(first));
	assert(
		/^\/private\/tmp\/bodyguard-lateral-faces-native\.[A-Za-z0-9]+$/.test(next),
	);
	assert(
		["0", "1"].includes(nativeExit),
		"Observed completed process exit required",
	);
	for (const [path, expected] of [
		[first, initial],
		[next, native],
	]) {
		directory(path);
		assert.deepEqual(readdirSync(path).sort(), [...expected].sort());
	}
	mkdirSync(output); // Existing evidence folder must fail, never overwrite.
	const entries = [];
	for (const [file, bytes] of [
		...initial.map((name) => [
			`initial/${saved(name)}`,
			regular(join(first, name)),
			name.endsWith(".gz"),
		]),
		...native.map((name) => [
			`native/${saved(name)}`,
			regular(join(next, name)),
			name.endsWith(".gz"),
		]),
		[`executed-${self}.gz`, regular(join(source, self)), false],
	].map(([file, bytes, already]) => [
		file,
		already ? bytes : gzipSync(bytes, { level: 9, mtime: 0 }),
	])) {
		mkdirSync(dirname(join(output, file)), { recursive: true });
		writeFileSync(join(output, file), bytes, { flag: "wx" });
		entries.push({
			file,
			compressed: true,
			bytes: bytes.length,
			sha256: sha(bytes),
			raw_sha256: sha(gunzipSync(bytes)),
		});
	}
	writeFileSync(
		join(output, "manifest.json"),
		`${JSON.stringify(
			{
				input_sha256: inputSha,
				initial_observed_exit: 1,
				api_probe_observed_exit: 0,
				native_observed_exit: Number(nativeExit),
				...Object.fromEntries(flags.map((flag) => [flag, false])),
				entries,
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	console.log(JSON.stringify(verify()));
}
