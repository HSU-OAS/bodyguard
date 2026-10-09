# S6.16 — 촬영 목 관찰의 전체 native 회귀 복원

2026-10-09 · 기준 main e2360f6989c4454f0b320c70eb0578217dfacb77(PR99).
FR-M-01/02/07·FR-S-03/04·FR-R-03·NFR-07/08. 최종 통합의 비공개 검증 보완.

## 범위와 계약 — 구현 전

PR90/884700e의 최종26건은 목 관찰을 켠 기존 남녀24건과 새 목 흐름2건이다. 최근 main의24/준비28은 이 구성을 포함하지 않았다. 원래 시험의 이름·수용 조건을 대조하고 현재 captured-image evaluator에 이26개의 회귀를 복원한다. 현재 main은 과거의 getNeckObservation 캐시 대신 같은 accepted frame의 순수 observeCapturedNeckSide를 사용하므로 호출 위치 차이를 명시한다. 과거 PR/소스/13실패는 그대로 보존한다.

- BODYGUARD_TEST_NATIVE_NECK=1에서 **모든 기존24건에도** 촬영 목 관찰을 켠다. 남녀 새2건만 별도로 켠 통과를 전체26으로 세지 않는다. Worker와 renderer 준비는 별도 인자이며 기존 기본 호출은 유지한다.
- actual VideoFrame의 원래 크기·반전/presence와 같은 accepted frame을 사용한다. 시험 observer는 현재 frame 하나만 임시 메모리에 보유하고 snapshot의 현재 performance 시각·현재 actor/session 소유/세대를 확인한다. 관찰값/좌표는 저장·출력하지 않고 고정 status/일치 boolean만 내보낸다.
- blank→저작된 양성→낮은 presence→crop/multiple/none→복구→pause→새 세대의 원래 조건을 유지한다. available은 실제 사람 검출·올바름·동일인·classifier·적립이 아니다. 파생 값에 기반한 제품 판정은 추가하지 않는다.
- nativeCloses≥3의 기존5000ms poll, 전체60초, retry0과 가입 제한을 유지한다. 남녀 분할은 각각 격리 서비스/합성 DB 데이터로 실행하며 제외된 시험이 없는지 원래 전체 제목 목록과 대조한다.
- 기본26과 선택적 준비26을 구분한다. 과거 Chrome154와 현재 설치 브라우저의 차이, 함수 경계 차이가 있어 이번 실행만으로 **역사적13/26 실패의 원인 또는 기존 시작P2 해결을 선언하지 않는다.**

## 하네스·검증 게이트

1. 누락된 목 snapshot/fixture 제어의 계약 실패를 먼저 기록한다. 타입 실패와 실제 실행 assertion 실패를 구분한다.
2. 실제 Chrome/SDK/AuthProvider/API/새 로컬 SQL에서 남녀13+13건, 모든 원래 제목/가림·퇴역·정리/본인 기록 조건을 실행한다. 모의 장치/메일/양성·단계/오류는 실제 사람과 구분한다.
3. 소스·bundle·실패/최종 결과·브라우저/모델·원본 GLB/공개 byte SHA와 실행 전후 동일성을 보존한다. 기존 증거 덮어쓰기0, raw video/좌표/per-frame 신체 수치/실제 카메라 screenshot0.
4. 전체 FE·타입·Biome·직렬 public build/guard·diff와 작성자 검토를 수행한다. 실패한 필수 회귀는 통과로 세지 않고 미해결 scopedP1/P2가 있으면 병합하지 않는다.

## 제외·유지

제품 코드/classifier/SDK 통신 정책·공개 UI/최소 문구/구조·GLB/Blender/새 조형·운영 변경0. 새로운 앱/미승인 화면은 만들지 않는다. 짧은 제목/버튼/현재 코칭·펼쳐 보는 설명·간결한 필수 안전 안내 원칙을 유지한다.

과거 시작P2·승인 공개 구조/SDK 정책·참여자/물리 카메라/장치/조명/체형·검증된 시범/classifier·최종 외형/권리·Docker/HTTPS/운영 및 D2/전체1~6은 미완료다. 비용·계정·시크릿·운영 DB migration·배포·출시·중요한 안전/개인정보 변경은 기존 별도 승인을 유지한다.
