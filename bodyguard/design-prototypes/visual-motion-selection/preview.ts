// FR-A-03/NFR-08: design only, preserved Blender test clip/GLBs; no camera/verdict/API.
import {
	AnimationMixer,
	Color,
	DirectionalLight,
	HemisphereLight,
	LoopOnce,
	OrthographicCamera,
	Scene,
	WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { nativeReferenceProgram } from "../../frontend/e2e/fixtures/nativeReferenceProgram";
import { prepareOwnedAvatarPair } from "../../frontend/src/avatar/ownedAvatarPair";
import {
	createOwnedMotionPreview,
	type PreviewAsset,
} from "../../frontend/src/avatar/ownedMotionPreview";
import { copyReferenceProgram } from "../../frontend/src/avatar/referencePlayback";
import { ResourceCleanupError } from "../../frontend/src/coaching/resources";

const element = <T extends Element>(selector: string): T => {
	const node = document.querySelector<T>(selector);
	if (!node) throw new Error("Design preview elements unavailable");
	return node;
};
const dialog = element<HTMLDialogElement>("#motion-dialog");
const canvas = element<HTMLCanvasElement>("#motion-preview canvas");
const trigger = element<HTMLButtonElement>("#motion-preview");
const play = element<HTMLButtonElement>("#preview-play");
const stopButton = element<HTMLButtonElement>("#preview-stop");
const retry = element<HTMLButtonElement>("#preview-retry");
const placeholder = element<HTMLSpanElement>("#preview-placeholder");
const status = element<HTMLParagraphElement>("#preview-status");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let gender: "male" | "female" = "male",
	generation = 0,
	opened = false,
	removed = false;
let posterReady = false,
	manual = false,
	explicitStopped = false,
	pointer = false,
	focused = false;
let loads = 0,
	releases = 0,
	frames = 0,
	live = 0,
	peak = 0,
	positionMs = 0;
let posterAbort = new AbortController(),
	posterBarrier = Promise.resolve(),
	poll: ReturnType<typeof setInterval> | undefined;
let posterFailure = false;
let cleanupFailed = false;
let lease = Promise.resolve();
const queued = new Set<number>();

async function loadAsset(
	selected: "male" | "female",
	signal: AbortSignal,
): Promise<PreviewAsset> {
	const earlier = lease;
	let releaseLease!: () => void;
	lease = new Promise<void>((yes) => {
		releaseLease = yes;
	});
	await earlier;
	let pair: Awaited<ReturnType<typeof prepareOwnedAvatarPair>>;
	let program: ReturnType<typeof copyReferenceProgram>;
	try {
		if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
		program = copyReferenceProgram(await nativeReferenceProgram(selected));
		if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
		pair = await prepareOwnedAvatarPair(
			{ generation: ++generation, signal },
			{
				load: async () =>
					(
						await new GLTFLoader().loadAsync(
							`/__private-native-${selected}.glb`,
						)
					).scene,
				mirror: false,
				halfLifeMs: 30,
				maxAgeMs: 250,
			},
		);
	} catch (error) {
		releaseLease();
		throw error;
	}
	const model = pair.models?.[0];
	if (!model) {
		try {
			pair.dispose();
		} finally {
			releaseLease();
		}
		throw new Error("Design model unavailable");
	}
	const clip = program.steps[0].clips["seeking-target"],
		mixer = new AnimationMixer(model);
	const action = mixer.clipAction(clip);
	action.setLoop(LoopOnce, 1);
	action.clampWhenFinished = true;
	action.play();
	const scene = new Scene();
	scene.background = new Color("#f1f6fc");
	scene.add(model, new HemisphereLight(0xffffff, 0xb8c8d8, 2.5));
	const key = new DirectionalLight(0xffffff, 3);
	key.position.set(2, 4, 3);
	scene.add(key);
	const camera = new OrthographicCamera(-0.706, 0.706, 1, -1, 0.01, 20);
	camera.position.set(0, 0.86, 4);
	camera.lookAt(0, 0.86, 0);
	let renderer: WebGLRenderer | undefined,
		closed = false;
	loads++;
	live++;
	peak = Math.max(peak, live);
	const close = () => {
		if (closed) return;
		closed = true;
		let failed = false;
		for (const clean of [
			() => mixer.stopAllAction(),
			() => mixer.uncacheRoot(model),
			() => model.removeFromParent(),
			() => pair.dispose(),
			() => renderer?.dispose(),
		]) {
			try {
				clean();
			} catch {
				failed = true;
			}
		}
		releases++;
		live--;
		releaseLease();
		if (failed) throw new ResourceCleanupError();
	};
	try {
		renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			preserveDrawingBuffer: true,
		});
		renderer.setPixelRatio(1);
		renderer.setSize(480, 680, false);
	} catch (error) {
		close();
		throw error;
	}
	return {
		durationMs: clip.duration * 1000,
		draw(ms) {
			positionMs = ms;
			frames++;
			action.reset().play();
			mixer.setTime(ms / 1000);
			model.updateMatrixWorld(true);
			if (!renderer || closed) throw new Error("Design renderer unavailable");
			renderer.render(scene, camera);
			posterReady = true;
		},
		dispose: close,
	};
}
const player = createOwnedMotionPreview({
	scheduler: {
		request(callback) {
			const id = requestAnimationFrame((now) => {
				queued.delete(id);
				callback(now);
			});
			queued.add(id);
			return id;
		},
		cancel(id) {
			cancelAnimationFrame(id);
			queued.delete(id);
		},
	},
	async load(selected, signal) {
		await posterBarrier;
		if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
		return loadAsset(selected === "female" ? "female" : "male", signal);
	},
});
function sync() {
	const current = player.snapshot(),
		playing = current.status === "playing";
	canvas.style.visibility = posterReady ? "visible" : "hidden";
	placeholder.hidden = posterReady;
	play.setAttribute("aria-pressed", String(playing || manual));
	cleanupFailed ||= current.failure === "cleanup-failed";
	const failed = current.status === "failed" || posterFailure || cleanupFailed;
	retry.hidden = !failed || cleanupFailed;
	play.disabled = cleanupFailed;
	trigger.disabled = cleanupFailed;
	document
		.querySelectorAll<HTMLButtonElement>("[data-preview-gender]")
		.forEach((node) => {
			node.disabled = cleanupFailed;
		});
	const next = failed
		? "미리보기 실패 · 다시 불러오기"
		: !posterReady || current.status === "loading"
			? "불러오는 중"
			: playing
				? "제작 시험 재생 중"
				: "제작 시험 · 정지";
	if (status.textContent !== next) status.textContent = next;
	if (cleanupFailed)
		status.textContent = "미리보기 종료 실패 · 창을 닫아 주세요";
}
function input() {
	player.update({
		visible: opened && !document.hidden && !removed && !cleanupFailed,
		reducedMotion: reduced.matches,
		manual,
		pointer: !explicitStopped && pointer,
		focus: !explicitStopped && focused,
	});
	sync();
}
function stop() {
	manual = false;
	explicitStopped = true;
	input();
}
function poster() {
	if (cleanupFailed || removed) return;
	const selected = gender;
	const owner = new AbortController();
	posterAbort = owner;
	posterReady = false;
	posterFailure = false;
	placeholder.textContent = "불러오는 중";
	sync();
	// One barrier serializes static draw with active/late preview loads. No second live model owner.
	posterBarrier = posterBarrier
		.then(async () => {
			if (owner.signal.aborted || !opened || removed) return;
			let asset: PreviewAsset | undefined;
			try {
				asset = await loadAsset(selected, owner.signal);
				if (
					!owner.signal.aborted &&
					opened &&
					selected === gender &&
					!removed &&
					!document.hidden
				)
					asset.draw(0);
			} catch {
				if (!owner.signal.aborted && opened) {
					posterFailure = true;
					placeholder.textContent = "불러오기 실패";
				}
			} finally {
				asset?.dispose();
			}
			sync();
		})
		.catch(() => {
			cleanupFailed = true;
			placeholder.textContent = "종료 실패";
			sync();
		});
}
function open() {
	if (opened || removed) return;
	opened = true;
	explicitStopped = false;
	manual = false;
	pointer = false;
	focused = false;
	player.select(gender);
	input();
	poster();
	poll = setInterval(sync, 100);
}
function close() {
	opened = false;
	posterAbort.abort();
	manual = false;
	pointer = false;
	focused = false;
	explicitStopped = true;
	input();
	player.select(null);
	clearInterval(poll);
	sync();
}
const observer = new MutationObserver(() => (dialog.open ? open() : close()));
observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
dialog.addEventListener("close", close);
trigger.addEventListener("pointerenter", () => {
	pointer = true;
	if (!focused) explicitStopped = false;
	input();
});
trigger.addEventListener("pointerleave", () => {
	pointer = false;
	input();
});
trigger.addEventListener("focus", () => {
	focused = true;
	if (!pointer) explicitStopped = false;
	input();
});
trigger.addEventListener("blur", () => {
	focused = false;
	input();
});
trigger.addEventListener("click", () => {
	if (player.snapshot().status === "playing" || manual) stop();
	else {
		explicitStopped = false;
		manual = true;
		input();
	}
});
play.addEventListener("click", () => {
	explicitStopped = false;
	manual = true;
	input();
});
stopButton.addEventListener("click", stop);
retry.addEventListener("click", () => {
	posterAbort.abort();
	player.retry();
	stop();
	poster();
});
document
	.querySelectorAll<HTMLButtonElement>("[data-preview-gender]")
	.forEach((button) => {
		button.addEventListener("click", () => {
			if (cleanupFailed) return;
			if (button.dataset.previewGender === gender) return;
			posterAbort.abort();
			stop();
			player.select(null);
			gender = button.dataset.previewGender === "female" ? "female" : "male";
			document
				.querySelectorAll<HTMLButtonElement>("[data-preview-gender]")
				.forEach((node) => {
					node.setAttribute(
						"aria-pressed",
						String(node.dataset.previewGender === gender),
					);
				});
			player.select(gender);
			poster();
		});
	});
document.addEventListener("visibilitychange", () => {
	if (document.hidden) {
		posterAbort.abort();
		manual = false;
		pointer = false;
		focused = false;
		explicitStopped = true;
	}
	input();
	if (!document.hidden && opened && !posterReady && !posterFailure) poster();
});
reduced.addEventListener("change", input);
window.addEventListener(
	"pagehide",
	() => {
		close();
		removed = true;
		observer.disconnect();
		void player.dispose().catch(() => {});
	},
	{ once: true },
);
// Scalar design QA only, never raw poses or camera data.
Object.assign(window, {
	designPreview: Object.freeze({
		snapshot: () => ({
			...player.snapshot(),
			gender,
			posterReady,
			frames,
			loads,
			releases,
			live,
			peak,
			queued: queued.size,
			positionMs,
		}),
	}),
});
