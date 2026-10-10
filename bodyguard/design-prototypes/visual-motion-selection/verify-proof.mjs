// Evidence identity check only; not a rerun of browser/clinical verification.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = fileURLToPath(new URL("./", import.meta.url));
const out = join(root, "../../docs/review/visual-motion-selection");
const manifest = JSON.parse(readFileSync(join(out, "manifest.json")));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [file, expected] of Object.entries(manifest.artifacts)) {
	const bytes = readFileSync(join(out, file));
	assert.equal(sha(bytes), expected.sha256);
	const raw = file.endsWith(".gz") ? gunzipSync(bytes) : bytes;
	assert.equal(sha(raw), expected.rawSha256);
}
for (const [file, expected] of Object.entries(manifest.source))
	assert.equal(sha(readFileSync(join(root, file))), expected.sha256);
console.log(
	JSON.stringify({
		artifacts: Object.keys(manifest.artifacts).length,
		source: Object.keys(manifest.source).length,
		identityVerified: true,
		browserRerun: false,
	}),
);
