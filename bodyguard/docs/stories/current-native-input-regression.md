# S6.C11 — 현재 SDK의 연속 입력·오류 복구 통합 회귀

기준 main `9a26837bfaca00b4fa803d4432465cbd6a8834b2`, `codex/current-native-input-regression`. FR-M-01/02/07·FR-U-04·NFR-07/08, 출시 계약3·6. PR143의 기존 body gate별 추론 생략이 카메라 준비 이후 연속 입력·오류 복구를 깨뜨리지 않는지 현재 실제 개발 웹에서 확인한다. 새 제품 기능이나 기존 준비/루프 재구현은 목적이 아니다.

## 실제 선행 상태

카메라 준비/연속 입력/명시 재시도·촬영 안내는 이미 구현됐다. 실제 코칭/추천/결과 생산과 최종 남녀 아바타는 준비되지 않았다. 진단으로 기존 연속 입력 driver를 현재 main과 tree가 같은 PR144 source에서 실행해7흐름을 통과했다. 이 정상 기준선을 RED나 새 구현으로 소급 표시하지 않는다. 독립 확인을 위해 현재 worker/owner/driver/lock의 실행 전 SHA도 보존했다.

## 수용 기준·하네스

- C1: 실제 React/AuthProvider/Vite/설치 Chrome·가짜 camera/실제 heavy body·face·hands SDK에서 명시 준비1→별도 입력 확인→동일 camera/Worker 후속 입력→끄기, callback 취소/늦은 반환·router/pagehide/hidden·계정401 회수를 확인한다. callback·숨김·계정은 제어 조건이며 실제 사람/장치 정확도로 세지 않는다.
- C2: 기존 오류 복구 driver로 capture/Worker/held5000ms·track stop 오류를 주입한다. 오류→자원 종료→명시 새 준비/첫 입력 폐기→별도 입력 확인으로 복구하고, 이전 callback이 새 연결을 끊지 않음을 확인한다. cleanup 오류는 router remount에서도 재획득을 막아야 한다.
- C3: SDK·UI·source와5000ms 한계·모델·판정/개인정보 정책을 변경하지 않는다. 실패가 있으면 원본을 보존하고 원인이 증명된 경우만 같은 범위에서 보완한다. 실패를 후속 성공으로 덮지 않으며 아바타/실측 보류를 우회하지 않는다.
- C4: 관련/전체 frontend·타입/Biome·원래 notice build/production guard·source와 증거 SHA·diff를 확인한다. DOM 제어 영역만 미리보기로 보존하고 실제 영상/좌표/예외 원문·새 사용자 데이터 수집/저장은 하지 않는다.
- C5: 작성자 리뷰·최신 main/diff/HEAD/CLEAN/충돌/체크를 확인하고 조건부 merge commit, source branch 유지, 실제 main 포함을 기록한다. 체크 없음을 명시하며 독립/전문가 검토라고 표시하지 않는다.

## 완료·제외 경계

현재 native 입력7·오류 복구4, 관련60/전체frontend1885·원래 타입/notice build/Biome/guard를 실제 통과했다. 제품 수정0·이번 실행 실패0이며 [현재 실제 화면·흐름·원본/SHA·작성자 리뷰와 한계](../review/current-native-input-regression/README.md)를 보존했다. 정상 회귀를 RED/새 구현으로 표시하지 않는다. 최신 원격 diff/HEAD/main/CLEAN/체크·리뷰와 조건부 병합은 PR에서 확인한다.

아바타·실제 참여자·Docker/HTTPS·공식 문의·실제 Gmail/Google 보류, 출시 적격 동작0·실제 보정/추천/판정·기존 시작P2/PR90 실패 원인·최종 외형/시범/권리·외부/운영·전체1~6 미완료를 유지한다. 새 화면/메뉴/UI 디자인·API/DB·운영DB migration·계정/비용/시크릿·배포/출시 변경0이다.
