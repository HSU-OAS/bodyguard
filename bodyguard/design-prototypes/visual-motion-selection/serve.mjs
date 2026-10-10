// NFR-08: loopback review only. Explicit routes; never a filesystem/API proxy.
import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [proof, bundle = "bundle-reviewed"] = process.argv.slice(2);
assert(
	/^\/private\/tmp\/bodyguard-visual-selection-proof\.[A-Za-z0-9]+$/.test(
		proof,
	) && realpathSync(proof) === proof,
);
assert(/^[a-z0-9-]+$/.test(bundle));
const root = fileURLToPath(new URL("./", import.meta.url));
const routes = new Map([
	["/", join(root, "index.html")],
	["/index.html", join(root, "index.html")],
	...["style.css", "prototype.js"].map((file) => [
		`/${file}`,
		join(root, file),
	]),
	["/preview.js", join(proof, bundle, "preview.js")],
	[
		"/assets/approved-reference.png",
		join(root, "../clinical-coaching/assets/approved-reference.png"),
	],
	...["male", "female"].map((gender) => [
		`/__private-native-${gender}.glb`,
		join(proof, "assets", `${gender}.glb`),
	]),
	[
		"/__private-native-reference-fixture.json",
		join(proof, "assets/authored-fixture.json"),
	],
]);
assert(
	[...routes.values()].every(existsSync),
	"Build and preserved model assets required",
);
const server = createServer((req, res) => {
	const file = routes.get(new URL(req.url, "http://localhost").pathname);
	if (!file || req.method !== "GET") return res.writeHead(404).end();
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
server.listen(0, "127.0.0.1", () =>
	console.log(
		`BODYGUARD 디자인 시안 http://127.0.0.1:${server.address().port}/ · 임시 모델/시험 동작 · 카메라/API/저장 없음`,
	),
);
for (const name of ["SIGINT", "SIGTERM"])
	process.once(name, () => server.close(() => process.exit(0)));
