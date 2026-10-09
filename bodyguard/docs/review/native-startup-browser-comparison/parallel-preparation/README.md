# 독립 준비 중첩 — 실제 결과, S6.17 미완료

카메라 소유권 뒤 SDK와 두 기존 아바타 준비가 동시에 시작된다. 양쪽 완료 전에는 코칭/첫 입력을 시작하지 않는다. 최초 준비 실패는 다른 factory의 취소 오류로 덮지 않으며, 취소·늦은 반환·세대 교체·별칭·정리 실패에서도 자원을 회수한다. 공개 코칭 활성화나 최종 아바타 제작 결과가 아니다.

## 실제 작동한 흐름

- Chrome154/155 각각 남녀26건: 시작·목/몸통·필요 부위/가림·presence·새 세대·현재 오류→저작된 수정 시범·중단 기록·401/로그아웃/페이지 종료/이전 owner 차단을 확인했다. 실제 SDK/API/격리 SQL에 가상 카메라·합성 양성/동작 단계/오류/저작 fixture를 결합한 비공개 검증이다. 실제 사람의 올바른 자세 판정을 확인한 시험은 아니다.
- Chrome154 전체 계측26건: 모든 종료 timing이 closed/invalid=false·유한한 고정 stage였다. 추가 renderer4건은 준비 중 logout/pagehide 후 늦은 compile에도 ready/render/입력/저장0·생성한 SDK 전부 회수·카메라 종료·models0·GPU memory baseline을 확인했다.
- 최종 FE1432·타입·Biome·공개 build/guard는 exit0이다. 공개 JS/CSS는 baseline과 byte/hash 동일하고 GLB·모델·화질·판정/5초/60초/retry0·SDK 정책·운영 변경0이다.

## 성능 결과 — 전체 지연 개선 아님

[같은 제목26건의 보존된 계측 비교](timing-comparison.json): avatar/SDK 구간 중첩은0→26건, 중첩 중앙값256.2ms였다. 그러나 camera-ready→첫 render 중앙값1714.2→1706.5ms, third-result2997.5→2992.2ms로 거의 같았다. SDK chain은1305.6→1641.0ms로 증가했고 첫 native result는807.0→806.2ms였다. 단일 main-thread의 SDK/GLTF 처리 경쟁이 가능한 설명이지만 환경/순서/캐시를 격리하지 않아 원인으로 입증하지 않는다. **실제 준비 중첩만 확인했으며 전체 시작 속도/끊김/과거 실패 해결을 주장하지 않는다.** 다음은 main-thread 복합 추론의 준비/첫 결과/반복 입력 병목을 소유권·동일 입력 계약 아래 다룬다. 정상 시험 반복만으로 P2를 닫지 않는다.

## 실패 보존과 계약 변경

초기 unit156pass/6fail, 최초 Chrome154 일반12pass/1fail, renderer0pass/2fail, DB sandbox 차단0browser를 모두 보존했다. unit5건은 SDK 이전 avatar 준비를 허용한 변경에 맞춰 실제 pair 회수/ready 없음으로 보강했고1건은 실제 오류 원인 덮임을 고쳤다. timing2건만 `avatar after camera`, `render after SDK AND avatar`로 변경했으며 다른24건 body/guard/loop는 원본 그대로다. renderer 추가4건의 정리는 camera마다 SDK가 생겼다고 가정하지 않고 실제 생성 성공 수와 close 수를 비교한다. 일반26의 전체 SDK 정리 guard는 유지한다. 생기지 않은 SDK를 종료 후 새로 만들지 않는다.

[정확한 변경 비교기](../compare-parallel-contract.mjs)는 baseline의 이 타이밍/추가 renderer/공통 hook 변경만 허용한다. 최초 비교기의 원본에 추가 renderer template가 없다는 오류와 실패/수정 소스도 보존했다. [원본 거부 시험](negative-contract-result.json)은 정상 복사본1개를 승인하고 SDK/카메라 장벽 제거·result/poll 완화·timeout 확대5개를 거부했다. [증거 거부 시험](negative-evidence-result.json)은 정상 복사본과 허위 출시/시작 해결·실패/계측 삭제·회수/hash/source/계약 변조8개를 구분했다. 이들은 시험 장치 검증이지 브라우저/임상 재시험이 아니다.

소스 허용 목록을 정확히9파일로 강화한 최종 verifier에서도 [별도 새 복사본의 동일8개 거부](negative-evidence-final-result.json)를 실제 확인했다. 이전 복사본/결과는 보존했다.

[manifest](manifest.json)의17개 압축 bundle에 실제12개 브라우저 실행의 report·stdout/stderr·명령 receipt·소스 전후 hash·허용 snapshot, 단계별 로컬 결과 및 최초 실패 소스를 담았다. 첫 unit의 독립 command receipt는 없고 JSON/대화 출력만 있다. 실패한 renderer2건에는 afterEach assertion 전에 중단되어 final summary가 없으며 이를 만들지 않았다. 기존9실행/457개 증거와 모든 원본/실패/이미지는 보존했다. private root는 `/private/tmp/bodyguard-native-cold-stage.rrMOG8`이고 실제 카메라 원본/인체 좌표·임의 환경·DB/메일함·GitHub/키는 수집하지 않는다.

## 작성자 리뷰 · Request changes

| 검토 | 결론 |
|---|---|
| 보안/개인정보 | 오류는 불변인3개 stage code만 전달. TEST ONLY 초기화 횟수·기존 유한 timing만 기록. 외부/원시 데이터/공개 SDK 정책 변경0 |
| 정확성 | 양쪽 ready·첫 실패 보존·late/cancel/세대/별칭 회수·cleanup poison 확인. 계약 변경과 과거 실패를 숨기지 않음 |
| 성능 | 실제 overlap은 확인했지만 전체 시작/추론 정체는 그대로. 기존 시작P2 미해결, 완료/병합 불가 |
| 유지보수 | 기존 소유권·retirement 재사용, 독립 factory만 opt-in. 일반 caller 기본 직렬. 원본/새 증거/계약/검증을 분리 |

`engineering:code-review` 기준의 작성자 검토이며 독립 에이전트·전문가 검토가 아니다. Story/시작P2·D2/전체1~6은 미완료다. 실제 사람/동작별 기준·최종 외형/권리·승인 웹 구조/SDK 정책·참여자/다장치·공급자·Docker/HTTPS/운영 검증은 남는다. Draft PR101을 유지하며 병합하지 않는다.

```bash
node bodyguard/docs/review/native-startup-browser-comparison/verify.mjs
node bodyguard/docs/review/native-startup-browser-comparison/verify-parallel.mjs --current
node bodyguard/docs/review/native-startup-browser-comparison/compare-parallel-contract.mjs
node bodyguard/docs/review/native-startup-browser-comparison/compare-preparation-timing.mjs
```
