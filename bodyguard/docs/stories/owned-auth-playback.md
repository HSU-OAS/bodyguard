# S2.T8 — 로그인 소유 재생의 교체·종료 장벽

상태: 비공개 구현·단위/실제 API 브라우저 검증 통과, 조건부 PR 게이트 진행 / runtime `f6c47d76e6e40fcfd8bac297c7989bea6d63f78a` / baseline `907dbdf886d101bbda24b2068ede19fa0b65c71d` / `codex/owned-auth-playback`

FR-U-04·FR-S-02/04·FR-R-03·NFR-07/08. 기존 로그인 소유 hook과 S2.T7 재생 자원을 연결한다. 한 기록 세션마다 새 bridge를 전달하며, 이전 native 자원의 종료가 끝나기 전에 새 세션을 준비 완료로 내보내지 않는다.

## 수용 기준·하네스

1. 기존 hook에 선택적 owned lifecycle을 명시 주입한다. 생성·인증 확인·준비만으로 카메라/SDK/재생/저장0. 공개 UI·동작 기준·SDK 통신 정책 변경0.
2. 순수 plan/기록 ID 검증 뒤, 첫 비동기 인증 capture 전에 lifecycle 소유권을 한 번 전달한다. getter/close를 한 번 캡처하며 별칭은 다른 소유자의 close를 실행하지 않는다. guest/잘못된 순수 설정은 caller 소유 그대로다.
3. 로그아웃·같은 계정 refresh·계정 변경·페이지 이탈·unmount·명시 cancel은 권한을 즉시 회수한다. 기존 session close와 optional lifecycle close를 모두 실행하고 동일한 정리 Promise에 합류한다. pending permission/추론이 있으면 UI는 즉시 중단하되 새 준비는 정리가 끝날 때까지 기다린다. 승인 popup 강제 취소를 약속하지 않는다.
4. 정리 중 동기 재진입/throw/rejection도 나머지 정리를 막지 않는다. caller close는 자기 자원 정리를 끝내는 함수이며 hook의 같은 정리 Promise를 반환/기다리지 않는다. cleanup-error는 원시 메시지 없이 고정 상태로 남고 같은 hook의 새 준비를 격리한다. mounted 여부와 원래 ready 객체를 계속 확인하며 늦은 준비/observer가 살아나지 않는다.
5. 단위: 실제 AuthProvider/hook, 실제 S2.T7 bridge/controller의 소유권·pending/late·교체·실패·별칭을 결정적으로 검증한다. 브라우저: 기존 실제 API/격리 DB 계정 소유 흐름을 회귀 검증한다. 단위 자원은 모의 자원이며 실제 Chrome SDK/GLB와 실제 API를 동시에 연결한 검증은 후속 통합이다.
6. 전체 frontend·타입·Biome·공개 build/guard·공개 byte 동일·실패 원본·source SHA·작성자 리뷰·최신 PR 게이트를 실제 확인한다. 원본/기존 검증·남은 D2·1~6 기준과 별도 승인 경계를 보존한다.

testing-strategy에 따라 로그인/소유권 단위와 실제 API 브라우저 회귀, native 통합/실제 참여자 검증을 구분한다. code-review로 비동기 교체·재진입·실패 격리·원시 데이터 경계를 점검한다. 최소 텍스트 정책·안전 안내 유지. 최종 아바타 외형·판정·공개 코칭·출시 후보판 완료가 아니다.

## 진행 결과

기존 hook에 fresh lifecycle 전송·정리 합류·교체 장벽·고정 실패 격리를 추가했다. 실제 AuthProvider+S2.T7 bridge의 pending camera/입력은 모의 자원 단위 시험이다. 실제 Chrome/API/격리 PostgreSQL에서 가입→합성 수행→명시 저장→본인 기록 상세, 같은 계정 재확인, 성공/실패 로그아웃, 서버 logout 후 실제 /me401, 이탈을 별도 확인했다. 브라우저 자원/동작/시계/메일은 합성이고 native SDK·GLB 통합·물리 webcam·실제 사람 시험은 아니다. 작성자 리뷰의 재진입 교체 누락을 RED로 재현·수정했으며 원본 실패를 보존한다.

[최종 runtime의 실제 흐름·원본 실패·source SHA·작성자 리뷰·남은 조건](../review/owned-auth-playback/README.md). 공개 byte/모델·제품 정책/화면 변경0이며 native SDK/GLB/API 전체 통합과 D2/전체1~6을 완료로 표시하지 않는다.
