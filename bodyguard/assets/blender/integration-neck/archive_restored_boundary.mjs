// FR-A-02/03/08: preserve native boundary diagnosis separately from authoring.
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
	"../../../docs/review/avatar-neck-integration/restored-boundary",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const previous = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lateral-restore",
);
const inputSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const originSha =
	"2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff";
const helper = "inspect_restored_boundary.py",
	self = "archive_restored_boundary.mjs",
	runner = "run_restored_boundary.mjs";
const names = [
	"boundary.json.gz",
	"boundary.log.gz",
	"replayed-author.json.gz",
	"native-exit.json.gz",
	`executed-${helper}.gz`,
	`executed-${runner}.gz`,
	`executed-${self}.gz`,
].sort();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function regular(path) {
	const stat = lstatSync(path);
	assert(stat.isFile() && !stat.isSymbolicLink());
	return readFileSync(path);
}
function directory(path) {
	assert(lstatSync(path).isDirectory() && !lstatSync(path).isSymbolicLink());
	assert.equal(realpathSync(path), path);
}
function json(path) {
	return JSON.parse(gunzipSync(regular(path)));
}
function validate(report, author, exit, log, terminal) {
	assert.equal(terminal.observed_native_exit, exit);
	assert.equal(terminal.signal, null);
	assert.equal(terminal.spawn_error, null);
	assert.equal(terminal.native_exit_is_terminal, true);
	assert.equal(terminal.input_sha256_after, inputSha);
	assert.equal(terminal.professional_origin_sha256_after, originSha);
	assert.equal(terminal.helper_sha256, sha(regular(join(source, helper))));
	assert.equal(terminal.runner_sha256, sha(regular(join(source, runner))));
	assert.equal(terminal.new_candidate_saved, false);
	assert.equal(terminal.appearance_approved, false);
	assert.equal(terminal.stages_1_to_6_complete, false);
	assert.equal(report.blender, "5.1.1");
	assert.equal(report.input_sha256, inputSha);
	assert.equal(report.professional_origin_sha256, originSha);
	assert.equal(report.diagnostic_only, true);
	for (const key of [
		"new_authoring_parameters",
		"appearance_approved",
		"clinical_or_camera_data",
		"candidate_present",
	])
		assert.equal(report[key], false);
	assert.deepEqual(author.rows, json(join(previous, "author.json.gz")).rows);
	assert.equal(author.passed, false);
	assert.equal(author.saved_candidate, false);
	assert.equal(author.candidate_present, false);
	assert.equal(author.failure, "AssertionError: Restored lateral folds remain");
	assert([0, 1].includes(exit));
	if (exit === 1) {
		assert.equal(report.diagnostic_completed, false);
		assert.equal(typeof report.failure, "string");
		assert(log.includes("Traceback"));
		return;
	}
	for (const key of [
		"diagnostic_completed",
		"frozen_rows_exact",
		"female_body_rig_exact",
		"two_input_files_unchanged",
		"read_only_probes_body_rig_exact",
	])
		assert.equal(report[key], true);
	assert.equal(report.frozen_failure, "Restored lateral folds remain");
	assert(!log.includes("Traceback"));
	assert(report.boundary.restored_dihedral_degrees > 90);
	assert.equal(report.boundary.faces.length, 2);
	assert.equal(report.boundary.source_endpoints.length, 2);
	assert(report.boundary.faces.some((face) => face.all_points_selected));
	for (const face of report.boundary.faces) {
		assert(face.normal.every(Number.isFinite));
		assert.equal(face.points.length, face.source_point_ids.length);
		assert.deepEqual(
			face.points.map((point) => point.source_point_id),
			face.source_point_ids,
		);
		for (const point of face.points) {
			assert(
				point.input_position_asset_m.every(Number.isFinite) &&
					point.restored_position_asset_m.every(Number.isFinite),
			);
			if (!point.original_selected)
				assert.deepEqual(
					point.input_position_asset_m,
					point.restored_position_asset_m,
				);
			if (point.original_front_protected)
				assert.equal(point.original_selected, false);
		}
	}
	assert.deepEqual(
		report.origin.faces.map((face) => face.corresponds_to_input_face),
		report.boundary.faces.map((face) => face.native_face),
	);
}
function verify() {
	directory(output);
	assert.equal(sha(regular(input)), inputSha);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, inputSha);
	assert.equal(manifest.professional_origin_sha256, originSha);
	for (const key of [
		"new_authoring_passed",
		"new_candidate_saved",
		"appearance_approved",
		"new_render_executed",
		"full_glb_pose_browser_executed",
		"actual_camera",
		"final_avatar_adopted",
		"stages_1_to_6_complete",
	])
		assert.equal(manifest[key], false);
	assert.deepEqual(manifest.entries.map((entry) => entry.file).sort(), names);
	for (const entry of manifest.entries) {
		assert(names.includes(entry.file) && entry.compressed === true);
		const bytes = regular(join(output, entry.file));
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(sha(gunzipSync(bytes)), entry.raw_sha256);
	}
	for (const name of [helper, self, runner])
		assert.equal(
			sha(gunzipSync(regular(join(output, `executed-${name}.gz`)))),
			sha(regular(join(source, name))),
		);
	validate(
		json(join(output, "boundary.json.gz")),
		json(join(output, "replayed-author.json.gz")),
		manifest.native_observed_exit,
		gunzipSync(regular(join(output, "boundary.log.gz"))).toString(),
		json(join(output, "native-exit.json.gz")),
	);
	console.log(
		JSON.stringify({
			byte_audit_passed: true,
			evidence: names.length,
			native_observed_exit: manifest.native_observed_exit,
			native_rerun: false,
			new_authoring_passed: false,
			avatar_adopted: false,
		}),
	);
}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--check") {
	verify();
} else {
	assert.equal(
		args.length,
		3,
		"Expected private proof, original blend and observed exit",
	);
	const proof = resolve(args[0]),
		origin = resolve(args[1]);
	assert.equal(
		proof,
		resolve(
			source,
			"../../../docs/review/avatar-neck-integration/restored-boundary-run",
		),
	);
	directory(proof);
	assert.deepEqual(
		readdirSync(proof).sort(),
		[
			"boundary.json",
			"boundary.log",
			"replayed-author.json",
			"native-exit.json",
			`executed-${helper}.gz`,
			`executed-${runner}.gz`,
		].sort(),
	);
	assert(/^[01]$/.test(args[2]));
	const exit = Number(args[2]);
	assert.equal(sha(regular(input)), inputSha);
	assert.equal(sha(regular(origin)), originSha);
	validate(
		JSON.parse(regular(join(proof, "boundary.json"))),
		JSON.parse(regular(join(proof, "replayed-author.json"))),
		exit,
		regular(join(proof, "boundary.log")).toString(),
		JSON.parse(regular(join(proof, "native-exit.json"))),
	);
	assert.equal(
		sha(gunzipSync(regular(join(proof, `executed-${helper}.gz`)))),
		sha(regular(join(source, helper))),
	);
	const entries = new Map([
		...[
			"boundary.json",
			"boundary.log",
			"replayed-author.json",
			"native-exit.json",
		].map((name) => [
			`${name}.gz`,
			gzipSync(regular(join(proof, name)), { level: 9 }),
		]),
		[`executed-${helper}.gz`, regular(join(proof, `executed-${helper}.gz`))],
		[`executed-${runner}.gz`, regular(join(proof, `executed-${runner}.gz`))],
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
				native_observed_exit: exit,
				new_authoring_passed: false,
				new_candidate_saved: false,
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
