/* FR-A-01/02, FR-S-03/06, NFR-08: 구조 검토용 상태. 실제 수행/판정/카메라 없음. */
(() => {
	const find = (selector) => document.querySelector(selector);
	const all = (selector) => [...document.querySelectorAll(selector)];
	const icons = {
		home: '<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3z"/>',
		stretch:
			'<circle cx="14" cy="4" r="2"/><path d="m3 9 7-2 5 3 6-2M11 8l-1 7-5 6m5-6 6 2 3 4"/>',
		chart: '<path d="M5 20V12m7 8V4m7 16V8"/>',
		settings:
			'<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
		change: '<path d="M3 7h14l-4-4m4 4-4 4M21 17H7l4 4m-4-4 4-4"/>',
		user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
		pause: '<path d="M8 4v16M16 4v16"/>',
		play: '<path d="m8 4 12 8-12 8z"/>',
		exit: '<path d="M10 3H4v18h6m4-14 5 5-5 5m-5-5h10"/>',
		close: '<path d="m5 5 14 14M5 19 19 5"/>',
	};
	all("[data-icon]").forEach((node) => {
		node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[node.dataset.icon]}</svg>`;
	});
	const states = {
		prepare: "준비",
		perform: "수행",
		hold: "유지",
		return: "복귀",
	};
	const explanations = {
		prepare: "준비: 실제 코칭에서는 촬영 조건을 먼저 확인합니다.",
		perform:
			"수행: 실제 코칭에서는 현재 단계와 확인된 오류에 맞는 시범을 보여줍니다.",
		hold: "유지: 필요한 동작에만 검증된 유지시간 안내를 연결합니다. 이 시안에는 타이머가 없습니다.",
		return: "복귀: 실제 코칭에서는 검증된 복귀 과정을 보여줍니다.",
	};
	const views = {
		full: ["전신 구도", "두 아바타를 머리부터 발끝까지 함께 보여줍니다."],
		upper: [
			"상반신 구도",
			"두 아바타의 머리·목·어깨·몸통을 같은 배율로 보여줍니다.",
		],
		detail: [
			"어깨 자세히",
			"두 아바타의 어깨 주변을 함께 확대합니다. 화면 확대는 촬영 가능 범위를 바꾸지 않습니다.",
		],
	};
	let stage = "prepare";
	let paused = false;
	let motion = "full";
	let dialogTrigger = null;
	const status = (text) => {
		find("#interaction-status").textContent = text;
	};
	function setView(view, announce = true) {
		if (!views[view]) return;
		find(".comparison").dataset.view = view;
		all("[data-view]")
			.filter((n) => n.tagName === "BUTTON")
			.forEach((n) => {
				n.setAttribute("aria-pressed", String(n.dataset.view === view));
			});
		find("#default-view").value = view;
		find("#note-title").textContent = views[view][0];
		find("#note-description").textContent = views[view][1];
		if (announce) status(`${views[view][0]} · 정적 이미지`);
	}
	function setStage(next) {
		stage = next;
		all("[data-stage]").forEach((node) => {
			if (node.dataset.stage === stage)
				node.setAttribute("aria-current", "step");
			else node.removeAttribute("aria-current");
		});
		all("[data-preview-stage]").forEach((node) => {
			node.setAttribute(
				"aria-pressed",
				String(node.dataset.previewStage === stage),
			);
		});
		find("#guide-description").textContent = explanations[stage];
		status(`${states[stage]} 단계 안내 예시 · 실제 판정 없음`);
	}
	function openDialog(id, trigger) {
		dialogTrigger = trigger;
		find(id).showModal();
	}
	all("dialog").forEach((dialog) => {
		// NFR-08: 마지막 조작부에서 Tab 시 배경이나 브라우저 UI로 빠지지 않도록 순환.
		dialog.addEventListener("keydown", (event) => {
			if (event.key !== "Tab") return;
			const items = [
				...dialog.querySelectorAll(
					"button:not(:disabled), select, input:not(:disabled)",
				),
			];
			const first = items[0];
			const last = items.at(-1);
			if (
				(!event.shiftKey && document.activeElement === last) ||
				(event.shiftKey && document.activeElement === first)
			) {
				event.preventDefault();
				(event.shiftKey ? last : first)?.focus();
			}
		});
		dialog.addEventListener("close", () => {
			dialogTrigger?.focus();
		});
		dialog.querySelectorAll(".dialog-close").forEach((button) => {
			button.addEventListener("click", () => dialog.close());
		});
	});
	all("button[data-view]").forEach((button) => {
		button.addEventListener("click", () => setView(button.dataset.view));
	});
	all(".settings-open").forEach((button) => {
		button.addEventListener("click", () =>
			openDialog("#settings-dialog", button),
		);
	});
	find("#default-view").addEventListener("change", (event) =>
		setView(event.target.value),
	);
	find("#show-guidance").addEventListener("change", (event) => {
		find(".coaching-note").hidden = !event.target.checked;
		status(
			`화면 설명을 ${event.target.checked ? "표시" : "숨김"} 처리했습니다. 저장하지 않습니다.`,
		);
	});
	[find("#motion-menu"), find("#change-motion")].forEach((button) => {
		button.addEventListener("click", () =>
			openDialog("#motion-dialog", button),
		);
	});
	all("[data-motion]").forEach((button) => {
		button.addEventListener("click", () => {
			motion = button.dataset.motion;
			find("#motion-title").textContent =
				motion === "upper" ? "목·어깨 스트레칭" : "전신 스트레칭";
			find("#framing-description").textContent =
				motion === "upper"
					? "실제 코칭에서는 머리·목·어깨 등 필요한 부위가 보이는지 확인합니다."
					: "실제 코칭에서는 동작에 필요한 관절이 보이는지 먼저 확인합니다.";
			setView(motion, false);
			setStage("prepare");
			paused = false;
			find("#pause").setAttribute("aria-pressed", "false");
			find("#pause-text").textContent = "일시정지";
			find("#motion-dialog").close();
			status(
				"배치용 후보를 바꿨습니다. 검증된 출시 동작을 선택한 것은 아닙니다.",
			);
		});
	});
	[find("#whole-demo"), find("#preview-guide")].forEach((button) => {
		button.addEventListener("click", () => openDialog("#guide-dialog", button));
	});
	all("[data-preview-stage]").forEach((button) => {
		button.addEventListener("click", () =>
			setStage(button.dataset.previewStage),
		);
	});
	find("#pause").addEventListener("click", () => {
		paused = !paused;
		find("#pause").setAttribute("aria-pressed", String(paused));
		find("#pause-text").textContent = paused ? "계속 보기" : "일시정지";
		status(
			paused
				? "시안 조작의 정지 상태 예시입니다. 실제 추적·시범은 실행되지 않습니다."
				: "시안 검토를 계속합니다. 실제 추적·시범은 실행되지 않습니다.",
		);
	});
	const info = {
		home: [
			"홈 화면 검토 범위",
			"홈의 신체 확인·추천받기와 직접 선택 진입은 다음 화면 구조 검토에서 다룹니다. 이번 시안에 새 홈 화면을 추가하지 않았습니다.",
		],
		records: [
			"기록 화면 검토 범위",
			"이 시안에는 실제 수행 기록이나 계정 데이터가 없습니다. 기존 기록 기능의 디자인 적용은 구조 검토 이후 별도로 진행합니다.",
		],
		account: [
			"계정 화면 검토 범위",
			"로그인·회원가입·계정과 데이터 관리는 기존 서비스의 필수 범위입니다. 이 시안에서는 로그인한 것으로 꾸미거나 개인 정보를 입력받지 않습니다.",
		],
	};
	all("[data-info]").forEach((button) => {
		button.addEventListener("click", () => {
			const text = info[button.dataset.info];
			find("#info-title").textContent = text[0];
			find("#info-description").textContent = text[1];
			openDialog("#info-dialog", button);
		});
	});
	find("#end").addEventListener("click", (event) =>
		openDialog("#end-dialog", event.currentTarget),
	);
	find("#confirm-end").addEventListener("click", () => {
		paused = false;
		motion = "full";
		find("#pause").setAttribute("aria-pressed", "false");
		find("#pause-text").textContent = "일시정지";
		find("#motion-title").textContent = "전신 스트레칭";
		find("#framing-description").textContent =
			"실제 코칭에서는 동작에 필요한 관절이 보이는지 먼저 확인합니다.";
		find("#show-guidance").checked = true;
		find(".coaching-note").hidden = false;
		find(".coaching-details").open = false;
		setView("full", false);
		setStage("prepare");
		find("#end-dialog").close();
		status("처음으로 돌아왔습니다. 저장된 데이터는 없습니다.");
	});
	let failed = false;
	let retryCleanup = () => {};
	function assetFailure() {
		failed = true;
		all(".avatar").forEach((node) => {
			node.hidden = true;
		});
		find("#asset-error").hidden = false;
		find("#reload-assets").disabled = false;
		status(
			"예시 이미지 연결이 끊겼습니다. 코칭 성공이나 실제 추적으로 표시하지 않습니다.",
		);
	}
	all(".body-source").forEach((img) => {
		img.addEventListener("error", assetFailure);
		if (img.complete && img.naturalWidth === 0) assetFailure();
	});
	find("#reload-assets").addEventListener("click", () => {
		// 캐시 우회도 같은 로컬 정적 이미지에만 요청. 카메라/API 요청 없음.
		retryCleanup();
		const images = all(".body-source");
		const loaded = new Set();
		const listeners = [];
		find("#reload-assets").disabled = true;
		retryCleanup = () => {
			listeners.forEach(([img, listener]) => {
				img.removeEventListener("load", listener);
			});
		};
		for (const img of images) {
			const listener = () => {
				loaded.add(img);
				if (loaded.size === images.length) {
					failed = false;
					retryCleanup();
					all(".avatar").forEach((n) => {
						n.hidden = false;
					});
					find("#asset-error").hidden = true;
					find("#reload-assets").disabled = false;
					status("정적 예시 이미지를 다시 불러왔습니다.");
				}
			};
			listeners.push([img, listener]);
			img.addEventListener("load", listener);
			img.src = `assets/approved-reference.png?retry=${Date.now()}`;
		}
	});
	setStage(stage);
	setView("full", false);
	if (!failed) status("정적 시안입니다. 카메라는 사용하지 않습니다.");
})();
