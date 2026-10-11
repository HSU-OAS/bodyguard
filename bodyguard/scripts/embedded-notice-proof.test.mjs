// release-plan5/Q-11: actual installed-file notices and synthetic corruption are separate.
import assert from "node:assert/strict";
import {
	copyFile,
	mkdtemp,
	readFile,
	symlink,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collect, extract, specs, verify } from "./embedded-notice-proof.mjs";

const evidence = fileURLToPath(
	new URL(
		"../docs/review/embedded-package-notices/verified-evidence/",
		import.meta.url,
	),
);
async function copy() {
	const directory = await mkdtemp("/private/tmp/bodyguard-embedded-test.");
	for (const name of ["proof.json", ...specs.map((s) => `${s.id}-NOTICE.txt`)])
		await copyFile(join(evidence, name), join(directory, name));
	return directory;
}
test("actual partial notices verify offline/current without granting whole-package rights", async () => {
	assert.equal((await verify(evidence, true)).files, 5);
	const result = await verify(evidence);
	assert.equal(result.distributionApproved, false);
	assert.equal(result.completeArtifactNoticesVerified, false);
	assert.equal(result.npmArtifactIntegrityVerified, false);
});
test("synthetic source truncation/wrong selector/rewritten copyright cannot extract a notice", () => {
	assert.throws(() =>
		extract(
			specs[0],
			Buffer.from("Copyright 2016\nPermission is hereby granted"),
		),
	);
	assert.throws(() =>
		extract(
			specs[0],
			Buffer.from("/**\n * Quaternion Damp\nCopyright altered\n */"),
		),
	);
	assert.throws(() =>
		extract(
			specs[3],
			Buffer.from("/**\r\n * Copyright 2022 The MediaPipe Authors.\r\n */"),
		),
	);
});
test("synthetic rehashed partial notice/path/approval tampering is rejected", async () => {
	const { createHash } = await import("node:crypto");
	for (const kind of [
		"notice",
		"path",
		"approval",
		"source",
		"offset",
		"package",
	]) {
		const directory = await copy();
		const proof = JSON.parse(await readFile(join(directory, "proof.json")));
		if (kind === "notice") {
			const bytes = Buffer.from("Copyright 2016\nPermission is hereby granted");
			await writeFile(join(directory, `${specs[0].id}-NOTICE.txt`), bytes);
			proof.files[0].noticeBytes = bytes.length;
			proof.files[0].noticeSha256 = createHash("sha256")
				.update(bytes)
				.digest("hex");
		} else if (kind === "path") proof.files[0].sourcePath = "../outside";
		else if (kind === "approval") proof.distributionApproved = true;
		else if (kind === "offset") {
			proof.files[0].start += 1;
			proof.files[0].end += 1;
		} else if (kind === "package")
			proof.files[0].package.sha256 = "a".repeat(64);
		else proof.files[0].sourceSha256 = "a".repeat(64);
		await writeFile(join(directory, "proof.json"), JSON.stringify(proof));
		await assert.rejects(verify(directory));
	}
	await verify(evidence);
});
test("preserved failed first collection remains a failure, not successful evidence", async () => {
	const failed = fileURLToPath(
		new URL(
			"../docs/review/embedded-package-notices/evidence/",
			import.meta.url,
		),
	);
	const proof = JSON.parse(await readFile(join(failed, "proof.json")));
	assert.equal(proof.files.length, 3);
	assert.equal(proof.errors.length, 1);
	await assert.rejects(verify(failed));
});
test("symlink proof and existing destination are rejected; original evidence is unchanged", async () => {
	const directory = await mkdtemp("/private/tmp/bodyguard-embedded-link.");
	await symlink(join(evidence, "proof.json"), join(directory, "proof.json"));
	await assert.rejects(verify(directory));
	const before = await readFile(join(evidence, "proof.json"));
	const parent = await mkdtemp("/private/tmp/bodyguard-embedded-existing.");
	await assert.rejects(collect(parent, evidence), /EEXIST/);
	assert.deepEqual(await readFile(join(evidence, "proof.json")), before);
});
