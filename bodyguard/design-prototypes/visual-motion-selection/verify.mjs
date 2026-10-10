// FR-A-03/NFR-08: actual browser design flow, authored fixtures only, no camera/API.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [runtime, proof, label, browserPath, bundle = "bundle"] =
	process.argv.slice(2);
assert(runtime && proof && /^[a-z0-9-]+$/.test(label));
assert(
	/^\/private\/tmp\/bodyguard-visual-selection-proof\.[A-Za-z0-9]+$/.test(
		proof,
	),
);
const root = fileURLToPath(new URL("./", import.meta.url));
const output = join(proof, label);
assert(!existsSync(output), "Earlier evidence must be preserved");
mkdirSync(output);
const sha = (file) =>
	createHash("sha256").update(readFileSync(file)).digest("hex");
const sources = () =>
	Object.fromEntries(
		[
			"index.html",
			"style.css",
			"prototype.js",
			"preview.ts",
			"build.mjs",
			"verify.mjs",
			"tsconfig.json",
			"serve.mjs",
			"../../frontend/src/avatar/ownedMotionPreview.ts",
			"../../frontend/src/avatar/ownedAvatarPair.ts",
			"../../frontend/src/avatar/eightWeightSkin.ts",
			"../../frontend/src/avatar/referencePlayback.ts",
			"../../frontend/src/coaching/resources.ts",
			"../../frontend/e2e/fixtures/nativeReferenceProgram.ts",
		]
			.filter((file) => existsSync(join(root, file)))
			.map((file) => [file, sha(join(root, file))]),
	);
