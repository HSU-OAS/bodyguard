// S6.10: 저장된 정적 시안 원문/현재 문서만 검사. 브라우저·제품·임상 시험 아님.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const evidence = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const originals = new Map([
	[
		"report.json",
		"527d7b73b41cc24f8b7314a1fe36ee5717adb59c27d171da7048ebbffe9b50cb",
	],
	[
		"boundary.json",
		"7d1f0f5a5b93eea1512d4781459b5a0ae3c1c742811016d71f1e29db835da3df",
	],
	[
		"link-red.stdout",
		"437235c858d45cb826dc0de2d147943e8abceaf0945b5780be1b108824f7734a",
	],
	[
		"link-red.stdout.original.gz",
		"3339899a54157e80815021101bbd46766e2ed1dc0e66840be6d1bee23bb7a3e2",
	],
]);
const names = [
	"full-body initial boundary and roles",
	"auxiliary explanation collapsed keyboard toggle and reset",
	"upper and detail synchronized view",
	"motion dialog keyboard escape and selection",
	"settings view guidance and no persistence",
	"manual demonstration no real animation or completion",
	"end confirm cancel and reset",
	"menus explain scope instead of inventing pages",
	"narrow desktop and CSS zoom no horizontal clipping",
	"keyboard visible focus reduced motion and text contrast",
	"asset failure recover without fake live state",
	"no camera storage API egress or JS errors",
];
const files = [
	"index.html",
	"style.css",
	"prototype.js",
	"verify.mjs",
	"assets/approved-reference.png",
];
const prefix = "bodyguard/design-prototypes/clinical-coaching/";
const base = "5a1a3d8ec1149cf029c486aee35de1dc33a2f167";
const executedHead = "e7869f3f92ac2dcfdc903b20c853e3b121d27f45";

for (const [file, expected] of originals) {
	assert.equal(sha(await readFile(path.join(evidence, file))), expected);
}
const rawFailure = gunzipSync(
	await readFile(path.join(evidence, "link-red.stdout.original.gz")),
);
assert.equal(
	sha(rawFailure),
	"56ba0ca3fbaa02a0b6fdf4061876346cc7d97a40683214ac3f2e6f249a631af2",
);
assert.equal(
	rawFailure.toString("utf8").replace(/\n+$/, "\n"),
	await readFile(path.join(evidence, "link-red.stdout"), "utf8"),
);
const report = JSON.parse(
	await readFile(path.join(evidence, "report.json"), "utf8"),
);
assert.equal(report.timestamp, "2026-10-08T16:25:14.350Z");
assert.equal(report.executedHead, executedHead);
assert.equal(
	report.scope,
	"static design prototype UI only; not webcam/avatar/clinical/product verification",
);
assert.equal(report.sourceUnchangedAcrossExecution, true);
assert.deepEqual(
	report.results.map((item) => item.name),
	names,
);
assert.ok(report.results.every((item) => item.passed === true));
assert.deepEqual(report.sourcesBefore, report.sources);
assert.deepEqual(
	report.sources.map((item) => item.file),
	files,
);
for (const item of report.sources) {
	const file = prefix + item.file;
	const current = await readFile(path.join(repo, file));
	assert.equal(sha(current), item.sha256);
	for (const ref of [base, executedHead]) {
		const blob = execFileSync("git", ["show", `${ref}:${file}`], {
			cwd: repo,
			maxBuffer: 16777216,
		});
		assert.ok(current.equals(blob));
	}
}
const boundary = JSON.parse(
	await readFile(path.join(evidence, "boundary.json"), "utf8"),
);
assert.deepEqual(boundary.proof, { camera: 0, storageWrites: 0, errors: [] });
assert.deepEqual(boundary.cumulativeProof, boundary.proof);
assert.equal(boundary.externalRequests, 0);
assert.deepEqual(boundary.paths, [
	"/",
	"/style.css",
	"/prototype.js",
	"/assets/approved-reference.png",
]);

const snapshot = JSON.parse(
	await readFile(path.join(evidence, "pr-snapshot.json"), "utf8"),
);
assert.equal(snapshot.baseMain, base);
assert.equal(snapshot.query, "gh pr list --state open");
const expectedPrs = [
	[9, "25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad", "CONFLICTING", "DIRTY"],
	[29, "b6235843710e169cf102da6c7b92c9df0630695f", "CONFLICTING", "DIRTY"],
	[36, "e4df4a99963bc72d3bf656074f226b47d9128719", "CONFLICTING", "DIRTY"],
	[51, "bc7b29a793079cfb7feb5ca1998fc484876859e3", "CONFLICTING", "DIRTY"],
	[90, "884700e3cebfce2b1c0c51fdca2cce4788e6dc4b", "MERGEABLE", "CLEAN"],
	[91, executedHead, "MERGEABLE", "CLEAN"],
];
assert.deepEqual(
	snapshot.prs.map((item) => item.number).sort((a, b) => a - b),
	expectedPrs.map((item) => item[0]),
);
for (const [number, head, mergeable, state] of expectedPrs) {
	const pr = snapshot.prs.find((item) => item.number === number);
	assert.equal(pr.isDraft, true);
	assert.equal(pr.headRefOid, head);
	assert.equal(pr.mergeable, mergeable);
	assert.equal(pr.mergeStateStatus, state);
	assert.deepEqual(pr.statusCheckRollup, []);
	assert.equal(pr.url, `https://github.com/HSU-OAS/bodyguard/pull/${number}`);
}

const allowed = [
	"bodyguard/docs/tasks.md",
	"bodyguard/docs/release-readiness-gates.md",
	"bodyguard/docs/stories/release-readiness-gates.md",
	...[
		"report.json",
		"boundary.json",
		"verify.mjs",
		"link-red.stdout",
		"link-red.stdout.original.gz",
		"pr-snapshot.json",
	].map((file) => `bodyguard/docs/review/release-readiness-gates/${file}`),
];
const changed = new Set();
for (const args of [
	["diff", "--name-only", "-z", base],
	["ls-files", "--others", "--exclude-standard", "-z"],
]) {
	for (const file of execFileSync("git", args, {
		cwd: repo,
		encoding: "utf8",
	}).split("\0")) {
		if (file) changed.add(file);
	}
}
assert.deepEqual([...changed].sort(), allowed.sort());

const docs = [
	"bodyguard/docs/release-readiness-gates.md",
	"bodyguard/docs/stories/release-readiness-gates.md",
];
let localLinks = 0;
for (const file of docs) {
	const markdown = await readFile(path.join(repo, file), "utf8");
	for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
		const target = match[1];
		if (/^https?:\/\//.test(target) || target.startsWith("#")) continue;
		const resolved = path.resolve(
			path.dirname(path.join(repo, file)),
			target.split("#")[0],
		);
		assert.ok(resolved.startsWith(repo), "Link must stay inside repository");
		assert.ok((await stat(resolved)).isFile());
		localLinks++;
	}
}
console.log(
	JSON.stringify({
		scope: "offline original-and-document-check-only",
		sourceFiles: files.length,
		staticCasesInStoredReport: names.length,
		historicalDrafts: expectedPrs.length,
		documentOnlyChangedFiles: changed.size,
		localLinks,
		releaseComplete: false,
	}),
);
