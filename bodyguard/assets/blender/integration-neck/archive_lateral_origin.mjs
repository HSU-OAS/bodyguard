// FR-A-02/03/08: archive actual native origin trace, never adopt an avatar.
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
	"../../../docs/review/avatar-neck-integration/lateral-origin",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const inputSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const originSha =
	"2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff";
const self = "archive_lateral_origin.mjs";
const helper = "inspect_lateral_origin.py";
const names = [
	"origin.json.gz",
	"origin.log.gz",
	`executed-${helper}.gz`,
	`executed-${self}.gz`,
].sort();
const identifiers = [
	120132, 124414, 124415, 124416, 128614, 129289, 131214, 131215, 131216,
];
const faces = [103829, 167048, 167049, 171043, 171044, 175905];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function regular(path) {
	const status = lstatSync(path);
	assert(
		status.isFile() && !status.isSymbolicLink(),
		`Not a regular file: ${path}`,
	);
	return readFileSync(path);
}
function directory(path) {
	assert(lstatSync(path).isDirectory() && !lstatSync(path).isSymbolicLink());
	assert.equal(realpathSync(path), path);
}
function validate(report, exit, log) {
	assert.equal(report.blender, "5.1.1");
	assert.equal(report.input_sha256, inputSha);
	assert.equal(report.professional_origin_sha256, originSha);
	assert.equal(report.diagnostic_only, true);
	for (const key of [
		"clinical_or_camera_data",
		"new_candidate_or_render_or_glb",
		"appearance_approved",
	]) {
		assert.equal(report[key], false);
	}
	assert([0, 1].includes(exit));
	if (exit === 1) {
		assert.equal(report.diagnostic_completed, false);
		assert.equal(typeof report.failure, "string");
		assert(log.includes("Traceback"));
		return;
	}
	assert.equal(report.diagnostic_completed, true);
	assert.equal(report.two_input_files_unchanged, true);
	assert(!log.includes("Traceback"));
	assert.deepEqual(
		report.point_comparison.map((row) => row.source_point_id),
		identifiers,
	);
	for (const scene of [report.input, report.origin]) {
		assert.equal(scene.read_only_male_female_body_rig_exact, true);
		assert.deepEqual(
			scene.vertices.map((row) => row.source_point_id),
			identifiers,
		);
		assert.deepEqual(
			scene.faces.map((row) => row.corresponds_to_input_face),
			faces,
		);
		assert(
			scene.vertices.every(
				(row) =>
					row.position_asset_m.every(Number.isFinite) &&
					row.position_world_m.every(Number.isFinite),
			),
		);
		assert(
			scene.faces.every(
				(row) =>
					row.native_normal.every(Number.isFinite) &&
					Number.isFinite(row.area_m2),
			),
		);
	}
	for (let i = 0; i < identifiers.length; i++) {
		const first = report.origin.vertices[i],
			second = report.input.vertices[i],
			row = report.point_comparison[i];
		assert.equal(
			row.position_asset_exact,
			JSON.stringify(first.position_asset_m) ===
				JSON.stringify(second.position_asset_m),
		);
		assert.equal(
			row.position_world_exact,
			JSON.stringify(first.position_world_m) ===
				JSON.stringify(second.position_world_m),
		);
		assert.equal(
			row.raw_skin_exact,
			JSON.stringify(first.raw_skin) === JSON.stringify(second.raw_skin),
		);
		assert.equal(
			row.one_ring_source_ids_exact,
			JSON.stringify(first.one_ring_source_ids) ===
				JSON.stringify(second.one_ring_source_ids),
		);
		assert(
			Math.abs(
				row.displacement_m -
					Math.hypot(
						...first.position_asset_m.map(
							(value, index) => value - second.position_asset_m[index],
						),
					),
			) < 1e-12,
		);
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
		"new_candidate_saved",
		"full_glb_pose_browser_executed",
		"actual_camera",
		"final_avatar_adopted",
		"stages_1_to_6_complete",
	]) {
		assert.equal(manifest[key], false);
	}
	assert.deepEqual(manifest.entries.map((entry) => entry.file).sort(), names);
	for (const entry of manifest.entries) {
		assert(names.includes(entry.file) && entry.compressed === true);
		const bytes = regular(join(output, entry.file));
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(sha(gunzipSync(bytes)), entry.raw_sha256);
	}
	for (const name of [helper, self]) {
		assert.equal(
			sha(gunzipSync(regular(join(output, `executed-${name}.gz`)))),
			sha(regular(join(source, name))),
		);
	}
	const report = JSON.parse(
		gunzipSync(regular(join(output, "origin.json.gz"))),
	);
	const log = gunzipSync(regular(join(output, "origin.log.gz"))).toString();
	validate(report, manifest.native_observed_exit, log);
	console.log(
		JSON.stringify({
			native_observed_exit: manifest.native_observed_exit,
			byte_audit_passed: true,
			evidence: names.length,
			native_rerun: false,
			avatar_adopted: false,
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
		"Expected private proof, original blend and observed exit",
	);
	const proof = resolve(arguments_[0]),
		origin = resolve(arguments_[1]);
	assert(
		/^\/private\/tmp\/bodyguard-lateral-origin\.[A-Za-z0-9]+$/.test(proof),
	);
	directory(proof);
	assert.deepEqual(
		readdirSync(proof).sort(),
		["origin.json", "origin.log", `executed-${helper}.gz`].sort(),
	);
	assert.equal(sha(regular(input)), inputSha);
	assert.equal(sha(regular(origin)), originSha);
	assert(/^[01]$/.test(arguments_[2]));
	const exit = Number(arguments_[2]);
	const report = JSON.parse(regular(join(proof, "origin.json"))),
		log = regular(join(proof, "origin.log")).toString();
	validate(report, exit, log);
	assert.equal(
		sha(gunzipSync(regular(join(proof, `executed-${helper}.gz`)))),
		sha(regular(join(source, helper))),
	);
	const entries = new Map([
		[
			"origin.json.gz",
			gzipSync(regular(join(proof, "origin.json")), { level: 9 }),
		],
		[
			"origin.log.gz",
			gzipSync(regular(join(proof, "origin.log")), { level: 9 }),
		],
		[`executed-${helper}.gz`, regular(join(proof, `executed-${helper}.gz`))],
		[
			`executed-${self}.gz`,
			gzipSync(regular(join(source, self)), { level: 9 }),
		],
	]);
	mkdirSync(output); // Existing frozen evidence must never be overwritten.
	for (const [name, bytes] of entries)
		writeFileSync(join(output, name), bytes, { flag: "wx" });
	writeFileSync(
		join(output, "manifest.json"),
		`${JSON.stringify(
			{
				input_sha256: inputSha,
				professional_origin_sha256: originSha,
				native_observed_exit: exit,
				appearance_approved: false,
				new_candidate_saved: false,
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