const report = {
	fixtureNotRelease: true,
	before: sources(),
	cases: [],
	failed: false,
	browser: null,
	external: 0,
	api: 0,
	errors: [],
};
const assets = join(proof, "assets");
const routes = new Map([
	[
		"/assets/approved-reference.png",
		join(root, "../clinical-coaching/assets/approved-reference.png"),
	],
	["/preview.js", join(proof, bundle, "preview.js")],
	["/__private-native-male.glb", join(assets, "male.glb")],
	["/__private-native-female.glb", join(assets, "female.glb")],
	[
		"/__private-native-reference-fixture.json",
		join(assets, "authored-fixture.json"),
	],
	...["index.html", "style.css", "prototype.js"].map((file) => [
		`/${file}`,
		join(root, file),
	]),
]);
const server = createServer((req, res) => {
	const pathname = new URL(req.url, "http://localhost").pathname;
	const file = routes.get(pathname === "/" ? "/index.html" : pathname);
	if (!file || !existsSync(file)) return res.writeHead(404).end();
	const mime = {
		".html": "text/html; charset=utf-8",
		".css": "text/css",
		".js": "text/javascript",
		".png": "image/png",
		".json": "application/json",
	};
	res
		.writeHead(200, {
			"Content-Type": mime[extname(file)] ?? "application/octet-stream",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		})
		.end(readFileSync(file));
});
let browser;
let releaseHeld = () => {};
const check = (name, okay) => {
	assert(okay, name);
	report.cases.push(name);
};
try {
	await new Promise((yes, no) => {
		server.once("error", no);
		server.listen(0, "127.0.0.1", yes);
	});
	const base = `http://127.0.0.1:${server.address().port}`;
	const { chromium } = await import(
		pathToFileURL(join(runtime, "node_modules/@playwright/test/index.mjs")).href
	);
	browser = await chromium.launch({
		executablePath: browserPath,
		headless: true,
		args: [
			"--disable-background-networking",
			"--disable-component-update",
			"--disable-sync",
			"--no-first-run",
		],
	});
	report.browser = browser.version();
	report.inputs = Object.fromEntries(
		[...routes]
			.filter(([, file]) => existsSync(file))
			.map(([route, file]) => [route, sha(file)]),
	);
	const context = await browser.newContext({
		viewport: { width: 1280, height: 1000 },
		reducedMotion: "no-preference",
	});
	await context.route("**/*", (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== base) {
			report.external++;
			return route.abort();
		}
		if (url.pathname.startsWith("/api")) {
			report.api++;
			return route.abort();
		}
		return route.continue();
	});
	await context.addInitScript(() => {
		window.boundary = { camera: 0, storage: 0 };
		navigator.mediaDevices.getUserMedia = () => {
			window.boundary.camera++;
			throw new Error("Camera forbidden");
		};
		Storage.prototype.setItem = () => {
			window.boundary.storage++;
			throw new Error("Storage forbidden");
		};
	});
	const page = await context.newPage();
	page.on("pageerror", () => report.errors.push("pageerror"));
	await page.goto(base);
	await page.getByRole("button", { name: "동작 변경", exact: true }).click();
	check(
		"visual preview exists in actual dialog",
		(await page.locator("#motion-preview").count()) === 1,
	);
	await page.waitForFunction(
		() => window.designPreview?.snapshot().posterReady,
		{ timeout: 20000 },
	);
	const snap = () => page.evaluate(() => window.designPreview.snapshot());
	await page.screenshot({ path: join(output, "dialog-poster.png") });
	report.visibleDialogCharacters = await page
		.locator("#motion-dialog")
		.evaluate((node) => node.innerText.replace(/\s/g, "").length);
	const idle = await snap();
	check(
		"one authored candidate, short boundary, closed explanation",
		(await page.locator(".preview-candidate").count()) === 1 &&
			(await page.locator("#motion-dialog details[open]").count()) === 0,
	);
	await page.locator("#motion-preview").hover();
	await page.waitForFunction(
		() =>
			window.designPreview.snapshot().status === "playing" &&
			window.designPreview.snapshot().positionMs > 150,
		{ timeout: 20000 },
	);
	check(
		"male actual GLB animation frames",
		(await snap()).frames > idle.frames + 2,
	);
	await page.screenshot({ path: join(output, "male-moving.png") });
	await page.getByRole("button", { name: "정지", exact: true }).click();
	const paused = await snap();
	await page.waitForTimeout(250);
	check(
		"explicit stop no queued render",
		(await snap()).frames === paused.frames && (await snap()).queued === 0,
	);
	await page.getByRole("button", { name: "여성", exact: true }).click();
	await page.waitForFunction(
		() =>
			window.designPreview.snapshot().gender === "female" &&
			window.designPreview.snapshot().posterReady,
	);
	await page.getByRole("button", { name: "재생", exact: true }).click();
	await page.waitForFunction(
		() =>
			window.designPreview.snapshot().status === "playing" &&
			window.designPreview.snapshot().positionMs > 150,
	);
	await page.screenshot({ path: join(output, "female-moving.png") });
	await page.keyboard.press("Escape");
	await page.waitForFunction(
		() =>
			window.designPreview.snapshot().live === 0 &&
			window.designPreview.snapshot().queued === 0,
	);
	check(
		"escape closes and restores trigger focus",
		(await page.locator("#motion-dialog").isVisible()) === false &&
			(await page
				.locator("#change-motion")
				.evaluate((node) => node === document.activeElement)),
	);
	await page.getByRole("button", { name: "동작 변경", exact: true }).click();
	await page.waitForFunction(() => window.designPreview.snapshot().posterReady);
	await page.locator("#motion-preview").focus();
	await page.waitForFunction(
		() => window.designPreview.snapshot().status === "playing",
	);
	check("keyboard focus starts preview", (await snap()).status === "playing");
	await page.getByRole("button", { name: "전신 보기", exact: true }).click();
	await page.waitForFunction(
		() =>
			window.designPreview.snapshot().live === 0 &&
			window.designPreview.snapshot().queued === 0,
	);
	check(
		"view selection only, static coaching retained",
		(await page.locator(".comparison").getAttribute("data-view")) === "full" &&
			(await page.locator("#interaction-status").innerText()).includes("배치"),
	);
	await page.screenshot({ path: join(output, "full-coaching.png") });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.getByRole("button", { name: "동작 변경", exact: true }).click();
	await page.waitForFunction(() => window.designPreview.snapshot().posterReady);
	await page.locator("#motion-preview").hover();
	await page.locator("#motion-preview").focus();
	const reduced = await snap();
	await page.waitForTimeout(250);
	check(
		"reduced motion no automatic playback",
		(await snap()).frames === reduced.frames && (await snap()).queued === 0,
	);
	await page.getByRole("button", { name: "재생", exact: true }).click();
	await page.waitForFunction(
		() => window.designPreview.snapshot().status === "playing",
	);
	await page.getByRole("button", { name: "정지", exact: true }).click();
	check("reduced motion explicit controls", (await snap()).status === "idle");
	await page.setViewportSize({ width: 820, height: 900 });
	await page.screenshot({ path: join(output, "dialog-820.png") });
	check(
		"820 dialog no horizontal overflow",
		await page.evaluate(
			() =>
				document.querySelector("#motion-dialog").scrollWidth <=
				document.querySelector("#motion-dialog").clientWidth,
		),
	);
	await page.evaluate(() => {
		document.documentElement.style.zoom = "2";
	});
	await page.screenshot({ path: join(output, "dialog-css200.png") });
	check(
		"CSS200 dialog no horizontal overflow",
		await page.evaluate(
			() =>
				document.querySelector("#motion-dialog").scrollWidth <=
				document.querySelector("#motion-dialog").clientWidth,
		),
	);
	await page.evaluate(() => {
		document.documentElement.style.zoom = "";
	});
	await page.getByRole("button", { name: "전신 보기", exact: true }).focus();
	await page.keyboard.press("Tab");
	check(
		"keyboard reaches folded explanation",
		await page
			.locator(".preview-details summary")
			.evaluate((node) => node === document.activeElement),
	);
	await page.keyboard.press("Enter");
	check(
		"keyboard opens explanation",
		(await page.locator(".preview-details").getAttribute("open")) !== null,
	);
	await page.keyboard.press("Tab");
	check(
		"last disclosure cycles to close button",
		await page
			.getByRole("button", { name: "동작 변경 닫기" })
			.evaluate((node) => node === document.activeElement),
	);
	await page.keyboard.press("Escape");
	await page.setViewportSize({ width: 1280, height: 1000 });
	await context.route("**/__private-native-female.glb", (route) =>
		route.fulfill({ status: 503, body: "test fault" }),
	);
	await page.getByRole("button", { name: "동작 변경", exact: true }).click();
	await page.getByRole("button", { name: "다시 불러오기" }).waitFor();
	check(
		"model failure shown, no success or playback",
		!(await snap()).posterReady && (await snap()).queued === 0,
	);
	await page.screenshot({ path: join(output, "model-failure.png") });
	await context.unroute("**/__private-native-female.glb");
	await page.getByRole("button", { name: "다시 불러오기" }).click();
	await page.waitForFunction(() => window.designPreview.snapshot().posterReady);
	check(
		"explicit failure recovery",
		(await page.getByRole("button", { name: "다시 불러오기" }).isVisible()) ===
			false,
	);
	await page.getByRole("button", { name: "재생", exact: true }).click();
	await page.waitForFunction(
		() => window.designPreview.snapshot().status === "playing",
	);
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", {
			configurable: true,
			value: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await page.waitForFunction(() => window.designPreview.snapshot().live === 0);
	const hidden = await snap();
	await page.waitForTimeout(200);
	check(
		"synthetic visibility stops rendering",
		(await snap()).queued === 0 && (await snap()).frames === hidden.frames,
	);
	await page.evaluate(() => {
		delete document.hidden;
		document.dispatchEvent(new Event("visibilitychange"));
	});
	check("visibility return no automatic revival", (await snap()).queued === 0);
	let entered = false;
	const held = new Promise((yes) => {
		releaseHeld = yes;
	});
	await context.route("**/__private-native-male.glb", async (route) => {
		entered = true;
		await held;
		await route.continue();
	});
	await page.getByRole("button", { name: "남성", exact: true }).click();
	await page.waitForTimeout(100);
	check("controlled slow asset request actually entered", entered);
	await page.screenshot({ path: join(output, "model-loading.png") });
	await page.keyboard.press("Escape");
	const closed = await snap();
	releaseHeld();
	await context.unroute("**/__private-native-male.glb");
	await page.waitForTimeout(200);
	check(
		"late closed poster never draws",
		(await snap()).frames === closed.frames && (await snap()).queued === 0,
	);
	await page.getByRole("button", { name: "동작 변경", exact: true }).click();
	await page.getByRole("button", { name: "여성", exact: true }).click();
	await page.getByRole("button", { name: "남성", exact: true }).click();
	await page.getByRole("button", { name: "여성", exact: true }).click();
	await page.waitForFunction(
		() =>
			window.designPreview.snapshot().posterReady &&
			window.designPreview.snapshot().gender === "female",
	);
	check(
		"rapid replacement latest owner only",
		(await snap()).peak === 1 && (await snap()).gender === "female",
	);
	await page.keyboard.press("Escape");
	await page.waitForFunction(
		() =>
			window.designPreview.snapshot().live === 0 &&
			window.designPreview.snapshot().queued === 0,
	);
	await page.getByRole("button", { name: "동작 변경", exact: true }).click();
	await page.waitForFunction(() => window.designPreview.snapshot().posterReady);
	await page.getByRole("button", { name: "재생", exact: true }).click();
	await page.waitForFunction(
		() => window.designPreview.snapshot().status === "playing",
	);
	await page.evaluate(() =>
		window.dispatchEvent(new PageTransitionEvent("pagehide")),
	);
	await page.waitForFunction(
		() => window.designPreview.snapshot().status === "closed",
	);
	check(
		"synthetic pagehide releases active preview",
		(await snap()).live === 0 && (await snap()).queued === 0,
	);
	report.finalCounters = await snap();
	report.boundary = await page.evaluate(() => window.boundary);
	check(
		"camera storage external API zero, no JS errors",
		report.boundary.camera === 0 &&
			report.boundary.storage === 0 &&
			report.external === 0 &&
			report.api === 0 &&
			report.errors.length === 0,
	);
	check(
		"single owner all loads reclaimed",
		(await snap()).peak === 1 &&
			(await snap()).loads === (await snap()).releases,
	);
	await context.close();
} catch (error) {
	report.failed = true;
	report.failure = String(error.message);
	process.exitCode = 1;
} finally {
	releaseHeld();
	await browser?.close();
	await new Promise((yes) => server.close(yes));
	report.after = sources();
	assert.deepEqual(
		report.after,
		report.before,
		"Source changed during actual test",
	);
	writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2), {
		flag: "wx",
	});
	console.log(
		JSON.stringify({
			label,
			browser: report.browser,
			passed: report.cases.length,
			failed: report.failed,
			failure: report.failure,
		}),
	);
}
