// release-plan5/Q-11: installed-file excerpts are NOT whole-package/artifact licensing.
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { mkdir, open, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	entries,
	sha256,
	verify as verifyBase,
} from "./license-source-proof.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const base = join(project, "docs/review/upstream-license-evidence");
const installed = join(project, "frontend/node_modules/.pnpm");
const maath =
	"maath@0.10.8_@types+three@0.186.0_three@0.186.1/node_modules/maath";
const mit = "2fda481f5dc33e4f7d0e7c09d238796646adb689e7abaf47c61e262559c86a09";
const apache =
	"79bdafb4a72eef6f3f609492fd1c0571bcb21d109e10aa2a43fb7bff95e64935";
export const specs = Object.freeze([
	...[
		[
			"maath-dev",
			"easing-104c3902.cjs.dev.js",
			"2f477dae268b4ed29bc19c5826b01bcd24b2a735261492f3b3655ab74bc5dfc2",
			13519,
			8384,
			9554,
		],
		[
			"maath-prod",
			"easing-da79d042.cjs.prod.js",
			"cd54686354b4ada78c0b61eb16ff266bae3d786bb8c358fc5bac3fbdb413a6ed",
			13521,
			8386,
			9556,
		],
		[
			"maath-esm",
			"easing-0f4db1c0.esm.js",
			"bd5a967021588fd1977049a98aac328252471cea131bd4b1d7edfcdf060c4b95",
			13147,
			8336,
			9506,
		],
	].map(([id, file, sourceSha256, sourceBytes, start, end]) =>
		Object.freeze({
			id,
			packageIndex: 4,
			packagePath: maath,
			sourcePath: `${maath}/dist/${file}`,
			sourceSha256,
			sourceBytes,
			start,
			end,
			packageBytes: 602,
			packageSha256:
				"a8fd36627cbea15dd5326291e7b6eaf826dd2275114c2a684b4b213a2c899ac2",
			noticeSha256: mit,
			marker: "/**\n * Quaternion Damp",
			scope: "Quaternion Damp comment only; not the whole maath package",
		}),
	),
	...[
		[
			"mediapipe-01017",
			"0.10.17",
			0,
			"fc8a3cf4a55f7d1ae3f2efdda84bbeaeea605a92e535ac52b99deed6366917d5",
			123365,
			592,
			"26e7c2c041bf0765b30e9620f4a5ff102234dfbfad249ba827abf1d7b86fba2c",
		],
		[
			"mediapipe-101",
			"1.0.1",
			1,
			"dc272aff0a1b53c375815c6ef475c02c0a4892032683770d571e530ffded3d48",
			130545,
			1192,
			"f685301c07427e1d19a53b08afa586e5699aa1dfc2dd8c641887cc2c821b245e",
		],
	].map(
		([
			id,
			version,
			packageIndex,
			sourceSha256,
			sourceBytes,
			packageBytes,
			packageSha256,
		]) => {
			const packagePath = `@mediapipe+tasks-vision@${version}/node_modules/@mediapipe/tasks-vision`;
			return Object.freeze({
				id,
				packageIndex,
				packagePath,
				sourcePath: `${packagePath}/vision.d.ts`,
				sourceSha256,
				sourceBytes,
				packageBytes,
				packageSha256,
				start: 0,
				end: 620,
				noticeSha256: apache,
				marker: "/**\r\n * Copyright 2022 The MediaPipe Authors.",
				scope:
					"vision.d.ts file header only; not the SDK/WASM complete license or NOTICE",
			});
		},
	),
]);
const flags = Object.freeze({
	distributionApproved: false,
	completeArtifactNoticesVerified: false,
	npmArtifactIntegrityVerified: false,
});
async function safeRead(path) {
	const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const stat = await handle.stat();
		assert(stat.isFile() && stat.size > 0 && stat.size <= 1048576);
		const bytes = Buffer.alloc(stat.size + 1);
		let length = 0;
		while (length < bytes.length) {
			const { bytesRead } = await handle.read(
				bytes,
				length,
				bytes.length - length,
				null,
			);
			if (!bytesRead) break;
			length += bytesRead;
		}
		assert.equal(length, stat.size);
		return bytes.subarray(0, length);
	} finally {
		await handle.close();
	}
}
async function installedRead(path) {
	const root = await realpath(installed);
	const parent = await realpath(dirname(join(installed, path)));
	const inside = relative(root, parent);
	assert(
		inside !== ".." && !inside.startsWith("../") && !inside.startsWith("/"),
	);
	return safeRead(join(installed, path));
}
export function extract(spec, bytes) {
	assert(
		specs.includes(spec) && Buffer.isBuffer(bytes) && bytes.length <= 1048576,
	);
	assert.equal(sha256(bytes), spec.sourceSha256);
	assert.equal(bytes.length, spec.sourceBytes);
	const marker = Buffer.from(spec.marker);
	const start = bytes.indexOf(marker);
	// MediaPipe's concatenated declarations repeat the header: select the pinned file head, not all comments.
	assert.equal(start, spec.start);
	const end = bytes.indexOf(Buffer.from("*/"), start) + 2;
	assert.equal(end, spec.end);
	const notice = bytes.subarray(start, end);
	assert.equal(sha256(notice), spec.noticeSha256);
	return { start, end, notice };
}
async function identity(spec) {
	const bytes = await installedRead(`${spec.packagePath}/package.json`);
	assert.equal(bytes.length, spec.packageBytes);
	assert.equal(sha256(bytes), spec.packageSha256);
	const value = JSON.parse(bytes);
	const expected = entries[spec.packageIndex];
	for (const key of ["name", "version", "license"])
		assert.equal(value[key], expected[key]);
	return {
		bytes,
		selected: {
			name: value.name,
			version: value.version,
			license: value.license,
			bytes: bytes.length,
			sha256: sha256(bytes),
		},
	};
}
export async function collect(privateParent, destination) {
	assert(privateParent.startsWith("/") && destination.startsWith("/"));
	await verifyBase(base);
	await mkdir(join(privateParent, "raw"));
	await mkdir(destination);
	const proof = {
		schema: 1,
		...flags,
		lockSha256: sha256(
			await readFile(join(project, "frontend/pnpm-lock.yaml")),
		),
		baseProofSha256: sha256(await readFile(join(base, "proof.json"))),
		files: [],
		errors: [],
	};
	try {
		for (const spec of specs) {
			const pkg = await identity(spec);
			const bytes = await installedRead(spec.sourcePath);
			const { start, end, notice } = extract(spec, bytes);
			await writeFile(
				join(privateParent, "raw", `${spec.id}-source.bin`),
				bytes,
				{ flag: "wx" },
			);
			await writeFile(
				join(privateParent, "raw", `${spec.id}-package.json`),
				pkg.bytes,
				{ flag: "wx" },
			);
			await writeFile(join(destination, `${spec.id}-NOTICE.txt`), notice, {
				flag: "wx",
			});
			proof.files.push({
				id: spec.id,
				sourcePath: spec.sourcePath,
				sourceBytes: bytes.length,
				sourceSha256: sha256(bytes),
				package: pkg.selected,
				start,
				end,
				noticeBytes: notice.length,
				noticeSha256: sha256(notice),
				scope: spec.scope,
			});
		}
	} catch (error) {
		proof.errors.push({ error: String(error) });
	}
	await writeFile(
		join(destination, "proof.json"),
		`${JSON.stringify(proof, null, 2)}\n`,
		{ flag: "wx" },
	);
	return proof;
}
export async function verify(destination, current = false) {
	await verifyBase(base);
	const proof = JSON.parse(await safeRead(join(destination, "proof.json")));
	assert.equal(proof.schema, 1);
	assert.equal(
		proof.lockSha256,
		sha256(await readFile(join(project, "frontend/pnpm-lock.yaml"))),
	);
	assert.equal(
		proof.baseProofSha256,
		sha256(await readFile(join(base, "proof.json"))),
	);
	for (const [key, value] of Object.entries(flags))
		assert.equal(proof[key], value);
	assert.deepEqual(proof.errors, []);
	assert.equal(proof.files.length, specs.length);
	for (const [i, spec] of specs.entries()) {
		const file = proof.files[i],
			expected = entries[spec.packageIndex];
		for (const key of [
			"id",
			"sourcePath",
			"sourceSha256",
			"noticeSha256",
			"scope",
			"sourceBytes",
			"start",
			"end",
		])
			assert.equal(file[key], spec[key]);
		for (const key of ["name", "version", "license"])
			assert.equal(file.package[key], expected[key]);
		assert.equal(file.package.sha256, spec.packageSha256);
		assert.equal(file.package.bytes, spec.packageBytes);
		const notice = await safeRead(join(destination, `${spec.id}-NOTICE.txt`));
		assert.equal(sha256(notice), spec.noticeSha256);
		assert.equal(file.noticeBytes, notice.length);
		assert(
			Number.isSafeInteger(file.sourceBytes) && file.sourceBytes <= 1048576,
		);
		assert(
			Number.isSafeInteger(file.start) &&
				file.start >= 0 &&
				Number.isSafeInteger(file.end),
		);
		assert.equal(file.end - file.start, notice.length);
		assert(file.sourceBytes >= file.end);
		if (current) {
			const pkg = await identity(spec);
			assert.deepEqual(pkg.selected, file.package);
			const bytes = await installedRead(spec.sourcePath),
				selected = extract(spec, bytes);
			assert.equal(bytes.length, file.sourceBytes);
			assert.equal(selected.start, file.start);
			assert.equal(selected.end, file.end);
			assert.deepEqual(selected.notice, notice);
		}
	}
	return {
		files: specs.length,
		currentInstalledFilesCompared: current,
		...flags,
	};
}
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const [mode, first, second] = process.argv.slice(2);
	try {
		assert(
			first?.startsWith("/") &&
				["--collect", "--verify", "--verify-current"].includes(mode),
		);
		const result =
			mode === "--collect"
				? await collect(first, second)
				: await verify(first, mode === "--verify-current");
		console.log(JSON.stringify(result, null, 2));
		if (result.errors?.length) process.exitCode = 1;
	} catch (error) {
		console.error(String(error));
		process.exitCode = 1;
	}
}
