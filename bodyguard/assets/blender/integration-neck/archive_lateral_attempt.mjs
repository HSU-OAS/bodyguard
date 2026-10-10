// FR-A-02/03/08: preserve rejected native authoring, never adopt a failed model.
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
	"../../../docs/review/avatar-neck-integration/lateral-attempt",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const inputSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stems = [
	"inspection",
	"author",
	"units",
	"units-observed",
	"author-private",
	"author-triangles",
	"diagnostic",
];
const helpers = [
	"author_lateral_finish.py",
	"lateral_contract.py",
	"lateral_domain.py",
	"inspect_lateral_quality.py",
	"artist_snapshot_values.py",
	"surface_visibility.py",
	"inspect_laplacian_units.py",
	"inspect_laplacian_units_observed.py",
	"author_lateral_private.py",
	"author_lateral_triangles.py",
	"diagnose_lateral_failure.py",
	"render_comparison.py",
];
const views = ["male", "female"].flatMap((gender) =>
	["back", "side", "quarter", "front"].map((view) => `${gender}-${view}.png`),
);
const names = [
	...stems.flatMap((stem) => [`${stem}.json`, `${stem}.log`]),
	"author-diagnostic.json",
	"lateral-contract-initial.py.gz",
	"native-source-observation.json",
	...helpers.map((helper) => `executed-${helper}.gz`),
	"failure-render/render.json",
	...views.map((view) => `failure-render/${view}`),
].sort();
assert.equal(names.length, 38);
const self = "archive_lateral_attempt.mjs";
const archived = (name) => (/\.(gz|png)$/.test(name) ? name : `${name}.gz`);
const savedNames = [...names, `executed-${self}`].map(archived).sort();
const nativeRuns = [
	{ name: "inspection", exit: 0 },
	{ name: "author", exit: 1 },
	{ name: "units", exit: 1 },
	{ name: "units-observed", exit: 0 },
	{ name: "author-private", exit: 1 },
	{ name: "author-triangles", exit: 1 },
	{ name: "diagnostic", exit: 0, authoring_passed: false },
];
const falseFlags = [
	"native_authoring_passed",
	"new_candidate_saved",
	"appearance_approved",
	"independent_reopen_executed",
	"full_deformation_glb_browser_executed",
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
	directory(join(output, "failure-render"));
	assert.equal(sha(regular(input)), inputSha);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, inputSha);
	assert.deepEqual(manifest.observed_native_runs, nativeRuns);
	assert.equal(manifest.actual_diagnostic_previews, 8);
	assert.equal(manifest.female_authoring_executed, false);
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
		return archived(name).endsWith(".gz") ? gunzipSync(bytes) : bytes;
	};
	const json = (name) => JSON.parse(read(name));
	const inspection = json("inspection.json");
	assert(inspection.inspection_completed && inspection.read_only_scene);
	assert(
		!inspection.model_authored_or_saved && !inspection.appearance_approved,
	);
	assert.equal(inspection.input_sha256, inputSha);
	assert.deepEqual(
		inspection.rows.map((row) => row.gender),
		["Male", "Female"],
	);
	assert.deepEqual(
		inspection.rows.map((row) => row.selected_points),
		[4964, 5589],
	);
	assert.deepEqual(
		inspection.rows.map((row) => row.dihedral_above_90_degrees),
		[14, 6],
	);
	for (const [stem, folds, moved] of [
		["author", 14, 76],
		["author-private", 5, 4941],
		["author-triangles", 4, 4939],
		["author-diagnostic", 4, 4939],
	]) {
		const report = json(`${stem}.json`);
		assert.equal(report.passed, false);
		assert.equal(report.saved_candidate, false);
		assert.equal(report.appearance_approved, false);
		assert.equal(report.clinical_or_camera_work, false);
		assert.equal(report.input_sha256, inputSha);
		assert.equal(report.failure, "AssertionError: Lateral folded faces remain");
		assert.deepEqual(
			report.rows.map((row) => row.gender),
			["Male"],
		);
		const row = report.rows[0];
		assert.equal(row.moved_points, moved);
		assert.equal(row.after.selected_dihedral_above_90, folds);
		assert(row.outside_original_coordinates_exact);
		assert(
			row.raw_skin_topology_rest_pose_world_PBR_history_hands_attributes_exact,
		);
		assert(row.maximum_displacement_m < 0.006);
		assert.equal(row.after.nonmanifold, 0);
		assert.equal(row.after.winding, 0);
		assert.equal(row.after.tiny_faces, 2);
	}
	assert.equal(json("units.json").inspection_completed, false);
	assert(
		json("units.json").failure.includes(
			"Observed movement does not match hypothesis",
		),
	);
	const observed = json("units-observed.json");
	assert(observed.inspection_completed && observed.read_only_scene);
	assert.deepEqual(
		observed.rows.map((row) =>
			row.native_unit_eligibility.map((value) => value.native_eligible),
		),
		[
			[77, 4908],
			[18, 5528],
		],
	);
	assert.equal(
		observed.rows[0].eligibility_equals_actual_movement_hypothesis,
		false,
	);
	assert(
		observed.rows.every(
			(row) =>
				row.source_body_rig_exact && !row.source_unit_or_model_change_executed,
		),
	);
	const diagnostic = json("diagnostic.json");
	assert(diagnostic.diagnostic_completed && diagnostic.diagnostic_only);
	assert(
		!diagnostic.authoring_passed && !diagnostic.candidate_saved_or_present,
	);
	assert.equal(diagnostic.actual_native_previews, 8);
	assert.equal(diagnostic.remaining_edges.length, 4);
	assert(diagnostic.male_is_failed_state_female_is_unchanged_input);
	const render = json("failure-render/render.json");
	assert.deepEqual(render.views, views);
	assert.equal(render.samples, 32);
	assert(
		render.same_source_material_world_lights && !render.appearance_approved,
	);
	for (const view of views) {
		const bytes = read(`failure-render/${view}`);
		assert(bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")));
		assert.equal(bytes.readUInt32BE(16), 600);
		assert.equal(bytes.readUInt32BE(20), 700);
	}
	const reference = json("native-source-observation.json");
	assert.equal(reference.official_ref, "b70da489d7f4");
	assert.equal(
		reference.git_blob_sha1,
		"04a8254675aa641bae39eb07ce95513dcce78344",
	);
	assert.equal(
		reference.source_sha256,
		"aa85424124a4bc4760ffdced29d3a4b90fbd51b40861366e6b0ab864a29075ca",
	);
	assert(
		!reference.full_external_source_distributed_in_repository &&
			!reference.source_executed_or_imported,
	);
	for (const helper of [...helpers, self])
		assert.equal(
			sha(read(`executed-${helper}${helper === self ? "" : ".gz"}`)),
			sha(regular(join(source, helper))),
		);
	for (const run of nativeRuns) {
		const log = read(`${run.name}.log`).toString();
		assert(log.includes("Blender quit"));
		if (run.exit === 1) assert(log.includes("Error: script failed"));
	}
	assert(
		read("diagnostic.log")
			.toString()
			.includes("failure-render/female-front.png"),
	);
	return {
		artifacts: 39,
		byteAuditOnly: true,
		nativeAuthoringPassed: false,
		newModelSaved: false,
		actualFailurePreviews: 8,
		appearanceApproved: false,
	};
}

