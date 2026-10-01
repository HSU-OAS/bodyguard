# Bodyguard frontend

React 19.3 + TypeScript 6.0 + Vite 8. 쓰는 버전과 이유는 [ADR-0015](../docs/adr/0015-tech-stack.md)에 있다.

공개 소개·이메일 가입/인증·로그인·보호된 시작·로그아웃을 실제 계정 API에 연결했다(S2.2). 스트레칭 선택·추천·고품질 두 아바타·코칭·기록은 아직 구현 중이며 출시 가능 상태가 아니다. 기존 스켈레톤은 개발 전용 시제품이다.

## 실행

pnpm이 설치돼 있지 않으면 아래 `pnpm`을 `npx pnpm@12`로 바꿔 실행한다.

```bash
pnpm install
pnpm dev
```

처음 `pnpm dev`를 실행하면 두 가지를 먼저 한다. 둘 다 레포에는 올리지 않는다.
- MediaPipe WASM을 `public/mediapipe/`에 복사한다
- 모델 다섯 개를 Google MediaPipe 공식 저장소(Apache-2.0)에서 `public/models/`로 받는다. 포즈 lite 5.5MB·full 9.0MB·heavy 29.2MB, 손가락·제스처 8.0MB, 얼굴 3.8MB

크롬에서 http://localhost:5173 을 열면 서비스 소개가 나온다. `/api`는 127.0.0.1:8000의 로컬 백엔드로 연결한다. backend/README.md의 필수 변수·로컬 migration·실행 명령을 먼저 따른다. 로컬 Origin은 `http://localhost:5173`과 정확히 일치해야 한다. SMTP가 설정되지 않으면 가입 발송은 실패하며 가짜로 성공시키지 않는다. 실제 Gmail/시크릿 연결은 CEO 별도 승인 대상이다.

계정 접속·로그인만으로 카메라·MediaPipe·3D를 시작하지 않는다. `/start` 직접 방문도 `/me` 확인 전에는 개인 화면을 열지 않는다. HTTP 세션 쿠키는 서버의 HttpOnly 쿠키이고 인증값을 localStorage/sessionStorage에 두지 않는다. 가입 폼 새로고침 시 메모리 입력은 사라지며 안전하게 다시 시작한다.

개발 빌드의 http://localhost:5173/dev/measure 에서만 **측정 시작**으로 시제품 카메라를 허용할 수 있다. production 빌드에는 이 경로·측정 UI 코드가 없다. 이 데모가 제품 인증이나 실제 출시 코칭을 우회하는 것은 아니다.

S2.3a에서 준비 중에도 취소할 수 있고 중지·재시작·서비스로 돌아가기로 이전 스트림/프레임 작업을 정리한다. 모델은 최대 2포즈로 추정하되 복수 결과의 첫 사람을 골라 쓰지 않는다. 실제 복수 인물 검출 정확도·대상 전환은 미검증이다. 동작 촬영 패널은 최근 1초 이내 단일 포즈만 촬영 범위 충족 후보로 기록하고 최신 100개 요약만 메모리에 둔다. 이 도구는 자세 성공/오류를 판정하지 않는다. [명세·실행 결과](../docs/stories/stage2-motion-validation.md)를 따른다.

## 개발용 아바타 검수

`http://localhost:5173/dev/avatar`는 실제 Blender 후보 GLB의 **기술 검수 전용**이다. 남녀 선택·독립된 두 뼈대·한쪽 합성 변형 시작/정지·회전/확대·실패 재시도를 제공한다. 카메라·운동 정답·타이머·사용자 추적은 없다. 설치된 Three/R3F/drei를 재사용했고 새 3D 의존성은 없다. 읽기 전용 geometry/material만 공유하며 뼈대는 `SkeletonUtils.clone`으로 독립 복제한다.

`pnpm exec playwright test --config playwright.avatar.config.ts --reporter=list,json`은 자체 5182 개발 서버와 설치된 Chrome으로 남녀 두 모델·180 렌더 간격·503/실제 context loss 복구·이탈·카메라 0회를 검사한다. 개발 경로/뷰어/후보 GLB는 production에서 제외한다. production 계정 Chrome 회귀는 두 개발 경로가 404이고 계정 진입에서 GLB/WASM을 받지 않는지 확인한다.

2026-10-01: 실제 브라우저 기술 시험 2개는 통과했지만 **후보 외형과 웹 가중치 변형에 P2가 남아 있다**. [실제 결과·남녀 컷·실패 JSON](../assets/blender/review/web-candidate/README.md)을 따른다. 실제 사람·목표 노트북 웹캠 코칭·최종 아바타 승인 증거가 아니다.

## 개발용 측정 화면

- 왼쪽: 웹캠 화면(거울처럼 좌우 반전) 위에 2D 스켈레톤. 개발용 확인 화면이다. 제품 화면에는 영상을 보여주지 않는다 (FR-V-02)
- 오른쪽: 3D 스켈레톤. MediaPipe 월드 좌표(엉덩이 중심, 미터)로 그린다. 마우스로 돌려 볼 수 있다
- 스켈레톤 머리: 얼굴 관절을 선으로 잇지 않고 둥근 머리에 점 눈·볼터치·웃는 입을 그린다 (원문 55). 고개 돌림·끄덕임·기울임과 눈 깜빡임·입 벌림은 얼굴 모델(Face Landmarker)로 따라 한다. **측정을 시작하고 얼굴이 처음 보인 2초 동안 화면을 보고 있으면** 그 자세가 정면이 된다 (원문 57, ADR-0017)
- 3D 화면 위: 필요한 관절이 화면 밖이면 부드러운 안내 문구. 1.5초 넘게 이어질 때만 뜬다 (FR-M-07)
- 3D 화면 아래: 손 제스처를 알아보면 "왼손 엄지척"처럼 보여준다 (FR-A-04)
- 아래: fps, 몸·손·얼굴 추론 1회 시간, 사람 인식 여부, 처리 장치(GPU/CPU), 인식 확실도(머리·어깨), 추론 속도 제한(30fps 설계값 / 15fps / 제한 없음), 안내 기준(앉은 자세 / 서서), 포즈 모델(lite / full / heavy, 기본 heavy. 측정을 멈춘 뒤 바꾼다), 손가락 인식(켬 / 끔), 얼굴 인식(켬 / 끔. 끄면 둥근 머리가 정면만 본다)

