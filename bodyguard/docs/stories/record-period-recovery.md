# S6.4 — 기록 기간 입력·잘못된 주소 복구 수명

Status: verified · conditional PR gate pending · baseline `39a23ebf2157de2537da9ee6362f5f43c3215ceb` · `codex/record-period-recovery`

## 문제와 범위

S4.17 최신 main 통합 회귀에서 기존 자세 기록 화면의 존재하지 않는 날짜 URL 복구가 전체743건 중 한 번 실패했다. 단독3건·기존 파일23건·소스 변경 없는 전체 재실행은 통과했다. 실패 원본은 S4.17의 private 로그/XML과 공개 SHA·실패 수에 보존돼 있다. 재실행 성공을 원인 해결로 간주하지 않는다. FR-R-03·FR-U-04·NFR-07.

이 Story는 `/posture-records`의 기존 날짜 입력·조회·잘못된 URL 복구·뒤로가기 수명만 조사·보완한다. 새로운 화면 구성·문구/디자인 확대·API·임계값·개인정보·의존성/lock·배포·운영 변경은 없다. PR #51의 미승인 대시보드 구조를 main에 넣지 않는다.

## 명세·하네스

1. 존재하지 않는 날짜·역순 기간·잘못된 페이지 URL은 조회를 시작하지 않는다. 사용자가 유효한 기간으로 수정하면 입력을 잃지 않고 명시 조회로 복구한다.
2. 최초 DOM이 보인 직후 입력과 초기 passive effect가 겹치는 경계를 결정적으로 재현한다. 초기 동기화가 사용자 입력을 덮는지 실제 React/Router/DOM 이벤트로 확인하며, 원인이 재현되지 않으면 추정 수정하지 않는다.
3. 실제 URL/뒤로가기/페이지/명시 재조회 변경에서는 입력·선택·삭제 대상의 기존 초기화 계약을 보존한다. 미제출 입력을 조회 결과 기간으로 표시하지 않는다. auth ready 교체/abort/늦은 결과 차단은 그대로다.
4. 최초 실패와 보완 후 같은 하네스를 보존한다. 합성 네트워크 DOM 시험을 실제 API·사람·웹캠 검증으로 표시하지 않는다. 기존 전체 단위 회귀·정적/type/build/production guard·실제 격리 API의 기존 자세 기록 Chrome 흐름을 같은 시간 제한으로 실행한다.
5. 최신 main/diff/exact HEAD/CLEAN/체크·미해결 scoped P1/P2 없음 뒤 조건부 merge commit·브랜치 보존. 추정 원인·미실행·간헐 실패가 남으면 완료/병합 금지다.

## 진행

- [x] 실제 실패·main·기존 코드와 URL/인증 계약 확인.
- [x] 초기 입력 경계의 결정적 원인 재현. 기존 소스와 동일한 초기화에서 시작/종료·StrictMode 유무4건 입력 유실. 기존23건과 URL/삭제 확인2건은 통과. 초기 테스트의 act 경고는 시험 설정 문제였으며 원본 보존 뒤 native 이벤트·await React act로 분리했다. 경고 없는 최종 RED에서도4건 실패했다.
- [x] 필요한 최소 보완과 URL/인증 수명 회귀. 초기 URL은 state initializer가 이미 반영했으므로 같은 최초 경로를 중복 반영하지 않는다. 실제 기간/페이지/key/revision 변경은 기존 초기화 유지. 보완 후 같은29건 통과. 전체·실제 Chrome 검증은 아래 게이트 전까지 미완료.
- [x] source `33f690c6a4a29cc83da243ee76ba63fb293264c6`에서 전체693·동일29·type/Biome/build/production guard 통과. 기존 실제 Chrome/API/격리 SQL 자세 기록4흐름 통과. 시간 제한은 변경하지 않았다. [실제 결과·작성자 리뷰·미완료 구분](../review/record-period-recovery/README.md). 전체194개 제품/시험/설정 source의 실행 전후 SHA가 동일하며 최종 문서 커밋 뒤에도 다시 비교한다.
- [ ] 최신 main·최종 diff·exact HEAD·CLEAN/체크·scoped 미해결 P1/P2 없음 확인 후 조건부 PR 병합 및 main 포함 확인.

SDK 외부 통신 정책은 CEO 별도 승인 대기이며 이 Story에 섞지 않는다. 디자인 구조/텍스트 최소화 적용·아바타/실측·전체1~6단계는 미완료다.
