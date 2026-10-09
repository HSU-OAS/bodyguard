// NFR-08: build independent review only, never product dist or old evidence.
import assert from "node:assert/strict";
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [runtime, proof, label = "bundle"] = process.argv.slice(2);
assert(
	runtime &&
		/^\/private\/tmp\/bodyguard-visual-selection-proof\.[A-Za-z0-9]+$/.test(
			proof,
		),
);
assert(
	/^[a-z0-9-]+$/.test(label) &&
		realpathSync(proof) === proof &&
		!existsSync(join(proof, label)),
);
const { build } = await import(
	pathToFileURL(
		join(realpathSync(runtime), "node_modules/vite/dist/node/index.js"),
	).href
);
const three = join(realpathSync(runtime), "node_modules/three");
await build({
	configFile: false,
	root: realpathSync(runtime),
	publicDir: false,
	resolve: {
		alias: [
			{ find: /^three\/addons\//, replacement: `${three}/examples/jsm/` },
			{ find: /^three$/, replacement: `${three}/build/three.module.js` },
		],
	},
	build: {
		outDir: join(proof, label),
		emptyOutDir: false,
		minify: false,
		lib: {
			entry: fileURLToPath(new URL("preview.ts", import.meta.url)),
			formats: ["es"],
			fileName: () => "preview.js",
		},
	},
});
