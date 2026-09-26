# ADR-0015. 기술 스택과 버전

상태: 확정 (2026-09-26) · 근거: 원문 15, 46, 47, 48

## 맥락
프런트엔드는 React로 정해져 있었고(원문 15), 실행은 Docker로 정했다(원문 46). 백엔드는 Next.js와 파이썬(FastAPI)을 두고 고민했다.
사용자가 버전 호환까지 확인해 달라고 해서(원문 47), 후보 버전을 임시 폴더에 실제로 설치하고 빌드·테스트까지 돌려 본 뒤 정했다.

## 결정 — 백엔드는 파이썬(FastAPI)
- 포즈·얼굴·깊이 모델은 전부 브라우저에서 돈다. 서버 언어가 모델 호환을 좌우하지 않는다
- 서버에서 파이썬이 필요한 곳이 있다. PyOD(변화 탐지, 파이썬 전용), 한글 PDF(WeasyPrint), 지표 실측 분석이다
- Next.js의 강점(서버 렌더링, 검색 노출)은 이 앱에서 거의 쓰이지 않는다. 카메라·3D·워커 코드는 순수 브라우저 앱(Vite)에서 더 단순하다
- 언어가 둘인 단점은 FastAPI 명세로 프런트 타입을 자동 생성해 줄인다

## 결정 — 버전 (2026-09-26 기준)

### 프런트엔드
| 역할 | 패키지 | 버전 |
|---|---|---|
| 런타임 / 패키지 관리 | Node / pnpm | 24 LTS / 12.6 |
| UI | react, react-dom | 19.3 |
| 언어 | typescript | 6.0 |
| 빌드 | vite, @vitejs/plugin-react | 8.3, 6.1 |
| 라우팅 / 서버 데이터 | react-router / @tanstack/react-query | 8.4 / 5.10x |
| 스타일 | tailwindcss, @tailwindcss/vite | 4.3 |
| 3D | three, @react-three/fiber, @react-three/drei | 0.186, 9.8, 10.7 |
| 포즈·손 | @mediapipe/tasks-vision (Pose, Gesture Recognizer) | 1.0.1 |
| 데이터 | zod, recharts(+react-is), idb | 4.6, 3.10, 8.0 |
| API 타입 생성 | @hey-api/openapi-ts | 0.99 |
| 깊이 모델 (실험만) | @huggingface/transformers | 4.3 |
| 테스트 | vitest, happy-dom, @testing-library/react, @playwright/test | 5.0, 20.14, 16.3, 1.63 |
| 코드 검사 | @biomejs/biome | 2.5 |

### 백엔드
| 역할 | 패키지 | 버전 |
|---|---|---|
| 런타임 / 도구 | Python / uv | 3.14 / 0.12 |
| 웹 | fastapi, uvicorn[standard], pydantic, pydantic-settings | 0.141, 0.54, 2.13, 2.15 |
| DB | sqlalchemy, alembic, psycopg[binary] / PostgreSQL | 2.1, 1.20, 3.3 / 18 |
| 인증 | authlib, itsdangerous, pwdlib[argon2], aiosmtplib, slowapi, email-validator | 1.8, 2.2, 0.3, 5.1, 0.1.10, 2.3 |
| PDF | jinja2, weasyprint (+ Pango, 나눔 폰트) | 3.1, 70 |
| 분석·변화 탐지 | numpy, pandas, pyod, matplotlib | 2.5, 3.0, 3.6, 3.11 |
| LLM | 고른 회사의 공식 SDK. anthropic 1.8, openai 3.19, google-genai 2.25 모두 설치 확인 | Q-27 |
| 테스트 / 검사 | pytest / ruff, mypy | 9.1 / 0.16, 2.3 |

### 실행
Docker + Compose. 이미지는 node:24(프런트 빌드), python:3.14-slim(백엔드), postgres:18. CI는 GitHub Actions.

