# S2.T18 — 로그인 소유 세션의 비공개 시범 연결

Status: 강화 native 검증에서 시각2건 실패 보존·시간/권한 보완 / 실제 재검증·PR 게이트 전 / 단계 완료 아님

## 목적·범위

S2.T17의 단계별 시범을 실제 recorded session과 native 소유 pair에 연결한다.
공개 화면·확정 디자인·판정 임계값·SDK egress·원본/GLB 외형은 변경하지 않는다.
현재 A37 및 Blender 제작 시험 클립은 출시용 외형/올바른 스트레칭이 아니다.
텍스트 최소화 방향의 내부 기반이며, 화면 구성 승인을 대신하지 않는다.

## 계약

- reference program은 명시 옵션이다. 카메라/SDK await 전에 복사·검증한다.
  미지정 호출의 SDK/소유권/렌더 계약은 유지한다. clinical defaults 없음.
- 실제 세션 onChange의 현재 immutable state에서 generation, motion/version,
  step, phase, status, 원본 lastNow를 전달한다. cue sequence는 세대별 증가한다.
  애니메이션은 관측 시간·성공·기록·반복 횟수·판정을 생성하지 않는다.
  cue는 현재 RAF보다 늦을 수 있으므로 원본 render 시간이 cue에 도달할 때 전달한다.
  대기 중 최신 명령을 보존하고 더 오래된 state 시간으로 덮어쓰지 않는다. 두 시각을
  새로 찍거나 미래 cue 때문에 매 프레임 stale로 재설정하지 않는다.
- bridge의 현재 controller 권한으로만 pair 명령을 받는다. ready/running만 허용하며
  오래된 세대·준비 중·retiring·abort·closed·poisoned이면 아무 명령도 전달하지 않는다.
  native SDK borrowed frame 회수를 기다리는 lifetime 신호를 권한으로 쓰지 않는다.
- 잘못된 현재 명령은 reference 드라이버에서 정지한다. 콜백 예외는 고정 asset-error로
  중단·정리하고 원시 오류는 저장/표시하지 않는다. 명령 도중 재진입 종료도 재확인한다.
- pause/종료/로그아웃/401/계정 refresh/pagehide/unmount는 즉시 렌더·명령을 차단한다.
  이미 빌린 native frame은 반환 후 닫고, 이후 SDK/카메라/pair를 정확히 한 번 해제한다.
  resume은 새 generation/pair이며 이전 renderer/cue/소유자를 되살리지 않는다.
  reference 옵션의 renderer에 남은 pair 핸들도 현재 controller 권한으로 재확인한다.

## 수용 기준·검증 계획

1. bridge/native 단위 계약을 먼저 작성하고 미구현 RED와 보완 결과를 보존한다.
2. 현재/오래된/준비 중/중단 중 명령, native borrow 대기, 예외·재진입·옵션 복사,
   실제 progression phase 전달 및 진행 수치 불변을 검증한다.
3. 실제 AuthProvider/API/격리 PostgreSQL/Chrome/WebGL/native body+face+hands에서
   남녀 prepare→start→수행→유지→pause→새 세대 resume→복귀 및 소유권 해제를 검증한다.
   SDK 입력은 blank fake camera(양성 신체 없음), phase 입력은 별도 합성 관측임을 기록한다.
   실제 SDK 결과를 합성 성공으로 바꾸지 않는다. TEST-only 최종 결과 대기로 해제 경계 확인.
4. 실제 외부 요청/개인 영상 캡처/좌표 저장 0, 아바타만 화면 증거, 원본/GLB/공개 번들 동일.
5. 기존 native head/hands 회귀, 전체 FE/types/check/assets/build/guard/Ruff/diff,
   최신 diff/main/충돌/체크/author review 후 조건부 merge commit. 실패 증거 보존.

현재 단위 RED는53통과/6실패, 구현 후59통과, author 경계 보강 후62통과다.
최초 Chrome14흐름은 약한 이동 여부 기준으로 통과했지만, 시범의 마지막 관절 자세와
제작 클립의 일치 기준을 추가하니 runtime8c24d5b에서12통과/2실패했다.
실제 화면은 시범이 거의 rest에 머물렀다. 미래 cue/RAF 간 정지 반복을 보완했으며
단위 시간 RED62/1실패→63통과, retained pair 권한 RED63/1실패→64통과다.
실제 강화 브라우저·기존 head/hands 회귀는 재실행 전이다. 수치2e-6은
제작 quaternion 부동소수점 비교 허용 오차이며 신체/임상 판정 기준이 아니다.

## 제외·최종 완료 조건

승인된 공개 디자인과 사용자 흐름, 올바른 시범 자료, 실측 판정/적응형 피드백,
신체 대응 정확도, 최종 외형·리깅 변형·실제 노트북·참여자·SDK 정책·운영은 이월 조건이다.
0 qualified release motions 유지. 이 Story 통과로 2단계 또는 전체 1~6을 완료하지 않는다.
