# S2.5c 하네스 — 독립 자원 controller

main d348fb8 · 기존6f57aa1 계약을 보존한 뒤 현재 경계에 적용한다. disposable factory/deferred Promise는 **합성 준비/해제 재현**이다. 실제 MediaStream/MediaPipe/GLB·카메라·사람/관절 정확도 증거가 아니다. R-01~11의 실행형40건/전체367건은 실제 Vitest로 통과했으며 R-12는 실제 build/guard·음성 시험·Chrome7흐름으로 확인했다. [실패·green·회귀/화면 증거](../review/coaching-resources/README.md).

| ID | 입력/사건 | 검증 |
|---|---|---|
| R-01 | 생성·잘못된 type·0/NaN/과거/중복 | factory0/중복 ready0 |
| R-02 | 명시 generation/정상3단계 | camera→inference→avatars·모두 준비 뒤 ready1/close 시 각1회 |
| R-03 | 각 stage throw/reject | 해당 고정 failure/ready0·이전 자원 정리 |
| R-04 | 준비 중 release/늦은 반환 | signal abort·늦은 독립 자원 즉시 정리·후속 준비/ready0 |
| R-05 | generation 교체/역순 완료 | 현재만 ready·과거 정리가 현재에 영향0 |
| R-06 | 과거/중복 release·close 반복 | 현재 보존/정리1회·close 뒤 생성0 |
| R-07 | dispose throw/reject | 나머지 정리·고정 cleanup-error·새 준비 차단 |
| R-08 | 객체 stage/세대 재사용 | ownership-error·잘못된 ready0·현재 타 세대 소유 자원 보존 |
| R-09 | notice callback throw | 남은 정리·unhandled/재준비0 |
| R-10 | raw 오류/자원 metadata | type/generation/고정 reason 외 notice/로그/저장/네트워크0 |
| R-11 | 실제 engine start/pause/resume/end effects | 미확인 gate request0·늦은 notice로 종료 상태 부활0 |
| R-12 | production build/공개 화면 | controller/합성 factory/미검증 계획 공개 bundle0·코칭 비활성 유지 |

모듈 누락/collection error와 실행된 case failure를 구분한다. 실패·환경·green·회귀·정적·작성자 리뷰·PR/실측 미실행을 보존하고 실제 소유 자원 해제 완료로 승격하지 않는다.

작성자 리뷰P2 추가 case는 acquire 완료/다음 stage 사이 release와 cleanup-error callback의 close 대기다. 둘 모두 실제 red 후 수정/green이며 최종 close 중 늦은 반환·여러 해제 실패·callback 예외도 합성 재현했다. 저장소/네트워크/console 호출0은 stub과 source 경계에서 확인했고 브라우저 공개 흐름에서는 카메라·모델/에셋 URL·pageerror·storage0을 별도로 확인했다.
