// FR-A-02/03/08: installed API verification; no avatar source or scene loaded.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	closeSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const self = fileURLToPath(import.meta.url);
const source = dirname(self);
const helper = join(source, "probe_native_deform.py");
const proof = resolve(
	source,
	"../../../docs/review/avatar-neck-integration/native-deform-probe",
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
mkdirSync(proof); // No recursive create/reuse: an existing run must be preserved.
const executed = [helper, self].map((path) => {
	const bytes = readFileSync(path);
	const name = basename(path);
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
	"--python-exit-code",
	"1",
	"--python",
	helper,
	"--",
	join(proof, "probe.json"),
];
const fd = openSync(join(proof, "native.log"), "wx");
const started = new Date().toISOString();
let result;
try {
	result = spawnSync(executable, args, { stdio: ["ignore", fd, fd] });
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
	native_exit_is_terminal: result.status !== null || result.signal !== null,
	executed,
	executed_source_unchanged: executed.every(
		(row) => sha(readFileSync(join(source, row.name))) === row.sha256,
	),
	nonhuman_fixture_only: true,
	professional_model_loaded_authored_or_saved: false,
	appearance_approved: false,
	stages_1_to_6_complete: false,
};
writeFileSync(
	join(proof, "native-exit.json"),
	`${JSON.stringify(terminal, null, 2)}\n`,
	{ flag: "wx" },
);
assert(terminal.executed_source_unchanged);
console.log(
	JSON.stringify({
		observed_native_exit: result.status,
		signal: result.signal,
		spawn_error: terminal.spawn_error,
		avatar_quality_proven: false,
	}),
);
process.exitCode =
	result.status === 0 && !result.signal && !result.error ? 0 : 1;
