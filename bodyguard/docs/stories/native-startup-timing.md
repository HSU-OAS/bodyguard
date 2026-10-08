# S6.8 — native 시작 지연의 단계 분리

상태: 시험 계측 구현·로컬 검증 완료, 조건부 PR 게이트 진행 · 기준 main258f741 / PR84 실제 병합 확인

이전 턴은 PR84 구현/검증/실제 병합으로 진행한 턴이다. 이번 독립 버그 작업은
최신 main의 codex/startup-latency에서 시작한다. 공개 구조/디자인은 승인 전 확장하지 않는다.

## 문제와 수용 기준

기존 native-feedback 첫 시험은 첫 결과0·cleanup 시간 초과, 다른 시험은
5초 동안 결과2(그 뒤 snapshot7)였다. 화면 제목 로딩의 longtask와 별도 문제이며
현재 증거에는 camera/SDK/GLB/첫 render·추론별 시각이 없어 원인을 확정할 수 없다.
기존 report·실패·간헐적 시작 P2는 보존한다. 정상 재실행만으로 해결하지 않는다.

- START-N01: 실제 native fixture의 카메라·body/face/hands SDK 생성·GLB 로딩·
  최초 render/body/face/hands/결과 반환을 구분한다. 전후 상대 시각과 고정 stage만
  최대30개 기록한다. 관절/영상/모델 입력/계정/URL/오류 원문은 기록하지 않는다.
- START-N02: 실행 순서/관찰 원래 stamp·SDK delegate/호출 횟수·소유권/cleanup을
  바꾸지 않는다. 계측은 시험 fixture만 사용하고 공개 runtime/제품 UI에 import하지 않는다.
- START-N03: 단위 하네스에서 상한/동시 진행/반환·clock 오류/종료 후 폐기와
  외부 payload 비보존을 검증한다. 실제 Chrome native suite의 남녀 첫 시작에서
  단계별 원인을 가를 증거를 남긴다. 합성 장치/메일·실제 API/격리 SQL/SDK를 구분한다.
- START-N04: 기존 poll5000ms/case60000ms·재시도0·SDK/제품 기준을 그대로 둔다.
  실제 실패를 보존하고 단계 수치가 없는 구간은 미확정이다. 제품 변경은 원인 입증 후
  별도 동일 버그 범위에서 RED→GREEN으로 진행한다.
- START-N05: FE 전체/type/Biome/build/guard·공개 byte/소스 안정성·diff/증거 검사를
  실제 통과하고 author-only 리뷰/조건부 PR 게이트를 적용한다.

Graphify code-only135파일(1292노드/3323edge)의 경로와 직접 source를 대조했다.
camera→inference→avatars 순차 acquisition, RAF render 이후 capture 요청 경로를
확인했지만 이 정적 순서 자체가 과거 지연의 원인 증거는 아니다. CSS8파일은 추출에서
제외됐으며 graph를 CSS/실제 성능 판정으로 사용하지 않는다.

## 제외와 다음 조건

제품 시작 결함 해결·물리 webcam/사람·다장치/성능·실제 오류 classifier/올바른
교정 콘텐츠·최종 외형/조형·승인 공개 UI/SDK 정책·운영/외부/배포는 포함하지 않는다.
같은 부위 새 조형0·최소 텍스트·출시 동작0·기존 D2/전체1~6 완료 기준은 유지한다.
실제 참여자/외부 연결/운영 승인 대기 중 독립 작업을 계속하며 미완료를 건너뛰지 않는다.

## 실제 결과

runtime245508c에 명세/하네스를 먼저 보존했다. [시작 단계 기록·원본 실패·리뷰](../review/native-startup-timing/README.md).
START-N01~05의 bounded 시각·소유 종료·실제 Chrome20/FE1177·정적/build/guard·
public byte 동일·source 대조를 통과했다. 초기 단위1실패/7통과와 helper의 scope 비교 실패는
보존했다. 과거 native 시작은 재현되지 않았으며 제품 시작 P2 해결/1~6 완료로 표시하지 않는다.
시험용 코드·API/격리 SQL/SDK와 가짜 장치/메일·동작을 구분한다. 다음은 정상 계측 반복이
아니라 실패 당시 시각/환경 대조 및 독립 기능/실측 조건이며 미충족 기준은 유지한다.