가시성이 0.5보다 낮거나 화면 밖에 있는 관절은 그리지 않는다. 책상에 가린 엉덩이 아래가 안 보이는 게 정상이다. 머리는 코와 양 귀가 보일 때만 그린다.
영상과 관절 좌표는 브라우저 메모리에서만 쓰고 버린다. 저장하거나 보내지 않는다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `pnpm dev` | 개발 서버 (자산 준비 포함) |
| `pnpm build` | 자산 준비 + 타입 검사 + 프로덕션 빌드 |
| `pnpm test` | Vitest — 관절 신뢰, 자세 안내, 손가락, 스켈레톤 선분, 둥근 머리, 얼굴 추적(정면 기준·떨림·눈·입), 첫 화면 |
| `pnpm test:e2e` | 별도 5181 개발 서버에서 Chrome·가짜 카메라 회귀. 사용 중인 5173 서버는 재사용/종료하지 않음 |
| `pnpm typecheck` | 타입 검사만 |
| `pnpm gen:api` | 실제 FastAPI 명세의 계정 타입 생성. backend의 uv sync --locked 선행, DB/SMTP/HTTP 서버 불필요 |
| `pnpm check` / `pnpm format` | Biome 검사 / 자동 정리 |

E2E는 설치된 Google Chrome을 쓴다. 크롬이 없으면 `pnpm exec playwright install chromium`으로 받고 `playwright.config.ts`의 `channel`을 지운다.

## 실제 API 계정 브라우저 하네스

backend에서 격리 `BODYGUARD_TEST_DATABASE_URL`을 설정하고 `uv run python -m tests.run_browser`를 실행한다. 기존 API 하네스와 동일한 역할/DB/로컬 호스트 검사를 거친 **시험 DB의 계정 데이터만 초기화**한다. 사용자의 기존 서버를 재사용하지 않으며 8000·4173 포트가 사용 중이면 실패한다. 자체 API/preview만 종료하고 시험 메일 임시 파일을 정리한다. 실제 계정 API·PostgreSQL·production 화면을 사용하며 시험 메일만 격리 프로세스 파일로 전달한다. 공개 outbox API나 production 인증 stub은 없다. 실제 Gmail 발송 증거가 아니다.

2026-10-01: Vitest 66개, 실제 API/SQL 계정 Chrome 9개(실제 60초 재발송 포함), 별도 개발 가짜 카메라 1개 통과. 1440px·700px 데스크톱 창의 공개/가입/인증/로그인/보호/오류 화면과 키보드 초점을 확인했다. 화면 증거는 `test-results/`에 재현되며 시험 주소만 사용한다. B-03 늦은 응답 상태 경쟁은 Vitest 모의 응답 검사이며 실제 브라우저 시험과 구분한다. 자세 정확도·실제 사람·Gmail·Google·HTTPS·최종 아바타는 미검증이다.

## 폴더

```
src/
├── posture/     관절 신뢰·자세 안내·손가락 계산. 브라우저 API를 쓰지 않는 순수 함수
├── pose/        카메라, MediaPipe, 측정 루프 (useMeasurement)
├── avatar/      스켈레톤과 둥근 머리. skeleton.ts·face.ts·faceTracking.ts는 브라우저 API를 쓰지 않는 순수 함수
├── components/  화면 조각 (디버그 패널)
└── pages/       화면
scripts/prepare-assets.mjs   WASM 복사, 모델 다운로드
e2e/                         Playwright
```

## 이어서 할 것

- 사람이 직접 확인했다(2026-09-26). 상반신과 몸 기울이기를 따라온다. 가짜 카메라 화면에는 사람이 없어서 자동 테스트로는 인식까지 보지 못한다
- 둥근 머리의 방향·깜빡임·입(원문 57)은 사람 얼굴로 아직 확인하지 않았다. 고개를 돌린 쪽과 캐릭터가 도는 쪽이 거울처럼 맞는지, 한쪽 눈을 감으면 같은 쪽 눈이 감기는지 본다
- 제품 화면에는 카메라 영상을 보여주지 않는다(FR-V-02). 왼쪽 영상과 디버그는 development 전용 `/dev/measure`로 분리했다
- 이 맥에서 나온 fps와 추론 시간을 `docs/adr/0007-pose-oss-candidates.md`에 적는다 (M-2)
- 다음 작업: 지표 실험 기록 도구(tasks #5), 판정 엔진 `src/posture/`(tasks #7), 스켈레톤 부위별 판정 색(tasks #12)
- S2.3a: Vitest 82개, 가짜 카메라의 실제 Chrome 시작/중지/재시작/SPA 이탈 1개, 실제 API·격리 SQL 계정 Chrome 회귀 9개 통과. production 계정 진입 JS는 273.29KB(gzip 86.87KB)이며 개발 측정 코드는 제외했다. 실제 사람의 자세 정확도·최종 두 아바타 성능을 검증한 것이 아니다
- 3D 화면은 매 프레임 다시 그린다. 더 가볍게 하려면 `frameloop="demand"`로 바꾸고 새 관절이 들어올 때만 그린다 (constitution P8)
