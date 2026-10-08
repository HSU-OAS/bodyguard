# S2.T14 — 로그인 소유 native 몸·머리 재생 연결

상태: 진행 중 (2026-10-08). 기준 main `7f3c8bcd88b1a77cf3b872a240f73ecbad0b1bb8`.

## 목적 / 범위

S2.T13의 같은 입력 몸·머리 복사 경계를 실제 `createNativePlaybackResources`에 선택적으로 연결한다. 명시적인 표시 정렬과 행렬 저장 순서를 제공한 비공개 호출만 Face SDK를 연다. 기존 body-only 호출은 변경하지 않는다. 실제 AuthProvider/API/격리 SQL 및 미완성 A37 남녀 두 GLB로 소유권 종료·새 소유자 재시작을 검증한다.

새 아바타 외형 제작, 공개 코칭/화면 확장, 동작 판정·각도 기준, 목 분절 실측, SDK 운영 통신 정책, 배포·운영 migration은 제외한다. 같은 프레임은 같은 사람이라는 증거가 아니다. 실제 참가자 정확도 시험과 2단계 필수 게이트는 미충족 그대로 유지한다.

## 수용 기준 / 하네스

1. head 설정 없음: Face SDK와 body-face source를 호출하지 않으며 기존 body-only 옵션·동작·정리 계약을 유지한다.
2. head 설정 있음: head 본, 유한 단위 quaternion 두 개, 명시적 row/column-major를 카메라 이전에 검증·복사한다. 같은 video/stream과 입력 원래 stamp를 두 native 검출기에 전달한다. 비동기 초기화 도중 외부 옵션 변경은 적용되지 않는다.
3. Face 초기화 실패·지연 취소: 먼저 열린 Pose SDK·카메라도 한 번씩 정리한다. 어떤 native close가 실패하더라도 다른 자원 정리를 시도하고 고정 cleanup 실패를 유지한다. 공개 snapshot/notice에 native 원문·좌표가 없다.
4. Face 추론 대기 중 logout/401/pagehide/unmount: 전달·이전 저장·재개는 즉시 차단하고, 빌린 입력을 반환하기 전 SDK·카메라를 닫지 않는다. 이후 결과는 버리고 모든 자원을 정리한다. 새 소유자는 이전 자원을 재사용하지 않고 명시적으로 시작한다.
5. 단위 하네스는 SDK/camera mock임을 표시한다. Chrome native SDK + 가짜 카메라 + 실제 로그인/API/격리 SQL 흐름은 별도 실행·기록한다. 검출 양성·실제 사람·물리 카메라·출시 검증으로 표시하지 않는다. 카메라/좌표 캡처 없이 아바타 전용 미리보기만 보존한다.
6. 전체 frontend 테스트·타입·Biome·빌드·공개 번들 guard·`git diff --check`를 실제 실행한다. 미실행/실패를 통과로 기록하지 않는다. 기존 원본·실패·증거를 보존하고 Story 범위 P1/P2 해결 후 Git 게이트를 통과한다.

## 현재 결과

아직 구현·native 브라우저 검증 완료 아님. 전체 1~6단계 완료 아님.
