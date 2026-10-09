// FR-A-02/03/08: preserve a rejected local native surface; not a rerun or approval.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

const [proof] = process.argv.slice(2);
assert(
	/^\/private\/tmp\/bodyguard-neck-patch\.[A-Za-z0-9]+$/.test(proof ?? ""),
);
assert.equal(realpathSync(proof), proof);
const source = dirname(fileURLToPath(import.meta.url));
const root = resolve(source, "../../..");
const output = join(root, "docs/review/avatar-neck-integration/quad-attempt");
const input = join(
	root,
	"docs/review/avatar-neck-integration/candidate-unapproved.blend",
);
const expected =
	"ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(sha(readFileSync(input)), expected);
const runs = [
	"author",
	"author-boundary",
	"author-refs",
	"author-grid",
	"author-native-skin",
	"author-fitted-native",
	"author-local-fit",
	"author-skin-diagnostic",
	"author-preserved-skin",
];
const files = readdirSync(proof).sort();
assert.equal(files.length, 33);
assert(!files.some((file) => file.endsWith(".blend")));
for (const run of runs) {
	const report = JSON.parse(readFileSync(join(proof, `${run}.json`)));
	assert.equal(report.input_sha256, expected);
	assert.equal(report.passed, false);
	assert.equal(report.appearance_approved, false);
	assert.equal(report.clinical_or_camera_work, false);
	assert(report.failure);
	assert(
		readFileSync(join(proof, `${run}.log`), "utf8").includes(
			"Error: script failed",
		),
	);
}
const last = JSON.parse(
	readFileSync(join(proof, "author-preserved-skin.json")),
);
assert.equal(last.rows.length, 1);
assert.equal(last.rows[0].gender, "Male");
assert(last.rows[0].outside_coordinates_raw_skin_polygons_exact);
assert(
	last.rows[0].front_hands_preserved &&
		last.rows[0].rest_rig_world_material_exact,
);
assert.equal(last.rows[0].after.nonmanifold, 0);
assert.equal(last.rows[0].after.winding, 0);
assert.equal(last.rows[0].before.tiny_faces, 2);
assert.equal(last.rows[0].after.tiny_faces, 610);
assert(last.rows[0].maximum_surface_binding_distance_m < 0.006);
assert(last.rows[0].maximum_unbound_fairing_distance_m > 0.006);
const diagnostic = JSON.parse(
	readFileSync(join(proof, "author-skin-diagnostic.json")),
);
assert(diagnostic.protected_raw_skin_difference.positive_weights_exact);
if (existsSync(output)) assert.deepEqual(readdirSync(output), ["README.md"]);
else mkdirSync(output);
// An authored README may precede the archive; all evidence files are exclusive.
const entries = [];
function save(name, bytes) {
	assert(/^[a-z0-9_.-]+\.(json|log|py|mjs)$/.test(name));
	const compressed = gzipSync(bytes, { level: 9, mtime: 0 });
	const file = `${name}.gz`;
	writeFileSync(join(output, file), compressed, { flag: "wx" });
	entries.push({
		file,
		bytes: compressed.length,
		sha256: sha(compressed),
		raw_sha256: sha(bytes),
	});
}
for (const file of files) save(file, readFileSync(join(proof, file)));
for (const file of [
	"author_quad_patch.py",
	"artist_snapshot_values.py",
	"archive_quad_attempt.mjs",
])
	save(`current-${file}`, readFileSync(join(source, file)));
for (const entry of entries) {
	const bytes = readFileSync(join(output, entry.file));
	assert.equal(bytes.length, entry.bytes);
	assert.equal(sha(bytes), entry.sha256);
	assert.equal(sha(gunzipSync(bytes)), entry.raw_sha256);
}
assert.equal(sha(readFileSync(input)), expected);
writeFileSync(
	join(output, "manifest.json"),
	JSON.stringify(
		{
			input_sha256: expected,
			native_blender: last.blender,
			authoring_passed: false,
			candidate_saved: false,
			appearance_approved: false,
			final_avatar_adopted: false,
			stages_1_to_6_complete: false,
			independent_reopen_executed: false,
			glb_deformation_render_browser_executed: false,
			actual_camera: false,
			observed_runs: runs.map((name) => ({
				name,
				native_process_exit: 1,
				passed: false,
			})),
			female_authoring_executed: false,
			entries,
		},
		null,
		2,
	) + "\n",
	{ flag: "wx" },
);
console.log(
	JSON.stringify({
		preserved: entries.length,
		authoringPassed: false,
		candidateSaved: false,
		verificationRerun: false,
	}),
);
