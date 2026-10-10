# S6.23 촬영 안내 하네스 시계 보완

2026-10-10 · [사전 명세](../../stories/framing-harness-clock.md) · 시작 main `2f191b87fb54778beddacf2fd17f3c1ae44b15a2`.

## 바뀐 점과 실제 한계

**제품/화면 변경은 없다.** DEV 촬영 안내의 첫 DOM 시험에만 fixture 생성 전 시계를 고정하고,1000ms 한계 포함→1001ms 보류→새 프레임 재개 시험을 추가했다. 원래 상반신5/5·전신3/9·미검출0/9·촬영 안내·지우기·원시 좌표/저장 금지 assertion과 afterEach restoreAllMocks는 그대로다. 제품 readFramingSample의1000ms 거부 조건을 바꾸지 않았다.

S4.18 서버 API 작업트리의 최초 전체frontend는1503통과/1실패였다. 첫 합성 프레임의 sampledAt은 fixture 생성의 실제 시각이고 render/접근성 조회 뒤 capture가 별도 실제 시각을 읽었다. 그 사이 새 입력이 없는데 계속 fresh라는 시험 가정은 성립하지 않는다. 원래 실패에서 정확한 elapsed age를 저장하지 않았으며 실패의 새 프레임 대기 힌트로 거부 경로를 확인했다.

동일 base·제품 source의 private 진단 복사본은 sampledAt1000/capture2001을 명시해 같은 첫5/5 기대가 실패했다(1실패/5skip). 이는 의도적으로 오래된 합성 입력을 준 결정적 반례다. 원래 실패 당시 실제 age가1001ms였다는 측정 증거나 실제 카메라 성능 문제의 재현으로 표현하지 않는다. 이 하네스 결함을 clock 고정으로 보완했고 expired input 자체는 여전히 거부되는 boundary DOM 시험을 유지했다.

## 실제 실행

| 실행 | 결과 | 구분 |
| --- | --- | --- |
| 최초 전체 웹 | 1503통과/1실패 | API 작업트리, 원래 test/source/JSON/log 보존. fail을 삭제하지 않음 |
| 명시적1001ms 반례 | 1실패/5skip | private diagnostic source. first assertion 뒤 검증은 미실행 |
| 보완 뒤 페이지/순수 framingTrial | 29통과 | happy-dom/useMeasurement·Skeleton3D mock. 실제 SDK/아바타 검증 아님 |
| 보완 뒤 전체frontend | 1505통과, pending0 | 76파일, retry나 worker 제한 변경0 |
| tsc/Biome/production build/guard | 통과 | Biome301파일, 기존 info15. private 후보 문자열0 |
| public JS/CSS | 2파일 byte 동일 | 실제 API 작업 전 main-equivalent PR114 dist/assets와 대조 |

새 작업트리는 최신 main에서 만들고 pnpm offline lock 설치(194reused/download0)를 사용했다. 빌드 모델 파일은 앞선 실제 main-equivalent 작업트리의 기존 public/models 복사본이고 SDK 추론/카메라를 실행하지 않았다. 자산 복사와 기존 전체 unit의 mocked avatar/math 시험을 새 avatar 제작/GLB/변형/브라우저 외형 검증으로 세지 않는다. 실제 노트북·참여자·다장치·의학 정확도·운영 검증0, 서버/DB 시험 재실행0이다.

## 입력·실패·작성자 리뷰

`node bodyguard/docs/review/framing-harness-clock/collect.mjs --check`는 [manifest.json](manifest.json)의27개 압축/원본 SHA·실행 전 source8·불변 제품/설정188을 확인한다. 시험 재실행이 아니다. first-failure에는 원래 전체 실패/로그·원래 test·private 반례 source/JSON/log, final-source에는29/full/정적/build 실행 전8개 입력을 보존했다. collector는 원래 실패 실행 **뒤**, 보완 시험 **전** 작성됐다. 이전 전체 실패에서 관련 모든 source를 여기 보존했다고 주장하지 않는다.

engineering:debug로 fixture/프레임 소비의 시계를 분리했고 engineering:code-review로 실제 diff·경계/복구·실행/증거를 작성자 검토했다. 외부/다중 에이전트/전문가 리뷰는 아니다. 제품·UI·guard·storage 정책·계정·타입·의존성·migration·CI 변경0을 실제 불변 파일/SHA/public2 bytes로 대조했다. assertion을 완화하거나 신선도 한계·timeout·retry·worker 옵션을 수정하지 않았다. 기록 sequence는1000ms 포함/1001ms 거부/새 input 회복을 모두 유지하며 clock은 afterEach 원복된다. scoped P1/P2는 남지 않았고 원격 최신 diff/HEAD/main/CLEAN/체크를 병합 직전에 다시 확인한다.

API 변경은 이 PR에 없고 보존 중인 S4.18에서 전체 웹 검증을 재실행해야 한다. Draft51/역사적 시작P2/미승인 UI·SDK·실측/운영/아바타 보류·전체1~6/출시 후보판은 그대로 미완료다. 이 DOM 하네스 보완으로 실제 오판정이나 전체 서비스 완성을 선언하지 않는다.
