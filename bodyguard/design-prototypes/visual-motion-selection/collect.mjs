// NFR-08: archive actual design evidence; immutable failures remain failures.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

const [proof] = process.argv.slice(2);
assert(
	/^\/private\/tmp\/bodyguard-visual-selection-proof\.[A-Za-z0-9]+$/.test(
		proof,
	),
);
const root = fileURLToPath(new URL("./", import.meta.url));
const out = join(root, "../../docs/review/visual-motion-selection");
assert(!existsSync(join(out, "manifest.json")), "Preserve evidence");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = {
	fixtureNotRelease: true,
	source: {},
	artifacts: {},
	failedRuns: ["initial-red", "first"],
	rootUnitFailurePreserved: true,
	currentUnitTests: 1479,
	finalActualChromeAssertions: 48,
	originalHtmlRegression: 12,
	syntheticVisibilityAndPagehide: true,
	physicalCamera: false,
	clinicalValidation: false,
	finalAvatar: false,
};
const put = (file, bytes, source) => {
	const archive = `${file}.gz`,
		compressed = gzipSync(bytes);
	mkdirSync(dirname(join(out, archive)), { recursive: true });
	writeFileSync(join(out, archive), compressed, { flag: "wx" });
	assert.equal(sha(gunzipSync(compressed)), sha(bytes));
	manifest.artifacts[archive] = {
		sha256: sha(compressed),
		rawSha256: sha(bytes),
		rawBytes: bytes.length,
	};
	if (source)
		manifest.source[source] = { archived: archive, sha256: sha(bytes) };
};
for (const label of [
	"initial-red",
	"first",
	"fixed",
	"reviewed",
	"final155",
	"final154",
]) {
	const bytes = readFileSync(join(proof, label, "report.json")),
		report = JSON.parse(bytes);
	assert.equal(report.failed, ["initial-red", "first"].includes(label));
	if (label.startsWith("final")) {
		assert.equal(report.cases.length, 24);
		assert.deepEqual(report.before, report.after);
		for (const [file, expected] of Object.entries(report.before)) {
			assert.equal(
				sha(readFileSync(join(root, file))),
				expected,
				"Actual final executed source changed",
			);
			if (!manifest.source[file])
				put(
					`source/${Object.keys(manifest.source).length}`,
					readFileSync(join(root, file)),
					file,
				);
		}
	}
	put(`reports/${label}.json`, bytes);
}
for (const file of [
	"unit.json",
	"unit-final.json",
	"original-regression/report.json",
	"original-regression/boundary.json",
])
	put(`reports/${file}`, readFileSync(join(proof, file)));
const unit = JSON.parse(readFileSync(join(proof, "unit-final.json")));
assert(
	unit.success && unit.numPassedTests === 1479 && unit.numFailedTests === 0,
);
const failed = JSON.parse(readFileSync(join(proof, "unit.json")));
assert(!failed.success);
for (const file of ["preview.ts", "index.html"])
	put(`first-source/${file}`, readFileSync(join(proof, "first-source", file)));
for (const file of ["preview.ts", "verify.mjs"])
	put(`fixed-source/${file}`, readFileSync(join(proof, "fixed-source", file)));
for (const label of [
	"bundle",
	"bundle-fixed",
	"bundle-reviewed",
	"bundle-final",
])
	put(`${label}/preview.js`, readFileSync(join(proof, label, "preview.js")));
for (const file of [
	"dialog-poster.png",
	"male-moving.png",
	"female-moving.png",
	"full-coaching.png",
	"dialog-820.png",
	"dialog-css200.png",
	"model-failure.png",
	"model-loading.png",
]) {
	const bytes = readFileSync(join(proof, "final155", file));
	writeFileSync(join(out, file), bytes, { flag: "wx" });
	manifest.artifacts[file] = {
		sha256: sha(bytes),
		rawSha256: sha(bytes),
		rawBytes: bytes.length,
	};
}
const reference = JSON.parse(
	readFileSync(
		join(root, "../../docs/review/owned-motion-preview/manifest.json"),
	),
);
const browser = JSON.parse(readFileSync(join(proof, "final155/report.json")));
for (const [route, expected] of Object.entries(reference.inputs))
	assert.equal(browser.inputs[route], expected);
manifest.inputs = reference.inputs;
manifest.publicAssets = {};
for (const [file, expected] of [
	[
		"index-DFhehDfV.js",
		"434efb6661a704895d6746ff6a40779c11806d53af276e9244fb4e2ade6e6945",
	],
	[
		"index-dNUNBpCv.css",
		"043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e",
	],
]) {
	const bytes = readFileSync(join(root, "../../frontend/dist/assets", file));
	assert.equal(sha(bytes), expected);
	manifest.publicAssets[file] = { bytes: bytes.length, sha256: expected };
}
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2), {
	flag: "wx",
});
console.log(
	JSON.stringify({
		artifacts: Object.keys(manifest.artifacts).length,
		actualSourceFiles: Object.keys(manifest.source).length,
		recorded: true,
	}),
);
