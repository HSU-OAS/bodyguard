// FR-A-02/03/08: durable native diagnosis; no model save or product change.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	closeSync,
	existsSync,
	openSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const source = dirname(fileURLToPath(import.meta.url));
const root = resolve(source, "../../../..");
const proof = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/restored-boundary-run",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const origin = resolve(
	root,
	"../BODYGUARD-stage2-avatar-candidate/bodyguard/assets/blender/review/candidate-a316-a322-review/native/artist-candidate.blend",
);
const helper = join(source, "inspect_restored_boundary.py");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const helperSha = sha(readFileSync(helper));
const inputSha = sha(readFileSync(input));
const originSha = sha(readFileSync(origin));
assert.equal(
	helperSha,
	"a72bea965bb881cfb6ff32d26bd5dcf4260e6ea157a3ba57e7bf166ea1541b2c",
);
assert.equal(
	inputSha,
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068",
);
assert.equal(
	originSha,
	"2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff",
);
for (const file of [
	"boundary.log",
	"boundary.json",
	"replayed-author.json",
	"native-exit.json",
	"unexpected-candidate.blend",
	"executed-inspect_restored_boundary.py.gz",
	"executed-run_restored_boundary.mjs.gz",
])
	assert(
		!existsSync(join(proof, file)),
		"Existing evidence must not be overwritten",
	);
writeFileSync(
	join(proof, "executed-inspect_restored_boundary.py.gz"),
	gzipSync(readFileSync(helper), { level: 9 }),
	{ flag: "wx" },
);
writeFileSync(
	join(proof, "executed-run_restored_boundary.mjs.gz"),
	gzipSync(readFileSync(fileURLToPath(import.meta.url)), { level: 9 }),
	{ flag: "wx" },
);
const executable = "/Applications/Blender.app/Contents/MacOS/Blender";
const args = [
	"--factory-startup",
	"--disable-autoexec",
	"-b",
	input,
	"--python-exit-code",
	"1",
	"--python",
	helper,
	"--",
	proof,
	origin,
];
const fd = openSync(join(proof, "boundary.log"), "wx");
const started = new Date().toISOString();
let result;
try {
	result = spawnSync(executable, args, {
		cwd: root,
		stdio: ["ignore", fd, fd],
	});
} finally {
	closeSync(fd);
}
const report = {
	started_at: started,
	ended_at: new Date().toISOString(),
	executable,
	args,
	observed_native_exit: result.status,
	signal: result.signal,
	spawn_error: result.error?.message ?? null,
	native_exit_is_terminal: true,
	helper_sha256: helperSha,
	runner_sha256: sha(readFileSync(fileURLToPath(import.meta.url))),
	input_sha256_after: sha(readFileSync(input)),
	professional_origin_sha256_after: sha(readFileSync(origin)),
	appearance_approved: false,
	new_candidate_saved: existsSync(join(proof, "unexpected-candidate.blend")),
	stages_1_to_6_complete: false,
};
writeFileSync(
	join(proof, "native-exit.json"),
	`${JSON.stringify(report, null, 2)}\n`,
	{ flag: "wx" },
);
console.log(
	JSON.stringify({
		observed_native_exit: report.observed_native_exit,
		signal: report.signal,
		spawn_error: report.spawn_error,
		native_exit_is_terminal: true,
		new_candidate_saved: report.new_candidate_saved,
	}),
);
process.exitCode =
	result.status === 0 && !result.signal && !result.error ? 0 : 1;
