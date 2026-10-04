# AGENTS.md — Bodyguard

이 폴더에서 작업하는 AI 에이전트와 사람이 **가장 먼저 읽는 문서**다.

## 프로젝트 한 줄

노트북 웹캠 하나로 신체를 확인하고 스트레칭을 추천하거나 직접 고른 뒤, 기준 동작과 사용자 동작의 3D 아바타를 보며 자세를 코칭하고 기록을 남기는 웹 서비스.
한성대학교 오픈소스 AI·SW 융합 프로젝트 26-2, Team UHI.

첫 출시의 최신 결정과 단계별 검증 기준은 [`docs/release-plan.md`](docs/release-plan.md), CEO의 2026-10-01 사전 승인 운영 규칙은 [`docs/operating-rules.md`](docs/operating-rules.md)에 있다. 1단계 준비 기준은 충족했으며 2단계 실제 구현·검증이 다음 작업이다. 뷰티·미용은 출시 후, 기존 스켈레톤·마네킹은 출시 에셋이 아닌 시제품이다.

## 먼저 읽을 문서

2026-10-05 최신 실행 순서: 2단계 미완료 항목은 `docs/stage2-carryover.md`에 이월한다. 현재 아바타 시험 정리 후 같은 부위 새 사이클을 시작하지 않고 3→4→5→6 구현, 이후 최종 통합·수정을 진행한다. 기존 완료 기준·승인·개인정보·오판정 방지 경계는 유지한다.

| 언제 | 문서 |
|---|---|
| 항상 | 이 파일 |
| 첫 출시 범위·단계 확인 | `docs/release-plan.md` |
| 폴더를 넘겨받았을 때 | `docs/handoff.md` |
| 지금 할 일 확인 | `docs/tasks.md` |
| **아직 안 정해진 것** | `docs/open-questions.md` |
| 무엇을 만드는지 | `docs/prd.md` |
| 어떻게 만드는지 | `docs/design.md` |
| **판단이 갈릴 때** | `docs/constitution.md` |
| 왜 이렇게 정했는지 | `docs/adr/` |
| 원래 사용자가 뭘 원했는지 | `docs/research/` |

**전부 매번 읽지 않는다.** 작업에 필요한 부분만 찾아 읽는다.

---

## 절대 하지 말 것

1. **지시받지 않은 기능을 추가하지 않는다.** 좋아 보여도 추가하지 않는다
   - 특히 자주 지어내는 것: 질환 추정·진단 문구, 영상 녹화·스냅샷, 자세 점수 랭킹·친구 공유, 민감도 조절 슬라이더, 모바일 앱. **전부 만들지 않는다** (`docs/prd.md` §5, FR-N-03)
2. **영상과 관절 좌표를 밖으로 내보내지 않는다**
   - `MediaRecorder`, `canvas.toDataURL`·`toBlob`, 프레임 업로드를 쓰지 않는다
   - 서버로 가는 건 1분 요약·기준선 값·기록·설정뿐이다 (ADR-0003)
   - 로그에 좌표·지표 원시값을 찍지 않는다
   - LLM API에는 집계 숫자만 보낸다. 이름·이메일·계정 ID를 보내지 않는다 (ADR-0013)
3. **진단 표현을 쓰지 않는다.** UI 문구, 리포트, 주석 모두. 측정값으로만 말한다 (ADR-0008)
4. **`[PO 제안]`과 `[미정 Q-nn]`을 확정 사실처럼 쓰지 않는다.** 기존 범위 안의 기술 결정은 CTO 권장안·근거·검증을 기록해 진행한다. 중요한 범위·안전·개인정보·사업 결정은 CEO 별도 승인, 실측 수치는 실제 검증이 필요하다
5. **다음 파일을 건드리지 않는다**
   - `.env`
   - `docs/research/` (대화 원본. 읽기만 한다)
   - 바깥 `../docs/` (과목 제출물. 사람이 관리한다)
   - 기존 DB 마이그레이션 파일 (새 파일을 추가한다)
   - CI 워크플로 (처음 만든 뒤에는 사람이 바꾼다)
6. **시크릿을 커밋하지 않는다.** Gmail 앱 비밀번호, LLM API 키, 세션 서명 키는 `.env`에만 둔다. 레포에는 `.env.example`만 둔다
7. **한 커밋에 여러 가지 일을 담지 않는다**
8. **`main`에 직접 푸시하지 않는다.** 합의된 1~6단계 Story의 커밋·푸시·PR·리뷰 보완·조건부 병합은 사전 승인되었다. 운영 규칙의 게이트·별도 승인 경계를 지킨다

---

## 기술 스택

확정 (2026-09-26). 버전과 검증 결과는 `docs/adr/0015-tech-stack.md`.

