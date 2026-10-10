// FR-A-02/03/08: durable read-only diagnosis of the preserved transition failure.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	closeSync,
	openSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const source = dirname(fileURLToPath(import.meta.url));
const proof = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/transition-faces-run",
);
const root = resolve(source, "../../../..");
const input = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend",
);
const origin = resolve(
	root,
	"../BODYGUARD-stage2-avatar-candidate/bodyguard/assets/blender/review/candidate-a316-a322-review/native/artist-candidate.blend",
);
const helper = "inspect_transition_faces.py";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(
	sha(readFileSync(join(source, helper))),
	"7975672d1a224f5ee59279a5032e1c24442d0dc5762da420dfd42cc5f0322ce7",
);
assert.equal(
	sha(readFileSync(input)),
	"be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068",
);
assert.equal(
	sha(readFileSync(origin)),
	"2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff",
);
assert.deepEqual(
	readdirSync(proof),
	[],
	"Existing evidence must not be overwritten",
);
const names = [
	helper,
	basename(fileURLToPath(import.meta.url)),
	"author_lateral_transition.py",
	"lateral_contract.py",
	"lateral_domain.py",
	"artist_snapshot_values.py",
	"surface_visibility.py",
];
const executed = names.map((name) => {
	const b = readFileSync(join(source, name));
	writeFileSync(join(proof, `executed-${name}.gz`), gzipSync(b, { level: 9 }), {
		flag: "wx",
	});
	return { name, sha256: sha(b) };
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
	proof,
	origin,
];
const fd = openSync(join(proof, "diagnostic.log"), "wx");
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
const terminal = {
	started_at: started,
	ended_at: new Date().toISOString(),
	executable,
	args,
	observed_native_exit: result.status,
	signal: result.signal,
	spawn_error: result.error?.message ?? null,
	native_exit_is_terminal: true,
	executed,
	input_sha256_after: sha(readFileSync(input)),
	professional_origin_sha256_after: sha(readFileSync(origin)),
	appearance_approved: false,
	stages_1_to_6_complete: false,
};
writeFileSync(
	join(proof, "native-exit.json"),
	`${JSON.stringify(terminal, null, 2)}\n`,
	{ flag: "wx" },
);
console.log(
	JSON.stringify({
		observed_native_exit: terminal.observed_native_exit,
		signal: terminal.signal,
		spawn_error: terminal.spawn_error,
		new_authoring: false,
		appearance_approved: false,
	}),
);
process.exitCode =
	result.status === 0 && !result.signal && !result.error ? 0 : 1;
