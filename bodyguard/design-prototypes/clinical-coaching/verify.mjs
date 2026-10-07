// S4.D2 / NFR-08: 실제 Chrome 구조 검증. 제품 코칭·실측 검증이 아님.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.resolve(process.argv[2] ?? "../../frontend");
assert.ok(
	process.argv[3],
	"Provide a new, empty evidence directory; previous evidence must not be overwritten",
);
const out = path.resolve(process.argv[3]);
const sourceFiles = [
	"index.html",
	"style.css",
	"prototype.js",
	"verify.mjs",
	"assets/approved-reference.png",
];
const { createHash } = await import("node:crypto");
const snapshot = () =>
	Promise.all(
		sourceFiles.map(async (file) => ({
			file,
			sha256: createHash("sha256")
				.update(await readFile(path.join(root, file)))
				.digest("hex"),
		})),
	);
const sourcesBefore = await snapshot();
// S4.D3 / NFR-08: 실제 실행 커밋과 시작·종료의 동일 소스를 함께 기록한다.
const gitHead = () =>
	execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: root,
		encoding: "utf8",
	}).trim();
const executedHead = gitHead();
const { chromium } = await import(
	pathToFileURL(path.join(runtime, "node_modules/@playwright/test/index.mjs"))
		.href
);
await mkdir(out, { recursive: true });
assert.equal(
	(await readdir(out)).length,
	0,
	"Evidence directory must be empty",
);
const server = createServer(async (req, res) => {
	try {
		const resource = decodeURIComponent(
			new URL(req.url, "http://localhost").pathname,
		);
		const file = path.resolve(
			root,
			`.${resource === "/" ? "/index.html" : resource}`,
		);
		if (!file.startsWith(`${root}${path.sep}`)) {
			res.writeHead(403).end();
			return;
		}
		const data = await readFile(file);
		const types = {
			".html": "text/html; charset=utf-8",
			".css": "text/css; charset=utf-8",
			".js": "text/javascript; charset=utf-8",
			".png": "image/png",
		};
		res
			.writeHead(200, {
				"Content-Type": types[path.extname(file)] ?? "application/octet-stream",
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
			})
			.end(data);
	} catch {
		res.writeHead(404).end();
	}
});
await new Promise((resolve, reject) => {
	server.once("error", reject);
	server.listen(0, "127.0.0.1", resolve);
});
const url = `http://127.0.0.1:${server.address().port}`;
const results = [];
const requests = [];
const cumulativeProof = { camera: 0, storageWrites: 0, errors: [] };
let initialVisibleTextCharacters = null;
let browser;
let page;
async function caseOf(name, run) {
	console.log(`RUN ${name}`);
	try {
		await run();
		results.push({ name, passed: true });
		console.log(`PASS ${name}`);
	} catch (error) {
		results.push({ name, passed: false, error: String(error) });
		console.log(`FAIL ${name}: ${String(error).split("\n")[0]}`);
	} finally {
		if (page)
			await page.evaluate(() =>
				document.querySelectorAll("dialog[open]").forEach((dialog) => {
					dialog.close();
				}),
			);
	}
}
try {
	browser = await chromium.launch({
		channel: "chrome",
		headless: true,
		args: ["--proxy-bypass-list=<-loopback>"],
	});
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		reducedMotion: "reduce",
	});
	context.setDefaultTimeout(8000);
	await context.exposeBinding(
		"reportDesignBoundary",
		(_source, kind, message) => {
			if (kind === "error") cumulativeProof.errors.push(message);
			else cumulativeProof[kind] += 1;
		},
	);
	await context.addInitScript(() => {
		window.designProof = { camera: 0, storageWrites: 0, errors: [] };
		if (navigator.mediaDevices)
			navigator.mediaDevices.getUserMedia = async () => {
				window.designProof.camera++;
				await window.reportDesignBoundary("camera");
				throw new Error("Forbidden camera");
			};
		const setter = Storage.prototype.setItem;
		Storage.prototype.setItem = function (...args) {
			window.designProof.storageWrites++;
			void window.reportDesignBoundary("storageWrites");
			return setter.apply(this, args);
		};
		window.addEventListener("error", (e) => {
			if (e.message) {
				window.designProof.errors.push(e.message);
				void window.reportDesignBoundary("error", e.message);
			}
		});
	});
	context.on("request", (request) => requests.push(request.url()));
	page = await context.newPage();
	const settle = () =>
		page.evaluate(
			() =>
				new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				),
		);
	// 전체 페이지 캡처 전 두 번의 paint를 기다려 창 크기 변경 직후의 중간 프레임을 피한다.
	const capture = async (name, fullPage = false) => {
		await settle();
		await page.screenshot({
			path: path.join(out, name),
			fullPage,
			animations: "disabled",
		});
	};
	await page.goto(url);
	await page.locator(".body-source").first().waitFor();
	await page.waitForFunction(() =>
		[...document.querySelectorAll(".body-source")].every(
			(img) => img.complete && img.naturalWidth > 0,
		),
	);
	await caseOf("full-body initial boundary and roles", async () => {
		initialVisibleTextCharacters = await page
			.locator("body")
			.innerText()
			.then((text) => text.replace(/\s+/g, "").length);
		assert.equal(await page.title(), "코칭 구조 시안 · BODYGUARD");
		await page
			.getByRole("button", { name: "전신", exact: true })
			.isVisible()
			.then(assert.ok);
		assert.equal(
			await page.locator(".comparison").getAttribute("data-view"),
			"full",
		);
		assert.equal(await page.locator(".avatar").count(), 2);
		const geometry = await page.locator(".body-window").evaluateAll((nodes) =>
			nodes.map((n) => {
				const r = n.getBoundingClientRect();
				return {
					left: r.left,
					right: r.right,
					top: r.top,
					bottom: r.bottom,
					width: r.width,
					height: r.height,
				};
			}),
		);
		assert.ok(geometry[1].left - geometry[0].right >= 32);
		assert.ok(Math.abs(geometry[0].height - geometry[1].height) < 1);
		const controls = await page.locator(".controls").boundingBox();
		assert.ok(geometry.every((r) => r.bottom < controls.y));
		assert.ok(
			controls.y + controls.height <= 900,
			"Primary controls must fit the target desktop viewport",
		);
		assert.ok(
			await page
				.locator("body")
				.innerText()
				.then(
					(text) =>
						text.includes("배치 예시") &&
						text.includes("카메라는 사용하지 않습니다."),
				),
		);
		await capture("full-1440.png");
	});
	await caseOf(
		"auxiliary explanation collapsed keyboard toggle and reset",
		async () => {
			assert.equal(await page.locator(".coaching-details").count(), 1);
			assert.equal(
				await page.locator(".coaching-details").evaluate((node) => node.open),
				false,
			);
			assert.ok(await page.locator("#note-description").isHidden());
			assert.ok(await page.locator(".example-note").isVisible());
			const summary = page.locator(".coaching-details summary");
			await summary.focus();
			await page.keyboard.press("Enter");
			assert.ok(await page.locator("#note-description").isVisible());
			assert.equal(
				await summary.evaluate((node) => getComputedStyle(node).outlineWidth),
				"3px",
			);
			await capture("explanation-open.png");
			await page.keyboard.press("Space");
			assert.ok(await page.locator("#note-description").isHidden());
			assert.ok(
				await summary.evaluate((node) => node === document.activeElement),
			);
			await summary.click();
			await page.locator("#end").click();
			await page
				.getByRole("button", { name: "계속 검토", exact: true })
				.click();
			assert.equal(
				await page.locator(".coaching-details").evaluate((node) => node.open),
				true,
			);
			await page.locator("#end").click();
			await page.locator("#confirm-end").click();
			assert.equal(
				await page.locator(".coaching-details").evaluate((node) => node.open),
				false,
			);
		},
	);
	await caseOf("upper and detail synchronized view", async () => {
		await page.getByRole("button", { name: "상반신", exact: true }).click();
		assert.equal(
			await page.locator(".comparison").getAttribute("data-view"),
			"upper",
		);
		assert.equal(
			await page
				.getByRole("button", { name: "상반신", exact: true })
				.getAttribute("aria-pressed"),
			"true",
		);
		await capture("upper-1440.png");
		await page.getByRole("button", { name: "자세히", exact: true }).click();
		assert.equal(
			await page.locator(".comparison").getAttribute("data-view"),
			"detail",
		);
		await capture("detail-1440.png");
	});
	await caseOf("motion dialog keyboard escape and selection", async () => {
		await page.getByRole("button", { name: "동작 변경", exact: true }).click();
		assert.ok(
			await page
				.getByRole("dialog", { name: "어떤 구도로 볼까요?" })
				.isVisible(),
		);
		for (let i = 0; i < 5; i += 1) {
			await page.keyboard.press("Tab");
			assert.ok(
				await page
					.locator("#motion-dialog")
					.evaluate((n) => n.contains(document.activeElement)),
			);
		}
		await page.keyboard.press("Escape");
		assert.ok(
			await page
				.locator("#change-motion")
				.evaluate((n) => n === document.activeElement),
		);
		await page.getByRole("button", { name: "동작 변경", exact: true }).click();
		await page.locator('[data-motion="upper"]').click();
		assert.equal(await page.locator("h1").innerText(), "목·어깨 스트레칭");
		assert.equal(
			await page.locator(".comparison").getAttribute("data-view"),
			"upper",
		);
		assert.equal(
			await page.locator('[data-stage="prepare"]').getAttribute("aria-current"),
			"step",
		);
	});
	await caseOf("settings view guidance and no persistence", async () => {
		await page.locator(".view-tools .settings-open").click();
		await page.locator("#default-view").selectOption("full");
		await page.locator("#show-guidance").uncheck();
		await page.keyboard.press("Escape");
		assert.equal(
			await page.locator(".comparison").getAttribute("data-view"),
			"full",
		);
		assert.ok(await page.locator(".coaching-note").isHidden());
		await page.reload();
		assert.ok(await page.locator(".coaching-note").isVisible());
		assert.equal(await page.locator("h1").innerText(), "전신 스트레칭");
	});
	await caseOf(
		"manual demonstration no real animation or completion",
		async () => {
			await page
				.getByRole("button", { name: "전체 시범", exact: true })
				.click();
			assert.ok(
				await page
					.getByRole("dialog")
					.innerText()
					.then((s) =>
						s.includes("실제 시범 애니메이션은 아직 연결하지 않았습니다."),
					),
			);
			await page.getByRole("button", { name: "유지", exact: true }).click();
			assert.equal(
				await page.locator('[data-stage="hold"]').getAttribute("aria-current"),
				"step",
			);
			assert.ok(
				await page
					.locator("#guide-description")
					.innerText()
					.then((s) => s.includes("타이머가 없습니다.")),
			);
			await page.keyboard.press("Escape");
			await page.locator("#pause").click();
			assert.equal(
				await page.locator("#pause").getAttribute("aria-pressed"),
				"true",
			);
			assert.equal(await page.locator("#pause-text").innerText(), "계속 보기");
		},
	);
	await caseOf("end confirm cancel and reset", async () => {
		await page.locator("#end").click();
		await page.getByRole("button", { name: "계속 검토", exact: true }).click();
		assert.equal(
			await page.locator("#pause").getAttribute("aria-pressed"),
			"true",
		);
		await page.locator("#end").click();
		await page.locator("#confirm-end").click();
		assert.equal(
			await page.locator("#pause").getAttribute("aria-pressed"),
			"false",
		);
		assert.equal(
			await page.locator('[data-stage="prepare"]').getAttribute("aria-current"),
			"step",
		);
		assert.ok(
			await page
				.locator("#interaction-status")
				.innerText()
				.then((s) => s.includes("저장된 데이터는 없습니다.")),
		);
	});
	await caseOf("menus explain scope instead of inventing pages", async () => {
		for (const info of ["home", "records", "account"]) {
			await page.locator(`[data-info="${info}"]`).click();
			assert.ok(await page.locator("#info-dialog").isVisible());
			await page.keyboard.press("Escape");
			assert.equal(new URL(page.url()).pathname, "/");
		}
	});
	await caseOf(
		"narrow desktop and CSS zoom no horizontal clipping",
		async () => {
			for (const width of [1280, 1024, 820]) {
				await page.setViewportSize({ width, height: 800 });
				await settle();
				assert.ok(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= window.innerWidth,
					),
				);
				await capture(`full-${width}.png`);
			}
			await page.setViewportSize({ width: 1280, height: 900 });
			await page.evaluate(() => {
				document.documentElement.style.zoom = "2";
			});
			assert.ok(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
			);
			await capture("css-zoom-200.png", true);
			await page.evaluate(() => {
				document.documentElement.style.zoom = "";
			});
		},
	);
	await caseOf(
		"keyboard visible focus reduced motion and text contrast",
		async () => {
			await page.locator("#change-motion").focus();
			const styles = await page.locator("#change-motion").evaluate((n) => {
				const s = getComputedStyle(n);
				return {
					outline: s.outlineStyle,
					outlineWidth: s.outlineWidth,
					transition: s.transitionDuration,
				};
			});
			assert.equal(styles.outline, "solid");
			assert.equal(styles.outlineWidth, "3px");
			assert.equal(styles.transition, "0s");
			const computed = await page.evaluate(() => {
				const nodes = [
					"#pause",
					".prototype-label",
					".stage-caption",
					".coaching-details summary",
				];
				return nodes.map((q) => {
					const s = getComputedStyle(document.querySelector(q));
					return { q, color: s.color, background: s.backgroundColor };
				});
			});
			const luminance = (rgb) =>
				rgb
					.match(/[\d.]+/g)
					.slice(0, 3)
					.map(Number)
					.map((v) => {
						const x = v / 255;
						return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
					})
					.reduce(
						(sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i],
						0,
					);
			for (const row of computed) {
				const a = luminance(row.color);
				const b =
					row.background === "rgba(0, 0, 0, 0)"
						? luminance("rgb(251,252,254)")
						: luminance(row.background);
				row.ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
				assert.ok(row.ratio >= 4.5);
			}
			await writeFile(
				path.join(out, "contrast.json"),
				JSON.stringify({ computed, styles }, null, 2),
			);
		},
	);
	await caseOf("asset failure recover without fake live state", async () => {
		await page.route("**/assets/approved-reference.png*", (route) =>
			route.abort(),
		);
		await page.reload();
		await page.locator("#asset-error").waitFor({ state: "visible" });
		assert.ok(await page.locator(".avatar").first().isHidden());
		await capture("asset-failure.png");
		await page.locator("#reload-assets").click();
		await page.waitForFunction(
			() => !document.querySelector("#reload-assets").disabled,
		);
		assert.ok(
			await page.locator("#asset-error").isVisible(),
			"Failed retry must not restore a fake model",
		);
		await page.unroute("**/assets/approved-reference.png*");
		await page.locator("#reload-assets").click();
		await page.locator("#asset-error").waitFor({ state: "hidden" });
		assert.ok(await page.locator(".avatar").first().isVisible());
	});
	await caseOf("no camera storage API egress or JS errors", async () => {
		const proof = await page.evaluate(() => window.designProof);
		assert.equal(proof.camera, 0);
		assert.equal(proof.storageWrites, 0);
		assert.deepEqual(proof.errors, []);
		assert.deepEqual(
			cumulativeProof,
			{ camera: 0, storageWrites: 0, errors: [] },
			"Boundary covers every page reload",
		);
		assert.ok(requests.every((request) => request.startsWith(`${url}/`)));
		assert.ok(
			!requests.some((request) => new URL(request).pathname.startsWith("/api")),
		);
		await writeFile(
			path.join(out, "boundary.json"),
			JSON.stringify(
				{
					proof,
					cumulativeProof,
					paths: [...new Set(requests.map((r) => new URL(r).pathname))],
					externalRequests: 0,
				},
				null,
				2,
			),
		);
	});
} finally {
	await browser?.close();
	await new Promise((resolve) => server.close(resolve));
	const sources = await snapshot();
	assert.equal(gitHead(), executedHead, "Git HEAD changed during browser run");
	assert.deepEqual(
		sources,
		sourcesBefore,
		"Source changed during actual browser run",
	);
	const report = {
		timestamp: new Date().toISOString(),
		executedHead,
		sourceHashTiming:
			"captured before server/browser startup and after teardown",
		sourcesBefore,
		sourceUnchangedAcrossExecution: true,
		initialVisibleTextCharacters,
		scope:
			"static design prototype UI only; not webcam/avatar/clinical/product verification",
		sources,
		results,
	};
	await writeFile(
		path.join(out, "report.json"),
		JSON.stringify(report, null, 2),
	);
	console.log(JSON.stringify(report, null, 2));
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