| 영역 | 스택 |
|---|---|
| 프런트엔드 | React 19.3 + TypeScript 6.0 + Vite 8, pnpm 12, Node 24 LTS |
| UI | React Router 8, TanStack Query 5, Tailwind CSS 4 |
| 3D | Three.js 0.186 + React Three Fiber 9 + drei 10 |
| 포즈·손·얼굴 추정 | MediaPipe Tasks Vision 1.0 — Pose(검증 대상), Gesture Recognizer(손가락·제스처), Face Landmarker(둥근 머리의 방향·눈·입) |
| 데이터 | Zod 4, Recharts 3, idb 8, @hey-api/openapi-ts |
| 백엔드 | Python 3.14 + FastAPI + Pydantic 2, uv |
| DB | PostgreSQL 18 + SQLAlchemy 2.1 + Alembic + psycopg 3 |
| 인증 | Authlib(구글) + pwdlib(argon2) + aiosmtplib(팀 Gmail) + slowapi |
| PDF / 변화 탐지 | WeasyPrint 70 + 나눔 폰트 / numpy·pandas + PyOD 3.6 (검증 대상) |
| 리포트 요약 | 고른 회사의 공식 LLM SDK (제공사 Q-27) |
| 테스트 | Vitest 5 + happy-dom + Testing Library, Playwright, pytest 9 |
| 코드 검사 | Biome 2 (프런트), Ruff + mypy (백엔드) |
| 실행·CI | Docker + Compose, GitHub Actions |

**검증 대상은 채택이 아니다.** 문서·주석·커밋 메시지에 "채택"이라고 쓰지 않는다.
**모바일 브라우저·네이티브 앱 코드를 작성하지 않는다.**
**한국어만 지원한다.** 다국어 리소스를 만들지 않는다.

### 버전을 올릴 때 (실제로 부딪힌 것)
- **TypeScript 7로 올리지 않는다.** API 타입 생성 도구(@hey-api/openapi-ts)가 7에서 실행 중 깨진다. 도구가 지원하면 올린다
- **React 19.4 이상으로 올리기 전에 React Three Fiber 지원을 확인한다.** 지금 R3F 9.8은 19.4 미만만 지원한다
- **pnpm 보안 정책을 끄지 않는다.** 나온 지 하루 안 된 버전은 설치되지 않으니 버전은 범위로 적는다. 설치 스크립트는 `allowBuilds`에 적은 것만 돈다. 지금 데모에는 설치 스크립트가 필요한 패키지가 없어 `frontend/pnpm-workspace.yaml`도 없다. 그런 패키지를 추가하면 이 파일을 만들어 허용 여부를 적는다
- 테스트 DOM은 happy-dom을 쓴다. jsdom 최신은 Node 24.15 이상이 필요하다
- Vitest 5는 나온 지 얼마 안 됐다. 문제가 생기면 4.1로 내린다

---

## 폴더 구조

```
bodyguard/                 ← 레포 루트 (HSU-OAS/bodyguard)
├── docs/                  과목 제출물 — 건드리지 않는다
└── bodyguard/             ← 이 폴더 (개발 폴더)
    ├── AGENTS.md
    ├── docs/              개발 문서
    ├── compose.yaml       Docker Compose (tasks #1)
    ├── frontend/          React 공개·계정 화면 (S2.2), 개발 시제품은 /dev/measure 전용
    │   └── src/
    │       ├── posture/   지표·판정 — 순수 TS
    │       ├── stretch/   스트레칭 판정 — 순수 TS
    │       ├── pose/      카메라·MediaPipe·측정 루프
    │       ├── avatar/    Three.js — 내 스켈레톤·정자세 마네킹
    │       ├── alerts/    알림 스케줄러
    │       ├── summary/   1분 집계·업로드 큐
    │       ├── api/       백엔드 클라이언트
    │       └── pages/     화면
    └── backend/           FastAPI 계정·세션 API (S2.1), 기록·구글 등은 후속 Story
```

**`posture/`와 `stretch/`는 브라우저 API를 import하지 않는다.** DOM, MediaPipe, Three.js 모두 안 된다.
여기에 브라우저 의존이 들어가면 판정을 카메라 없이 테스트할 수 없게 된다 (ADR-0012).

---

## 빌드와 테스트

프런트는 `frontend/README.md`, 계정 백엔드는 `backend/README.md`를 따른다. PostgreSQL·필수 환경 변수를 로컬 전용으로 준비한다. pnpm이 설치돼 있지 않으면 `pnpm` 대신 `npx pnpm@12`를 쓴다.

