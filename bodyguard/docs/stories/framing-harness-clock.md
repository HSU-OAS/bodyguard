# S6.23 — 촬영 안내 하네스의 결정적 프레임 시각

2026-10-10 · 최신 main `2f191b87fb54778beddacf2fd17f3c1ae44b15a2` · `codex/framing-harness-clock`.

## 보완 전 계약과 원인

FR-M-02/07·NFR-08: DEV 촬영 안내 시험의 합성 프레임은 실제 촬영/자세 정답이 아니다. S4.18 전체frontend1504 중 첫 MeasureDemoPage 시험이5/5 대신 새 프레임 대기0/5로 실패했다. fixture는 생성 때의 실제 performance.now를 한 번 저장하고 이후 프레임을 갱신하지 않는다. render/접근성 조회 후 기록 시각은 별도 실제 시계이며 이 시험만 시계를 고정하지 않았다. 다른5시험은 이미 명시적인 시계를 사용한다.

원래 실패 실행의 실제 elapsed age는 로그에 없으므로 몇 ms였다고 추정해서 기록하지 않는다. 동일 base의 private 진단 복사본에서 sampledAt1000→capture2001로1001ms를 명시하면 같은 첫 기대가 실패한다(1실패/5skip). stale 입력에 대한 제품 거부는 올바른 동작이며 시계 가정이 잘못된 시험을 제품 실패로 바꾸지 않는다.

## 수용 기준과 실행

1. 첫 기존 시험에서 fixture 생성 이전부터 performance.now를 고정한다. 원래 상반신/전신/미검출/지우기/원시좌표·저장 금지 assertion을 모두 유지한다. afterEach restoreAllMocks를 유지한다. 실제 대기·rerun·재시도·worker 제한으로 실패를 감추지 않는다.
2. 새 DOM 시험은 sampledAt1000에서 now2000(기존 한계 포함1000ms)→5/5, now2001(1001ms)→0/5와 새 프레임 대기, sampledAt2001 새 입력→다시5/5를 확인한다. boundary/refreshed input을 검증하며 제품 신선도 기준을 낮추지 않는다.
3. 최초 전체 실패 JSON/로그와 실행 전 원래 source/private 진단 source·실패를 보존한다. 보완 후 해당 페이지/순수 framingTrial 및 전체frontend, 타입/Biome/build/private guard를 실행한다. public JS/CSS 실제 byte 불변을 대조한다. native 촬영/SDK/아바타 검증으로 세지 않는다.
4. 작성자 scoped 리뷰·SHA·diff와 최신 main/HEAD/CLEAN/체크 확인 후 한 목적 PR·조건부 merge commit, 브랜치 유지. S4.18 서버 API 작업트리와 기존 Draft51은 보존하고 이 PR에 섞지 않는다.

## 제외와 다음 작업

제품/UI/신선도1000ms/판정/애니메이션·개인정보·서버/DB·CI·의존성 변경0. 새 아바타 제작/검증0·기존 원본/실패 보존. 이 DOM 시험은 DEV 촬영 안내 하네스이며 실제 노트북/사람/의학 정확도·역사적 시작P2의 해결 증거가 아니다. 전체1~6/출시 후보판은 미완료이고 승인된 화면/외부/실측 의존성은 그대로다. 본 PR이 병합되어야 S4.18 전체 웹 검증을 다시 실행하며 최초 실패를 삭제하지 않는다.

## 진행

원래 전체 실패1503/1·명시적 stale 반례1실패/5skip를 보존했고 테스트 시계만 보완했다. 페이지/순수 framingTrial29·전체frontend1505·tsc/Biome/build/private guard·public2 byte 불변·source8/불변188/압축·원본27 SHA를 실제 통과했다. [작성자 리뷰·실행과 한계](../review/framing-harness-clock/README.md)에 기록했다. scoped 조건부 PR 게이트를 진행하며 API/원래 Draft·전체 출시 조건을 대신 닫지 않는다.
