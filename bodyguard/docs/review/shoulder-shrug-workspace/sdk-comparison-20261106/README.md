# MediaPipe SDK 종료 오류: 버전 비교 시험

2026-11-06 · Draft PR #163 · **오류 미해결, 버전 변경 없음**

기존 1.0.1과 npm 공식 최신 1.2.2를 별도 파일/Worker로 비교했다. 1.2.2 tarball의 registry SHA-512 무결성은 `sha512-Z7BikxnTvlKgc3d/Nw+LV6B0xyAACxYeAHHUu/xUhm1SV7jlExa9M37beiF/wZFoy0H+cs1PlIT2Z4km02UEHQ==`로 확인했다. 기존 `node_modules`, lockfile, product SDK와 WASM은 변경하지 않았다. 새 Worker bundle SHA-256은 `1326abb60cd239f3b91dbf8789720b2ffdf8a7b75fb148ba5d51ab74633bf97f`다.

시험 Vite가 만든 실제 제품 Worker 소스에만 새 패키지를 번들링하고 Playwright route로 같은 출처의 새 Worker/WASM을 공급했다. Worker 응답에는 `connect-src 'self'`를 포함한 시험 CSP를 적용했고 proxy·route의 외부 차단을 유지했다. 카메라는 Chrome의 빈 가짜 장치이며 실제 사용자·영상·정확도 검사는 아니다. 추론/정리의 기존 5초 마감과 실제 SDK 옵션/모델은 유지했다.

- `sdk122-native` + 합성 `sdk122-ui`: UI 4흐름은 통과했으나 새 SDK의 init 후 ready가 5초 내 오지 않았고, 종료 ACK도 5초 내 오지 않아 `cleanup-error`로 종료했다. 카메라 해제는 확인했다. [네이티브](evidence/sdk122-native.json), [UI](evidence/sdk122-ui.json).
- `sdk122-solo`: 합성 UI를 동시 실행하지 않았으나 동일하게 init 및 종료가 timeout됐다. [결과](evidence/sdk122-solo.json).
- `sdk101-solo`: 기존 SDK도 같은 시점에 단독 실행에서 init 및 종료 timeout을 보였다. [결과](evidence/sdk101-solo.json).

각 시험에서 외부 요청은 0이고 실제 추론 프레임은 0이다. 당시 노트북에서 별도 브라우저 렌더러와 시스템 프로세스 등의 CPU 사용이 높았고, 시험 간 부하가 완전히 같았다고 보장하지 못한다. 이 결과는 새 SDK의 호환성/정확도 검증이나 버전 자체의 결함 증명이 아니다. 두 버전 모두 해당 조건에서 통과하지 못했으므로 업그레이드를 해결책으로 채택하지 않고 P2를 유지한다. 실행 runner와 원문 로그·JSON은 `executed/`, `evidence/`에 보존한다. 원본 패키지는 저작권 확인 전 저장소에 복제하지 않는다.
