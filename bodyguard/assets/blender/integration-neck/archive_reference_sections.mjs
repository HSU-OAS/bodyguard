// FR-A-02/03/08: preserve read-only professional geometry inspection, not a model pass.
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
	"docs/review/avatar-neck-integration/reference-sections",
);
const input = join(
	root,
	"docs/review/avatar-neck-integration/candidate-unapproved.blend",
);
const expected =
	"ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = ["inspection-executed.py", "inspection.log", "sections.json"];
const helpers = [
	"inspect_reference_sections.py",
	"archive_reference_sections.mjs",
];
const archiveNames = [...files, ...helpers.map((file) => `current-${file}`)]
	.map((file) => `${file}.gz`)
	.sort();

function regular(path) {
	assert(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
	return readFileSync(path);
}

function checkReport(report) {
	assert.equal(report.input_sha256, expected);
	assert.equal(report.blender, "5.1.1");
	assert.equal(report.read_only_scene, true);
	assert.equal(report.private_bmesh_copies_only, true);
	assert.equal(report.source_saved_or_modified, false);
	assert.equal(report.new_surface_authored, false);
	assert.equal(report.clinical_or_camera_data, false);
	assert.deepEqual(
		report.rows.map((row) => row.gender),
		["Male", "Female"],
	);
	for (const row of report.rows) {
		assert.equal(row.sections.length, 5);
		let previous = 0;
		for (const section of row.sections) {
			assert(Number.isFinite(section.height_ratio));
			assert(section.height_ratio > previous && section.height_ratio < 0.94);
			previous = section.height_ratio;
			assert.equal(section.components.length, 1);
			const loop = section.components[0];
			assert.equal(loop.closed_simple_loop, true);
			assert(Number.isSafeInteger(loop.points) && loop.points > 0);
			assert.equal(loop.edges, loop.points);
			assert(Number.isSafeInteger(loop.rear_edges) && loop.rear_edges > 0);
			assert(loop.rear_edges <= loop.edges);
			assert(Number.isFinite(loop.maximum_rear_dihedral_degrees));
			assert(loop.maximum_rear_dihedral_degrees >= 0);
			assert.equal(loop.bounds_m.length, 3);
			for (const bounds of loop.bounds_m) {
				assert.equal(bounds.length, 2);
				assert(bounds.every(Number.isFinite) && bounds[0] <= bounds[1]);
			}
		}
	}
}

function verify() {
	assert.equal(sha(regular(input)), expected);
	const manifest = JSON.parse(regular(join(output, "manifest.json")));
	assert.equal(manifest.input_sha256, expected);
	assert.equal(manifest.observed_native_process_exit, 0);
	assert.equal(manifest.read_only_inspection, true);
	for (const field of [
		"source_saved_or_modified",
		"new_surface_authored",
		"appearance_approved",
		"final_avatar_adopted",
		"full_deformation_glb_browser_executed",
		"actual_camera",
		"stages_1_to_6_complete",
	])
		assert.equal(manifest[field], false);
	assert.deepEqual(
		manifest.entries.map((entry) => entry.file).sort(),
		archiveNames,
	);
	assert.deepEqual(
		readdirSync(output).sort(),
		[...archiveNames, "README.md", "manifest.json"].sort(),
	);
	for (const entry of manifest.entries) {
		const bytes = regular(join(output, entry.file));
		assert.equal(bytes.length, entry.bytes);
		assert.equal(sha(bytes), entry.sha256);
		assert.equal(sha(gunzipSync(bytes)), entry.raw_sha256);
	}
	const raw = (name) => gunzipSync(regular(join(output, `${name}.gz`)));
	checkReport(JSON.parse(raw("sections.json")));
	assert.equal(
		sha(raw("inspection-executed.py")),
		sha(regular(join(source, "inspect_reference_sections.py"))),
	);
	for (const helper of helpers)
		assert.equal(
			sha(raw(`current-${helper}`)),
			sha(regular(join(source, helper))),
		);
	const log = raw("inspection.log").toString("utf8");
	assert(log.includes("Blender 5.1.1") && log.includes("Blender quit"));
	assert(!log.includes("Error: script failed") && !log.includes("Traceback"));
	return {
		artifacts: 5,
		byteAuditOnly: true,
		actualReadOnlySections: 10,
		newSurfaceAuthored: false,
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
	assert(/^\/private\/tmp\/bodyguard-neck-contours\.[A-Za-z0-9]+$/.test(proof));
	assert.equal(realpathSync(proof), proof);
	assert.deepEqual(readdirSync(proof).sort(), files.slice().sort());
	assert.equal(sha(regular(input)), expected);
	const report = JSON.parse(regular(join(proof, "sections.json")));
	checkReport(report);
	assert.equal(
		sha(regular(join(proof, "inspection-executed.py"))),
		sha(regular(join(source, "inspect_reference_sections.py"))),
	);
	const log = regular(join(proof, "inspection.log")).toString("utf8");
	assert(log.includes("Blender 5.1.1") && log.includes("Blender quit"));
	assert(!log.includes("Error: script failed") && !log.includes("Traceback"));
	if (existsSync(output)) {
		assert(
			lstatSync(output).isDirectory() && !lstatSync(output).isSymbolicLink(),
		);
		assert.deepEqual(readdirSync(output), ["README.md"]);
	} else mkdirSync(output);
	const entries = [];
	for (const [file, bytes] of [
		...files.map((file) => [file, regular(join(proof, file))]),
		...helpers.map((file) => [`current-${file}`, regular(join(source, file))]),
	]) {
		const saved = gzipSync(bytes, { level: 9, mtime: 0 });
		const name = `${file}.gz`;
		writeFileSync(join(output, name), saved, { flag: "wx" });
		entries.push({
			file: name,
			bytes: saved.length,
			sha256: sha(saved),
			raw_sha256: sha(bytes),
		});
	}
	writeFileSync(
		join(output, "manifest.json"),
		`${JSON.stringify(
			{
				input_sha256: expected,
				observed_native_process_exit: 0,
				read_only_inspection: true,
				source_saved_or_modified: false,
				new_surface_authored: false,
				appearance_approved: false,
				final_avatar_adopted: false,
				full_deformation_glb_browser_executed: false,
				actual_camera: false,
				stages_1_to_6_complete: false,
				entries,
			},
			null,
			2,
		)}\n`,
		{ flag: "wx" },
	);
	console.log(JSON.stringify(verify()));
}
