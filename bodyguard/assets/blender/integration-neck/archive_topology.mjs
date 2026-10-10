// FR-A-02/03/08: preserve this failed native attempt, never imply avatar approval.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const [proof] = process.argv.slice(2);
assert(
	/^\/private\/tmp\/bodyguard-neck-structure\.[A-Za-z0-9]+$/.test(proof ?? ""),
);
assert.equal(realpathSync(proof), proof);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const output = join(
	root,
	"docs/review/avatar-neck-integration/topology-attempt",
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourcePath = join(
	root,
	"docs/review/avatar-neck-integration/candidate-unapproved.blend",
);
const expected =
	"ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b";
assert.equal(sha(readFileSync(sourcePath)), expected);
const last = JSON.parse(readFileSync(join(proof, "repair-degenerate.json")));
assert.equal(last.passed, false);
assert.equal(last.rows.length, 1); // male only; female failed before its final row
assert.equal(last.rows[0].gender, "Male");
assert.equal(last.protected_polygon_difference.missing, 3);
assert.equal(last.appearance_approved, false);
const reports = readdirSync(proof).filter((file) =>
	/^repair.*\.json$/.test(file),
);
assert.deepEqual(reports.sort(), [
	"repair-degenerate.json",
	"repair-diagnostic.json",
	"repair-exact.json",
	"repair-face-provenance.json",
	"repair-fins.json",
	"repair-fixed.json",
	"repair-local.json",
	"repair-origin.json",
	"repair-preserved.json",
	"repair.json",
]);
for (const file of reports) {
	const report = JSON.parse(readFileSync(join(proof, file)));
	assert.equal(report.passed, false);
	assert.equal(report.input_sha256, expected);
}
assert(!readdirSync(proof).some((file) => file.endsWith(".blend")));
mkdirSync(output); // existing evidence must never be replaced
const entries = [];
const save = (file, bytes) => {
	const compressed = gzipSync(bytes, { level: 9, mtime: 0 });
	writeFileSync(join(output, `${file}.gz`), compressed, { flag: "wx" });
	entries.push({
		file: `${file}.gz`,
		bytes: compressed.length,
		sha256: sha(compressed),
		raw_sha256: sha(bytes),
	});
};
for (const file of readdirSync(proof).sort()) {
	assert(
		/^[a-z0-9.-]+\.(json|log|py|txt)$/.test(file),
		`Unexpected artifact: ${file}`,
	);
	save(file, readFileSync(join(proof, file)));
}
for (const file of ["repair_topology.py", "archive_topology.mjs"])
	save(
		`current-${file}`,
		readFileSync(join(dirname(fileURLToPath(import.meta.url)), file)),
	);
writeFileSync(
	join(output, "manifest.json"),
	JSON.stringify(
		{
			input_sha256: expected,
			candidate_saved: false,
			authoring_passed: false,
			appearance_approved: false,
			glb_deformation_browser_reexecuted: false,
			final_avatar_adopted: false,
			stages_1_to_6_complete: false,
			entries,
		},
		null,
		2,
	),
	{ flag: "wx" },
);
assert.equal(sha(readFileSync(sourcePath)), expected);
console.log(
	JSON.stringify({
		preserved: entries.length,
		candidateSaved: false,
		authoringPassed: false,
	}),
);