## 확인한 방법
- **프런트엔드**: 측정 화면(스켈레톤·MediaPipe·워커), 대시보드(차트·Zod·IndexedDB), 깊이 모델 지연 로딩을 넣은 미니 앱으로 설치 → 타입 검사 → 테스트 → 프로덕션 빌드 → API 타입 생성을 돌렸다. npm과 pnpm 둘 다 해 봤다
- **백엔드**: python:3.14-slim 이미지에 전부 설치하고 기능을 실행했다. 요청 횟수 제한(3번째 요청에서 429), 구글 OAuth 클라이언트, argon2 해시, PyOD(ECOD·HBOS, numba 포함), 한글 PDF(나눔고딕 내장, 텍스트 추출)까지 확인했다

## 실제로 부딪힌 것
| 문제 | 대응 |
|---|---|
| TypeScript 7.0에서 @hey-api/openapi-ts가 실행 중 에러를 낸다. 지원 범위에는 7이 들어가 있다 | TypeScript 6.0을 쓴다 |
| openapi-typescript는 TypeScript 5만 지원한다 | @hey-api/openapi-ts를 쓴다 |
| React Three Fiber 9.8은 React 19.4 미만만 지원한다 | React 19.3에 고정한다 |
| jsdom 30은 Node 24.15 이상이 필요하다 | 테스트 DOM은 happy-dom. Node는 24 최신으로 맞춘다 |
| pnpm 12는 나온 지 하루 안 된 버전을 막는다 | 정책을 유지한다. 버전은 범위로 적는다 |
| pnpm 12는 설치 스크립트를 막는다 (onnxruntime-node, protobufjs — 스택 검증 때 깊이 모델 패키지에서) | `pnpm-workspace.yaml`의 `allowBuilds`에 false로 적는다. 브라우저에서는 필요 없다. 지금 데모에는 이 패키지가 없어 파일도 없다 |
| Biome 2.5에서 설정 `rules.recommended`가 폐기 예정 | `biome migrate --write`로 `rules.preset`으로 바꿨다 (스켈레톤 데모 때) |
| drei의 `Instance`가 ref 타입을 비워 두고 내보낸다 | ref 타입을 drei가 내보내는 `PositionMesh`로 직접 적는다 |
| Three.js 0.186의 `Matrix4.decompose`는 크기 0인 행렬을 크기 1로 되돌린다. drei `Instances`에서 크기 0으로 숨긴 관절이 마지막 자리에 그대로 보였다 | 숨길 관절은 크기 대신 위치를 화면 밖으로 옮긴다 |
| React Three Fiber 기본 톤 매핑(ACES)이 밝은 색을 회색빛으로, 분홍을 흐리게 바꿨다 (둥근 머리 때) | 색이 정확해야 하는 재질은 `toneMapped={false}`로 둔다. 판정 색(ADR-0014)을 3D에 칠할 때도 확인한다 |
| 앱 코드에서 `three`를 처음 직접 import하자 Vite 개발 서버가 의존성을 다시 묶고 열린 탭을 새로고침했다. 그 사이 옛 묶음과 새 묶음이 섞여 R3F가 `Cannot assign to read only property 'position'` 오류를 냈다 | 코드 문제가 아니다. 새로고침하면 사라진다. 새 라이브러리를 처음 import한 뒤 이 오류가 보이면 먼저 새로고침한다 |

## 결과
- 백엔드 이미지는 검증 때 1.4GB였다. PyOD가 끌고 오는 numba·llvmlite와 scipy·scikit-learn이 크다. 운영 이미지에서는 개발 도구를 빼고, 단순 통계로 충분하면 PyOD를 뺀다
- 깊이 모델 실행 파일(onnxruntime WASM)은 27MB다. 실험 후보로만 둔다 (M-4)
- MediaPipe WASM은 변형마다 약 11~12MB이고 Vite가 챙겨 주지 않는다. 정적 폴더로 복사하는 스크립트를 둔다
- 첫 화면 JS가 1.8MB(gzip 520KB)였다. 3D·차트 때문이라 페이지별로 나눠 불러온다
- Vitest 5는 나온 지 3주 된 버전이다. 문제가 생기면 4.1로 내린다
- @hey-api/openapi-ts와 slowapi는 0.x 버전이다. 버전을 고정하고, 올릴 때 확인한다
- MediaPipe·Three.js·PyOD·WeasyPrint는 설치와 동작을 확인했을 뿐이다. 성능과 정확도는 실측(M-2 등)으로 본다
