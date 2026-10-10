// FR-A-02/03/08: native professional patch transport; preserve previous evidence.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	closeSync,
	existsSync,
	openSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const source = dirname(fileURLToPath(import.meta.url));
const self = basename(fileURLToPath(import.meta.url));
const root = resolve(source, "../../../..");
const proof = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lateral-native-deform-run",
);
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const origin = resolve(
	root,
	"../BODYGUARD-stage2-avatar-candidate/bodyguard/assets/blender/review/candidate-a316-a322-review/native/artist-candidate.blend",
);
const target = join(proof, "candidate-lateral-native-deform.blend");
const helper = "author_lateral_native_deform.py";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inputSha =
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068";
const originSha =
	"2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff";
const helperSha =
	"ad231b19714327ca6e6fbc43ba20d11f383712e4f709f16c8f83d4eb460fbbbf";
assert.equal(sha(readFileSync(join(source, helper))), helperSha);
assert.equal(sha(readFileSync(input)), inputSha);
assert.equal(sha(readFileSync(origin)), originSha);
assert.deepEqual(
	readdirSync(proof),
	[],
	"Existing evidence must not be overwritten",
);
const helpers = [
	helper,
	self,
	"lateral_contract.py",
	"lateral_domain.py",
	"artist_snapshot_values.py",
	"surface_visibility.py",
];
const executed = helpers.map((name) => {
	const bytes = readFileSync(join(source, name));
	writeFileSync(
		join(proof, `executed-${name}.gz`),
		gzipSync(bytes, { level: 9 }),
		{ flag: "wx" },
	);
	return { name, sha256: sha(bytes) };
});
const executable = "/Applications/Blender.app/Contents/MacOS/Blender";
const args = [
	"--factory-startup",
	"--disable-autoexec",
	"-b",
	input,
	"--python-exit-code",
	"1",
	"--python",
	join(source, helper),
	"--",
	origin,
	target,
	join(proof, "author.json"),
];
const fd = openSync(join(proof, "author.log"), "wx");
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
	native_exit_is_terminal: result.status !== null || result.signal !== null,
	executed,
	input_sha256_after: sha(readFileSync(input)),
	professional_origin_sha256_after: sha(readFileSync(origin)),
	appearance_approved: false,
	candidate_present: existsSync(target),
	candidate_sha256: existsSync(target) ? sha(readFileSync(target)) : null,
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
		candidate_present: report.candidate_present,
		appearance_approved: false,
	}),
);
process.exitCode =
	result.status === 0 && !result.signal && !result.error ? 0 : 1;