if (process.argv[2] === "--check") {
	assert.equal(process.argv.length, 3);
	console.log(JSON.stringify(verify()));
} else {
	assert.equal(process.argv[2], "--archive");
	assert.equal(process.argv.length, 5);
	assert.equal(
		process.argv[4],
		"0",
		"Observed diagnostic process exit required",
	);
	const proof = process.argv[3];
	assert(
		/^\/private\/tmp\/bodyguard-lateral-quality\.[A-Za-z0-9]+$/.test(proof),
	);
	directory(proof);
	directory(join(proof, "failure-render"));
	const found = readdirSync(proof)
		.flatMap((name) =>
			name === "failure-render"
				? readdirSync(join(proof, name)).map((child) => `${name}/${child}`)
				: [name],
		)
		.sort();
	assert.deepEqual(found, [...names, "native-laplacian-source.json"].sort());
	const externalBytes = regular(join(proof, "native-laplacian-source.json"));
	const reference = JSON.parse(
		regular(join(proof, "native-source-observation.json")),
	);
	assert.equal(sha(externalBytes), reference.private_api_response_sha256);
	const external = JSON.parse(externalBytes);
	const content = Buffer.from(external.content, "base64");
	assert.equal(
		createHash("sha1")
			.update(Buffer.from(`blob ${content.length}\0`))
			.update(content)
			.digest("hex"),
		reference.git_blob_sha1,
	);
	assert.equal(sha(content), reference.source_sha256);
	if (existsSync(output)) {
		directory(output);
		assert.deepEqual(readdirSync(output), ["README.md"]);
	} else mkdirSync(output);
	const entries = [];
	for (const [name, bytes] of [
		...names.map((name) => [name, regular(join(proof, name))]),
		[`executed-${self}`, regular(join(source, self))],
	]) {
		const file = archived(name);
		const compressed = file.endsWith(".gz");
		const saved =
			name.endsWith(".gz") || !compressed
				? bytes
				: gzipSync(bytes, { level: 9, mtime: 0 });
		mkdirSync(dirname(join(output, file)), { recursive: true });
		writeFileSync(join(output, file), saved, { flag: "wx" });
		entries.push({
			file,
			compressed,
			bytes: saved.length,
			sha256: sha(saved),
			raw_sha256: sha(compressed ? gunzipSync(saved) : saved),
		});
	}
	writeFileSync(
		join(output, "manifest.json"),
		`${JSON.stringify(
			{
				input_sha256: inputSha,
				...Object.fromEntries(falseFlags.map((flag) => [flag, false])),
				female_authoring_executed: false,
				actual_diagnostic_previews: 8,
				observed_native_runs: nativeRuns,
				source_capture:
					"Executed native helpers captured unchanged after or during observed runs; render is rejected Male and unchanged Female. The external GPL source is retained privately; repository stores verified source identity and paraphrased observations only.",
				entries,
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	console.log(JSON.stringify(verify()));
}
