# S2.T20 — native 관찰·현재 코칭과 사용자 오류 표시 연결

Status: 비공개 통합 검증 / 조건부 PR gate / 시작 원인 미확정·단계 완료 아님

PR82 실제 merge3190c4e/main·같은 tree·브랜치 보존을 확인한 최신 origin/main에서
새 codex/native-feedback로 시작한다. 목적은 기존 카메라→같은 SDK frame→소유
사용자 모델 흐름에 오류 표시와 현재 코칭 단계의 시범을 연결하는 것이다.
공개 화면·조형·GLB·판정 수치·SDK 통신/임상 정책·운영 변경은 하지 않는다.

## 계약

- feedback은 명시 설정일 때만 켠다. 영역 설정과 evaluator를 camera/SDK await 전에
  복사·검증한다. 설정 생략 시 이전 흐름/공개 byte와 외부 정책을 유지한다.
- evaluator는 같은 원래 native frame을 browser memory에서 동기 처리하고,
  현재 소유 coaching state와 오류 region/severity 또는 null만 반환한다. 기본
  classifier/효과/각도/정상 통과를 이 adapter가 만들어내지 않는다. 실제 규칙 검증은 별도다.
- 사용자 rig가 받아들인 frame에만 호출한다. generation/sequence/원래 capture stamp,
  상태의 motion/version·lastSequence/lastSampledAt·현재 running 관찰이 일치할 때만
  표시·시범 단계에 전달한다. state나 frame을 새 시각으로 restamp하지 않는다.
- state를 전달하는 caller는 현재 로그인 소유 session의 실제 상태를 사용해야 한다.
  returned state는 인증/동일인/임상 적격성의 증명이 아니다. 실제 검증 동작0을 유지한다.
- 비관찰/null/오래된 상태/이전 세대/버전 불일치는 강조를 만들어내지 않는다.
  가림/복수/미검출의 기존 coverage 해제·만료·원본/시범 독립·8가중치를 유지한다.
- callback·getter 재진입/취소·새 관찰/세대 교체는 기존 controller 권한을 다시 확인하고
  이전 결정이 최신 관찰을 덮지 못하게 한다. feedback-only의 retained pair도 종료 이후 차단한다.
- Promise/exception은 고정된 기술 오류로 처리하고 raw 오류/좌표를 로그·서버에 내보내지 않는다.
  SDK/VideoFrame borrowed 정리 장벽을 유지한다. 원본 영상/좌표/얼굴/손은 browser memory만 사용한다.

## 실행형 하네스·수용 기준

| 흐름 | 하네스 | 증거 범위 |
|---|---|---|
| 같은 native delivery→현재 state→표시·단계 시범 | Vitest adapter/source/세션 경계 | mock native/생성 상태·좌표·오류, 실제 코드 |
| stamp/버전/누락/null·재진입·종료/borrow/Promise | 결정적 실패 주입 계약 | actual controller/bridge, mock SDK·source |
| 로그인 준비→두 GLB→강조/복구→종료/새 세대/권한 회수 | private Chrome/API/격리 SQL | 실제 브라우저/native SDK/GLB·가짜 카메라. 긍정 오류는 별도 합성 |
| defaults/공개 유출·소스/원본/전체 회귀 | FE/types/Biome/build/guard/diff/SHA | 실제 실행만 통과로 기록 |

RED와 실패 원문을 보존한 뒤 구현·리뷰 보완·같은 소스 재실행을 한다. 실행 준비
실패/skip·모의 양성을 실제 사람 판정으로 표시하지 않는다. actual browser proof와
Story 필수 gate가 없으면 PR을 병합하지 않는다.

## 현재 구현·실패와 증거 범위

선택적 feedback evaluator가 rig가 수용한 동일 native delivery를 현재 소유
session으로 전달한다. 현재 state/원래 stamp가 일치할 때만 사용자 색과 시범
phase를 연결한다. 재진입한 이전 callback의 예외가 새 관찰을 폐기하는 문제와
잘못된 phase/step/age를 재현해 보완했다. feedback 설정 시 retained 직접 강조는
차단하고 controller/borrowed 정리 장벽을 유지한다.

실제 Chrome/API/격리 SQL/세 SDK/남녀 GLB의 private fixture에서 기본/native
미검출과 합성 긍정을 분리했다. SDK는 가짜 장치 원래 결과를 실제 실행한 뒤
긍정 시험에서만 반환 JS 배열을 **원본 마네킹 rest bone에서 생성한 좌표**로
대체한다. 올바른 동작/실제 사람 검증이 아니다. 처음의 임의 격자 fixture로
기괴하게 변형된 화면도 로컬 첫 증거로 보존하고 삭제하지 않는다.

첫 통합은14통과/2실패(시작 및 재준비), GPU 강화 통합은15통과/1실패(시작)다.
재준비용 시범 fixture는 한 번 읽은 immutable 프로그램을 재사용하도록 했으며
시작의 간헐적 지연 원인은 아직 미확정이다. timeout5000/60000ms를 늘리거나
통과 조건을 낮추지 않는다. 이전 시작 P2를 해결됐다고 표시하지 않는다.
실패 종료 전 scalars-only snapshot을 보존해 종료 중 지연과 native close를 구분한다.

강화 통합의 합성 오류는 실제 GPU 사용자 오른쪽 남3745/여1821색상 픽셀,
시범 왼쪽0이었다. 가림/복수/미검출은0이며, 실제 camera/참여자/native 양성은0이다.
fixture caller의 canvas 숨김은 권한 회수 화면 시험용이며 공개 UI 구현 완료가 아니다.
전체FE1145·types·Biome247 및 변경된 Python 하네스 Ruff/format은 실행 통과했다.
추가 커밋 소스/브라우저 회귀·PR gate는 아직 남아 있다.

실행 원문은 `/private/tmp/bodyguard-native-feedback-proof.QfzMIt`에 보존한다.
최종 기록은 [같은 runtime commit의 실제 재검증·manifest](../review/native-feedback/README.md)로 연결한다. 일부
초기 소스는 snapshot, 나머지는 hash/로그/Git 기준선으로만 추적하며 모든
실패 당시 소스 전체를 보존했다고 주장하지 않는다.

위 숫자는 runtime 작성 시점 중간 기록이다. 이후 runtime d4f475c의 전체FE1145·
types/Biome/assets/build/guard/Ruff/diff와 실제 통합16, 옵션 없는 비교14를 통과했다.
간헐적 시작 원인을 해결했다고 표시하지 않고 기존 출시 P2를 유지한다. public
byte·source/GLB·실제/합성 및 미실행 경계는 review에 명시한다.

## 미충족 출시 조건

실제 동작 classifier/수행법/오판정·같은 사람/깊이·목/체간/손·적응형 교정 시범,
최종 남녀 얼굴/목/표면·Blender/GLB/변형/권리·실제 webcam/참여자/다장치·승인
공개 디자인/구조/적용·SDK 정책·외부 계정·HTTPS/운영·사용성/보안/성능 및
전체1~6 완료 기준은 유지한다. 같은 부위 새 조형 사이클은 하지 않는다.
최소 텍스트와 별도 운영/안전/개인정보 승인 경계도 그대로다.
