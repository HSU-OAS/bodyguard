# Bodyguard frontend

React 19.3 + TypeScript 6.0 + Vite 8. 쓰는 버전과 이유는 [ADR-0015](../docs/adr/0015-tech-stack.md)에 있다.

지금은 **스켈레톤 데모**만 있다. 웹캠으로 잡은 몸을 스켈레톤이 따라 움직이는지 확인하는 화면이다. 자세 판정·알림·서버 연결은 아직 없다.

## 실행

pnpm이 설치돼 있지 않으면 아래 `pnpm`을 `npx pnpm@12`로 바꿔 실행한다.

```bash
pnpm install
pnpm dev
```

처음 `pnpm dev`를 실행하면 두 가지를 먼저 한다. 둘 다 레포에는 올리지 않는다.
- MediaPipe WASM을 `public/mediapipe/`에 복사한다
- 모델 다섯 개를 Google MediaPipe 공식 저장소(Apache-2.0)에서 `public/models/`로 받는다. 포즈 lite 5.5MB·full 9.0MB·heavy 29.2MB, 손가락·제스처 8.0MB, 얼굴 3.8MB

크롬이나 엣지에서 http://localhost:5173 을 열고 **측정 시작**을 누른 뒤 카메라를 허용한다. localhost라 HTTPS 없이도 카메라가 켜진다.

## 화면

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
| `pnpm test:e2e` | Playwright — 설치된 크롬과 가짜 카메라로 측정 시작·추론 루프·안내 문구·중지 확인 |
| `pnpm typecheck` | 타입 검사만 |
| `pnpm check` / `pnpm format` | Biome 검사 / 자동 정리 |

E2E는 설치된 Google Chrome을 쓴다. 크롬이 없으면 `pnpm exec playwright install chromium`으로 받고 `playwright.config.ts`의 `channel`을 지운다.

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
- 제품 화면에는 카메라 영상을 보여주지 않는다(FR-V-02). 지금 왼쪽 카메라 화면은 확인용이라 개발 빌드의 디버그 화면으로 옮긴다
- 이 맥에서 나온 fps와 추론 시간을 `docs/adr/0007-pose-oss-candidates.md`에 적는다 (M-2)
- 다음 작업: 지표 실험 기록 도구(tasks #5), 판정 엔진 `src/posture/`(tasks #7), 스켈레톤 부위별 판정 색(tasks #12)
- 첫 화면 JS가 1.3MB(gzip 370KB)다. 3D 화면을 지연 로딩으로 나눈다
- 3D 화면은 매 프레임 다시 그린다. 더 가볍게 하려면 `frameloop="demand"`로 바꾸고 새 관절이 들어올 때만 그린다 (constitution P8)
