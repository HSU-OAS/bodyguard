// FR-A-02/03/08: immutable actual transition results, not avatar acceptance.
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
const proof = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lateral-transition-run",
);
const output = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lateral-transition",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const candidate = join(proof, "candidate-lateral-transition.blend");
const inputSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const originSha =
	"2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff";
const self = "archive_lateral_transition.mjs";
const helpers = [
	"author_lateral_transition.py",
	"run_lateral_transition_native.mjs",
	"lateral_contract.py",
	"lateral_domain.py",
	"artist_snapshot_values.py",
	"surface_visibility.py",
];
const names = [
	"author.json.gz",
	"author.log.gz",
	"native-exit.json.gz",
	...helpers.map((name) => `executed-${name}.gz`),
	`executed-${self}.gz`,
].sort();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function regular(path) {
	const st = lstatSync(path);
	assert(st.isFile() && !st.isSymbolicLink());
	return readFileSync(path);
}
function directory(path) {
	const st = lstatSync(path);
	assert(st.isDirectory() && !st.isSymbolicLink());
	assert.equal(realpathSync(path), path);
}
function json(path) {
	return JSON.parse(gunzipSync(regular(path)));
}
function validate(report, terminal, log) {
	assert.equal(report.blender, "5.1.1");
	assert.equal(report.input_sha256, inputSha);
	assert.equal(report.professional_origin_sha256, originSha);
	assert.equal(
		report.method,
		"original_professional_position_with_existing_continuous_falloff",
	);
	for (const flag of [
		"new_falloff_parameters",
		"raw_skin_rig_topology_changed",
		"appearance_approved",
		"clinical_or_camera_work",
	])
		assert.equal(report[flag], false);
	assert.equal(report.two_input_files_unchanged, true);
	assert([0, 1].includes(terminal.observed_native_exit));
	assert.equal(terminal.signal, null);
	assert.equal(terminal.spawn_error, null);
	assert.equal(terminal.native_exit_is_terminal, true);
	assert.equal(terminal.input_sha256_after, inputSha);
	assert.equal(terminal.professional_origin_sha256_after, originSha);
	assert.equal(terminal.appearance_approved, false);
	assert.equal(terminal.stages_1_to_6_complete, false);
	assert.deepEqual(
		terminal.executed.map((row) => row.name).sort(),
		[...helpers].sort(),
	);
	for (const row of terminal.executed)
		assert.equal(row.sha256, sha(regular(join(source, row.name))));
	const passed = terminal.observed_native_exit === 0;
	assert.equal(report.passed, passed);
	assert.equal(report.saved_candidate, passed);
	assert.equal(report.candidate_present, passed);
	assert.equal(terminal.candidate_present, passed);
	assert.equal(report.rows.length, passed ? 2 : report.rows.length);
	assert(report.rows.length <= 2);
	assert.deepEqual(
		report.rows.map((row) => row.gender),
		["Male", "Female"].slice(0, report.rows.length),
	);
	if (passed) {
		assert(!report.failure);
		assert(!log.includes("Traceback"));
		assert.equal(report.candidate_sha256, terminal.candidate_sha256);
		assert.equal(sha(regular(candidate)), report.candidate_sha256);
	} else {
		assert.equal(typeof report.failure, "string");
		assert(log.includes("Traceback"));
		assert.equal(terminal.candidate_sha256, null);
		assert(!readdirSync(proof).includes("candidate-lateral-transition.blend"));
	}
	for (const row of report.rows) {
		assert.equal(row.existing_falloff_range.length, 2);
		assert(row.existing_falloff_range.every(Number.isFinite));
		assert(
			row.existing_falloff_range[0] > 0 && row.existing_falloff_range[1] <= 1,
		);
		assert(
			Number.isInteger(row.fractional_transition_points) &&
				row.fractional_transition_points >= 0,
		);
		if (row.gender === "Male")
			assert.equal(row.confirmed_boundary_amounts["126108"], 0);
		if (row.outside_original_coordinates_exact === true) {
			assert.equal(
				row.raw_skin_topology_rest_pose_world_PBR_history_hands_attributes_exact,
				true,
			);
			assert.equal(row.selected_points, row.gender === "Male" ? 4964 : 5589);
			assert(row.moved_points > 0 && row.moved_points <= row.selected_points);
			assert(
				row.maximum_displacement_m > 0 && row.maximum_displacement_m < 0.006,
			);
			for (const key of [
				"vertices",
				"edges",
				"faces",
				"nonmanifold",
				"winding",
			])
				assert.equal(row.before[key], row.after[key]);
		}
		if (passed) {
			assert.equal(row.outside_original_coordinates_exact, true);
			assert(row.after.tiny_faces <= row.before.tiny_faces);
			assert.equal(row.after.selected_dihedral_above_90, 0);
		}
	}
}
function verify() {
	directory(output);
	assert.equal(sha(regular(input)), inputSha);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, inputSha);
	assert.equal(manifest.professional_origin_sha256, originSha);
	for (const key of [
		"appearance_approved",
		"new_render_executed",
		"full_glb_pose_browser_executed",
		"actual_camera",
		"final_avatar_adopted",
		"stages_1_to_6_complete",
	])
		assert.equal(manifest[key], false);
	assert.deepEqual(manifest.entries.map((e) => e.file).sort(), names);
	for (const entry of manifest.entries) {
		const b = regular(join(output, entry.file));
		assert.equal(entry.compressed, true);
		assert.equal(b.length, entry.bytes);
		assert.equal(sha(b), entry.sha256);
		assert.equal(sha(gunzipSync(b)), entry.raw_sha256);
	}
	for (const name of [...helpers, self])
		assert.equal(
			sha(gunzipSync(regular(join(output, `executed-${name}.gz`)))),
			sha(regular(join(source, name))),
		);
	const terminal = json(join(output, "native-exit.json.gz"));
	assert.equal(manifest.native_observed_exit, terminal.observed_native_exit);
	assert.equal(manifest.new_candidate_saved, terminal.candidate_present);
	validate(
		json(join(output, "author.json.gz")),
		terminal,
		gunzipSync(regular(join(output, "author.log.gz"))).toString(),
	);
	if (terminal.candidate_present) {
		assert.equal(
			manifest.candidate_reference.path,
			"../lateral-transition-run/candidate-lateral-transition.blend",
		);
		assert.equal(manifest.candidate_reference.sha256, sha(regular(candidate)));
		assert.equal(manifest.candidate_reference.bytes, regular(candidate).length);
	} else assert.equal(manifest.candidate_reference, null);
	console.log(
		JSON.stringify({
			byte_audit_passed: true,
			evidence: names.length,
			native_observed_exit: terminal.observed_native_exit,
			authoring_passed: terminal.observed_native_exit === 0,
			candidate_saved: terminal.candidate_present,
			appearance_approved: false,
			native_rerun: false,
		}),
	);
}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--check") verify();
else {
	assert.deepEqual(args, ["--archive"]);
	directory(proof);
	assert.equal(sha(regular(input)), inputSha);
	const report = JSON.parse(regular(join(proof, "author.json")));
	const terminal = JSON.parse(regular(join(proof, "native-exit.json")));
	assert.deepEqual(
		readdirSync(proof).sort(),
		[
			"author.json",
			"author.log",
			"native-exit.json",
			...helpers.map((name) => `executed-${name}.gz`),
			...(terminal.candidate_present
				? ["candidate-lateral-transition.blend"]
				: []),
		].sort(),
	);
	validate(report, terminal, regular(join(proof, "author.log")).toString());
	for (const name of helpers)
		assert.equal(
			sha(gunzipSync(regular(join(proof, `executed-${name}.gz`)))),
			sha(regular(join(source, name))),
		);
	const entries = new Map([
		...["author.json", "author.log", "native-exit.json"].map((name) => [
			`${name}.gz`,
			gzipSync(regular(join(proof, name)), { level: 9 }),
		]),
		...helpers.map((name) => [
			`executed-${name}.gz`,
			regular(join(proof, `executed-${name}.gz`)),
		]),
		[
			`executed-${self}.gz`,
			gzipSync(regular(join(source, self)), { level: 9 }),
		],
	]);
	mkdirSync(output);
	for (const [name, bytes] of entries)
		writeFileSync(join(output, name), bytes, { flag: "wx" });
	writeFileSync(
		join(output, "manifest.json"),
		`${JSON.stringify(
			{
				input_sha256: inputSha,
				professional_origin_sha256: originSha,
				native_observed_exit: terminal.observed_native_exit,
				new_candidate_saved: terminal.candidate_present,
				candidate_reference: terminal.candidate_present
					? {
							path: "../lateral-transition-run/candidate-lateral-transition.blend",
							bytes: regular(candidate).length,
							sha256: sha(regular(candidate)),
						}
					: null,
				appearance_approved: false,
				new_render_executed: false,
				full_glb_pose_browser_executed: false,
				actual_camera: false,
				final_avatar_adopted: false,
				stages_1_to_6_complete: false,
				entries: names.map((name) => {
					const bytes = entries.get(name);
					return {
						file: name,
						compressed: true,
						bytes: bytes.length,
						sha256: sha(bytes),
						raw_sha256: sha(gunzipSync(bytes)),
					};
				}),
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	verify();
}
