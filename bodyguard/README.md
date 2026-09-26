# Bodyguard

**웹캠으로 앉은 자세를 재고, 3D 아바타로 어디가 틀어졌는지 보여주는 웹 서비스.**

한성대학교 오픈소스 AI·SW 융합 프로젝트 26-2 · Team UHI

> 아직 구현 중입니다. 지금은 스켈레톤 데모만 실행할 수 있습니다.

---

## 이게 뭔가요

노트북 앞에서 과제하고 코딩하다 보면 목이 앞으로 빠지고 어깨가 기웁니다. 본인은 모릅니다. 자기 자세는 자기가 볼 수 없으니까요.

Bodyguard는 탭 하나만 켜 두면 웹캠으로 자세를 잽니다.

- 화면의 스켈레톤이 내 몸을 따라 움직이고, 부위마다 초록·주황·빨강으로 상태를 보여 줍니다. 옆에는 정자세 마네킹이 기준으로 떠 있습니다
- 자세가 5분 넘게 무너지거나 50분을 내리 앉아 있으면 스트레칭을 권합니다
- 스트레칭을 카메라로 보고 제대로 했는지 판정합니다
- 기록이 쌓여 일·주 추이와 PDF 리포트가 됩니다. 리포트에는 AI가 숫자만 보고 쓴 한 단락 요약이 붙습니다

**영상은 브라우저 밖으로 나가지 않습니다.** 서버에는 1분 단위 요약만 올라갑니다.
**의학적 진단을 하지 않습니다.** 측정 기록을 제공할 뿐입니다.

## 구성

```
┌───────────────── 브라우저 ─────────────────┐
│  웹캠 → MediaPipe → 지표 → 판정               │
│         (영상과 관절 좌표는 여기서 버림)          │
│                 → 아바타 · 알림 · 스트레칭      │
└─────────────────────┬─────────────────────┘
                      │ 1분 요약만 (HTTPS)
               ┌──────▼──────┐
               │   FastAPI    │  계정 · 기록 · 변화 탐지 · PDF · AI 요약
               └──────┬──────┘
               ┌──────▼──────┐
               │     DB       │
               └─────────────┘
```

| | 기술 | 상태 |
|---|---|---|
| 프런트엔드 | React 19 + TypeScript + Vite, Tailwind CSS | |
| 3D | Three.js + React Three Fiber | |
| 포즈 추정 | MediaPipe | 성능 검증 중 |
| 백엔드 | Python 3.14 + FastAPI | |
| DB | PostgreSQL 18 | |
| 인증 | FastAPI 직접 구현, 메일 인증은 Gmail | |
| PDF | WeasyPrint | |
| 변화 탐지 | 단순 통계, PyOD 비교 | 검증 중 |
| 리포트 요약 | LLM API | 모델 고르는 중 |
| 실행 | Docker | |

## 폴더

```
frontend/    React 앱 (스켈레톤 데모까지)
backend/     FastAPI (아직 없음)
docs/        개발 문서
```

`frontend/src/posture/`는 브라우저 API에 의존하지 않습니다. 판정 로직을 카메라 없이 테스트할 수 있습니다.

## 실행

지금은 프런트엔드의 스켈레톤 데모만 있습니다. 카메라로 잡은 몸을 스켈레톤이 따라 움직이는지 확인하는 화면입니다.

```bash
cd frontend
pnpm install      # pnpm이 없으면 npx pnpm@12 install
pnpm dev          # 처음에는 모델 다섯 개(모두 약 56MB)를 받습니다
```

크롬에서 http://localhost:5173 을 열고 측정 시작을 누르세요. 자세한 내용은 [frontend/README.md](frontend/README.md), 도구와 버전은 [ADR-0015](docs/adr/0015-tech-stack.md)에 있습니다.

## 문서

| | |
|---|---|
| [AGENTS.md](AGENTS.md) | 작업 규칙 — 가장 먼저 읽을 것 |
| [docs/handoff.md](docs/handoff.md) | 인수인계 — 폴더를 넘겨받으면 볼 것 |
| [docs/open-questions.md](docs/open-questions.md) | 아직 정하지 않은 것 |
| [docs/constitution.md](docs/constitution.md) | 판단 기준 |
| [docs/product-brief.md](docs/product-brief.md) | 한 장 요약 |
| [docs/prd.md](docs/prd.md) | 무엇을 만드는가 |
| [docs/design.md](docs/design.md) | 어떻게 만드는가 |
| [docs/tasks.md](docs/tasks.md) | 작업 순서 |
| [docs/adr/](docs/adr/) | 왜 그렇게 정했는가 |
| [docs/research/](docs/research/) | 요구사항 원본 |

과목 제출물(차터·PRD·WBS)은 레포 루트의 `docs/`에 있습니다.

## 팀

| 이름 | 맡은 일 |
|---|---|
| 허윤 (팀장) | 백엔드, 3D 렌더링, OSS·라이선스 |
| 이성수 | 프런트엔드, AI·데이터 (포즈 파이프라인, 판정, 변화 탐지) |

## 알려진 제약

- 데스크톱 크롬·엣지를 기준으로 만듭니다
- 정면 웹캠에 상반신이 보여야 합니다. 목과 상체의 앞뒤 기울기는 정면 영상에서 바로 재기 어려워 측정 방식을 검증하고 있습니다
- 다른 창으로 가 있는 동안에도 측정이 이어지는지는 브라우저 정책에 달려 있어 확인하고 있습니다
- 배포 주소가 HTTPS여야 카메라가 켜집니다
- 한국어만 지원합니다