```bash
docker compose up -d db                      # PostgreSQL 18
cd frontend && pnpm install && pnpm dev      # localhost라 HTTPS 없이도 카메라가 켜진다
cd frontend && pnpm test                     # Vitest — 판정 엔진 (빠름, 자주 돌릴 것)
cd frontend && pnpm test:e2e                 # Playwright — 설치된 크롬 + 가짜 카메라
cd frontend && pnpm gen:api                  # 실제 FastAPI 명세로 타입 생성 (서버/DB/메일 불필요)
cd frontend && pnpm check                    # Biome
cd backend && uv sync --locked
cd backend && uv run alembic upgrade head     # 새 로컬 DB 한정; 운영은 별도 승인
cd backend && uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --no-proxy-headers --no-access-log
cd backend && uv run pytest                  # 격리 BODYGUARD_TEST_DATABASE_URL 필수
cd backend && uv run ruff check . && uv run mypy app
```

판정 로직이나 임계값을 고쳤으면 **`pnpm test`를 반드시 돌린다.** 카메라 없이 몇 초면 끝난다.
API를 바꿨으면 `pnpm gen:api`로 프런트 타입을 다시 만든다.

---

## 커밋

CEO의 2026-10-01 사전 승인 규칙을 따른다. 커밋·PR 제목은 `docs: ...`, `feat(web): ...`처럼 목적과 범위를 드러낸다. 합의 범위 안의 로컬 커밋·푸시·PR 생성은 건별 승인을 다시 요청하지 않는다.

```
docs: 첫 출시 계약 정합화
feat(web): 기준선 보정 화면 추가
fix(web): 1분 요약 업로드 재시도 처리
```

- 사용자가 메시지를 지정하면 그대로 쓴다
- **AI 흔적을 남기지 않는다.** `Co-Authored-By:`, "Generated with" 같은 줄을 넣지 않는다. 커밋은 사용자 본인 계정으로만 한다
- 병합은 필수 검증 통과·미해결 P1/P2 없음·최신 diff/충돌/체크 확인을 충족한 PR만 사전 승인되었다. merge commit으로 하고 브랜치를 자동 삭제하지 않는다. 비용·계정·시크릿·운영 DB·배포·출시는 별도 승인이다

## 브랜치와 PR (CEO 확정)

- `main`에 직접 푸시하지 않는다
- 최신 `origin/main`에서 Story마다 새 `codex/*` 작업 브랜치를 만들고, 하나의 응집된 목적만 PR에 담는다
- 병합 직전 최신 diff·CLEAN 여부·체크 결과를 읽는다. 체크가 없으면 없다고 명시한다
- CI가 있으면 필수 체크 통과를 확인한다. 없으면 체크 없음과 실제 로컬 검증을 명시한다. 실패한 체크를 우회하지 않는다

---

## 문서

- 한국어로, 실제 개발 문서처럼 쓴다
- "6주차 이후 작성" 같은 수업식 표기 대신 "아직 구현 중"처럼 쓴다
- 과목 제출용 docx·pptx·xlsx는 바깥 `docs/`에 있고 주차 표기를 유지한다. 여기서 고치지 않는다
- 결정이 나면 `open-questions.md`에서 지우고 prd·design·ADR에 반영한다

---

## 코드 규칙

- **새 코드에는 근거 FR을 주석으로 남긴다.** 예: `// FR-M-05 이탈 판정`
  근거를 못 찾겠으면 그 코드는 필요 없을 가능성이 높다
- 판정 수치는 `frontend/src/posture/thresholds.ts` 한곳에 모은다. 실측으로 계속 바뀐다
- 판정 색은 좋음 초록, 주의 주황, 이탈 빨강이다. 확인 불가 상태는 내부 판정을 보류하고 제품 아바타에 별도 색을 칠하지 않는다 (ADR-0018). 시제품의 회색 표시는 ADR-0014 기록으로만 남긴다
- 가시성이 낮은 관절로 값을 지어내지 않는다. 애매하면 측정 불가다 (`constitution.md` P3)
- 테스트 픽스처에는 관절 좌표만 담는다. 팀원 본인 것만 쓴다
- 사용자에게 보이는 문구에 질환명·진단 표현을 넣지 않는다

---

## 판단이 갈릴 때

`docs/constitution.md`를 따른다. 그래도 결론이 안 나면 **이 순서**로 정한다. `[PO 제안]` Q-25

```
1. 개인정보     — 영상·몸 데이터가 새지 않는가
2. 오판정 방지   — 틀린 판정을 내지 않는가
3. 실시간성     — 1초 안에 반응하는가
4. 기능        — 할 수 있는 게 많은가
```

**기능이 맨 아래다.** 기능을 늘리려고 위의 셋을 내주지 않는다.

자주 부딪히는 판단:
- 판정률과 오판정이 부딪히면 → **오판정을 막는 쪽**
- 애매한 자세는 → **측정 불가**
- 기록을 더 자세히 남기는 것과 개인정보가 부딪히면 → **개인정보**

---

## 확신이 없으면

추측해서 만들지 말고 **멈추고 묻는다.**
`docs/open-questions.md`에 있는 항목이면 특히 그렇다. 정해지지 않은 걸 정해진 것처럼 만들면 나중에 전부 되돌려야 한다.
