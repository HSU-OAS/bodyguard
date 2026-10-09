# S6.18 — 준비용 첫 추론과 재생 소유권 분리

2026-10-09 · 최신 main f356253(PR104) · FR-M-01/02/07·FR-A-03·FR-S-04·NFR-07/08.

## 목적·범위

실제 첫 body/face/hand 추론 비용을 ready 이후의 재생에 남겨두지 않는 private opt-in을 검증한다. SDK를 더 빠른 것으로 교체하거나 화질·모델·판정 수치를 낮추지 않는다. 기본 호출은 그대로다. Draft101의 병렬 준비/조기 camera 회수 변경을 가져오지 않는다.

현재 소유 source에서 한 번의 실제 새 decoded frame을 처리한 뒤 결과를 버린다. 같은 source를 재생에서 재사용하여 sequence/media/timestamp 경계를 유지하고 다음 새 frame만 전달한다. 준비 결과는 아바타 observe/evaluator·코칭·타이머·기록·성공에 전달하지 않는다. 영상/좌표 저장·전송·로그·사용자 화면 확대가 없다.

source를 만든 뒤 취소하면 capture를 즉시 무효화하고, 진행 중 read/원본 frame 회수가 끝나기 전에 native SDK를 닫지 않는다. 늦은 완료는 ready/start를 열지 않는다. source·카메라·SDK·모델은 동일 generation에서 한 번씩 회수한다. 실패는 실패이며 cleanup 실패를 일반 준비 실패로 숨기지 않는다.

## 먼저 고정한 하네스·수용 기준

- 준비 중 ready/start·scheduler·observe·render0. 같은 source의 준비 read1, 첫 live read는 새 stamp이며 준비 frame 전달0.
- default는 source를 start 시점에 만들고 준비 read0. opt-in이 없는 기존 회귀 body와 제한을 바꾸지 않는다.
- 취소 전/대기 중/늦은 return, read reject, source dispose reject, replacement/reentry에서 native lifetime 장벽·중복 회수·오류 보존 확인.
- actual Chrome154/155, 남녀 원본 GLB, main/Worker, render 준비와 SDK 첫 호출 시간·ready 전후 RAF gap 대조. 가짜 카메라/기술 비용 시험이며 사람 자세·정확도·실제 매끄러움 증거가 아니다.
- 원래26건/로그인 소유 회귀는 가능하면 실제로 재실행하며 미실행은 그대로 명시한다. 시험 제한·retry를 늘려 기존 시작 P2를 해결로 표시하지 않는다.
- FE 전체/타입/Biome/public build 및 guard·공개 byte/원본 GLB 불변·diff·scoped 리뷰·원격 PR 게이트.

## 제외·미완료

공개 디자인 구조/문구 확장·SDK 제품 정책·기본 Worker 전환·새 조형·GLB 수정·임상/효과/실측 승격·운영/배포0. 뷰티는 출시 후다. 기존 시작 P2, 실제 참여자, 최종 외형·시범·승인 공개 UI/SDK·D2 및 전체1~6단계 기준은 별도로 남는다. 측정 비용을 준비 단계로 옮긴 결과를 전체 시작 시간 개선으로 부풀리지 않는다.

## 진행

- [x] 구현 전 명세와 합성 소유권 하네스 작성.
- [x] 최초 RED3/23 원문 보존 → 준비 결과 비전달·cancel/native close·교체/재진입·실패 회귀15건. 최초 test source는 별도 미보존.
- [x] 실제 Chrome154/155의 최종 normal16/취소4·FE1479·타입/Biome/assets/build/guard·공개 byte/GLB 불변·실패와 미보존 한계 정리. [증거와 작성자 리뷰](../review/native-inference-warmup/README.md).
- [ ] scoped 리뷰·commit/push/PR·정확한 HEAD 조건부 merge.
