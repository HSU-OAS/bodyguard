// FR-A-02/03/08: preserve the actual rejected professional-position restoration.
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
	"../../../docs/review/avatar-neck-integration/lateral-restore",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const inputSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const originSha =
	"2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff";
const self = "archive_lateral_restore.mjs";
const helpers = [
	"author_lateral_restore.py",
	"lateral_contract.py",
	"lateral_domain.py",
	"artist_snapshot_values.py",
	"surface_visibility.py",
];
const names = [
	"author.json.gz",
	"author.log.gz",
	...helpers.map((name) => `executed-${name}.gz`),
	`executed-${self}.gz`,
].sort();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function regular(path) {
	const status = lstatSync(path);
	assert(status.isFile() && !status.isSymbolicLink());
	return readFileSync(path);
}
function directory(path) {
	assert(lstatSync(path).isDirectory() && !lstatSync(path).isSymbolicLink());
	assert.equal(realpathSync(path), path);
}
function validate(report, log) {
	assert.equal(report.blender, "5.1.1");
	assert.equal(report.input_sha256, inputSha);
	assert.equal(report.professional_origin_sha256, originSha);
	assert.equal(
		report.method,
		"restore_existing_professional_positions_by_unique_source_point_id",
	);
	assert.equal(report.failure, "AssertionError: Restored lateral folds remain");
	assert(
		log.includes("AssertionError: Restored lateral folds remain") &&
			log.includes("Traceback"),
	);
	for (const key of [
		"raw_skin_rig_topology_changed",
		"appearance_approved",
		"clinical_or_camera_work",
		"passed",
		"saved_candidate",
		"candidate_present",
	])
		assert.equal(report[key], false);
	assert.equal(report.rows.length, 1);
	const row = report.rows[0];
	assert.equal(row.gender, "Male");
	assert.equal(row.selected_points, 4964);
	assert.equal(row.moved_points, 4149);
	assert.equal(row.new_points_preserved, 0);
	assert.equal(row.before.selected_dihedral_above_90, 14);
	assert.equal(row.after.selected_dihedral_above_90, 1);
	assert.equal(row.outside_original_coordinates_exact, true);
	assert.equal(
		row.raw_skin_topology_rest_pose_world_PBR_history_hands_attributes_exact,
		true,
	);
	assert(row.maximum_displacement_m > 0 && row.maximum_displacement_m < 0.006);
	for (const key of [
		"vertices",
		"edges",
		"faces",
		"nonmanifold",
		"winding",
		"tiny_faces",
	])
		assert.equal(row.before[key], row.after[key]);
	assert.equal(row.after.nonmanifold, 0);
	assert.equal(row.after.winding, 0);
	assert.equal(row.after.tiny_faces, 2);
}
function verify() {
	directory(output);
	assert.equal(sha(regular(input)), inputSha);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, inputSha);
	assert.equal(manifest.professional_origin_sha256, originSha);
	assert.equal(manifest.native_observed_exit, 1);
	assert.equal(manifest.archive_source_hashes_passed, true);
	for (const key of [
		"appearance_approved",
		"new_candidate_saved",
		"female_authoring_executed",
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
	for (const name of [...helpers, self])
		assert.equal(
			sha(gunzipSync(regular(join(output, `executed-${name}.gz`)))),
			sha(regular(join(source, name))),
		);
	validate(
		JSON.parse(gunzipSync(regular(join(output, "author.json.gz")))),
		gunzipSync(regular(join(output, "author.log.gz"))).toString(),
	);
	console.log(
		JSON.stringify({
			byte_audit_passed: true,
			evidence: names.length,
			native_rerun: false,
			authoring_passed: false,
			candidate_saved: false,
		}),
	);
}
const arguments_ = process.argv.slice(2);
if (arguments_.length === 1 && arguments_[0] === "--check") {
	verify();
} else {
	assert.equal(
		arguments_.length,
		3,
		"Expected proof, original blend and observed exit",
	);
	const proof = resolve(arguments_[0]),
		origin = resolve(arguments_[1]);
	assert(
		/^\/private\/tmp\/bodyguard-lateral-restore\.[A-Za-z0-9]+$/.test(proof),
	);
	directory(proof);
	assert.deepEqual(
		readdirSync(proof).sort(),
		[
			"author.json",
			"author.log",
			...helpers.map((name) => `executed-${name}.gz`),
		].sort(),
	);
	assert.equal(arguments_[2], "1");
	assert.equal(sha(regular(input)), inputSha);
	assert.equal(sha(regular(origin)), originSha);
	validate(
		JSON.parse(regular(join(proof, "author.json"))),
		regular(join(proof, "author.log")).toString(),
	);
	for (const name of helpers)
		assert.equal(
			sha(gunzipSync(regular(join(proof, `executed-${name}.gz`)))),
			sha(regular(join(source, name))),
		);
	const entries = new Map([
		[
			"author.json.gz",
			gzipSync(regular(join(proof, "author.json")), { level: 9 }),
		],
		[
			"author.log.gz",
			gzipSync(regular(join(proof, "author.log")), { level: 9 }),
		],
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
				native_observed_exit: 1,
				archive_source_hashes_passed: true,
				appearance_approved: false,
				new_candidate_saved: false,
				female_authoring_executed: false,
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
