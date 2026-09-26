# ADR-0011. 한 레포 안에 frontend와 backend

상태: 확정 (2026-09-26, 개발 스택과 함께) · 근거: 원문 38, 48

## 맥락
개발 폴더는 레포 안의 `bodyguard/`다(원문 38). 프런트와 백엔드를 레포 두 개로 나눌지 정해야 했다.

## 결정
`bodyguard/` 아래에 `frontend/`(React, pnpm), `backend/`(FastAPI, uv), `docs/`를 둔다.

## 근거
- 두 사람이 PR 하나로 API와 화면을 같이 바꿀 수 있다
- 문서와 코드가 한곳에 있어 AI 에이전트가 근거를 찾기 쉽다
- FastAPI 명세로 프런트 타입을 생성하므로 두 폴더가 같은 레포에 있어야 편하다 (ADR-0015)

## 결과
- CI는 바뀐 폴더에 따라 프런트·백엔드 테스트를 나눠 돌린다
- Docker Compose 파일(`compose.yaml`)은 `bodyguard/`에 둔다
- 레포 루트에는 과목 제출물(`docs/`)이 그대로 남는다
